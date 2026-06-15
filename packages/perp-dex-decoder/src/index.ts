// Payload decoder for the perp-dex application, written in TypeScript against
// the @tuler/luke-decoder kit. Built to an ES module and published to the local
// registry (see ../../infra and the repo README); esm.sh serves it for the
// explorer to import at runtime.
//
// Inputs — dispatch mirrors the backend (src/input-decoder.hpp):
//
//   • Inputs sent by a known Cartesi portal are asset deposits. They are the
//     same for every app, so they are decoded by the kit's decodePortalInput()
//     rather than reimplemented here.
//
//   • Every other input is an application message whose first byte is the input
//     type (inputs.yaml). All integers are big-endian; "u64+u8" pairs are fixed
//     decimals (coefficient / 10^decimals); symbols are ASCII packed into a u64,
//     lowest byte first; timestamps are seconds since the Unix epoch.
//
//       0 FeedPrices:  u8 type · u16 count · count × (u64 symbol · u64 timestamp · u64+u8 price)
//       2 Withdraw:    u8 type · u64+u8 amount
//       3 PlaceOrder:  u8 type · u64 symbol · u64+u8 price · u64+u8 size
//                      · u8 side · u8 timeInForce · u8 postOnly · u8 reduceOnly
//       4 CancelOrder: u8 type · u64 orderId
//
// (Type 1, Deposit, never arrives as a direct application message — it always
// comes through the ERC-20 portal and is handled by decodePortalInput.)
//
// Outputs — the app emits vouchers that move settled funds out via ERC-20
// transfers. A voucher's destination is the contract the rollup will call and
// its payload is the calldata. When the destination is a known ERC-20 token
// (matched by chain id + address, see KNOWN_ERC20S), the payload is decoded with
// viem against the standard ERC-20 ABI — turning the opaque calldata into a
// readable "transfer 20 USDC → 0x…".

import {
  ByteReader,
  decodePortalInput,
  formatUnits,
  isHex,
  shortHex,
  type Decoder,
  type DecodeResult,
  type OutputContext,
} from '@tuler/luke-decoder'
import { decodeFunctionData, erc20Abi, formatUnits as formatTokenUnits, type Hex } from 'viem'

export const version = 1
export const name = 'Perp DEX decoder'

const SIDES = ['Buy', 'Sell']
const TIME_IN_FORCE = ['GoodTillCanceled', 'ImmediateOrCancel']

/** Read a fixed-decimal value: u64 coefficient followed by a u8 decimals exponent. */
function readDecimal(r: ByteReader): string {
  const coefficient = r.u64()
  const decimals = r.u8()
  return formatUnits(coefficient, decimals)
}

/** ASCII characters packed into a u64, first character in the lowest byte. */
function formatSymbol(value: bigint): string {
  let name = ''
  for (let v = value; v > 0n; v >>= 8n) {
    const code = Number(v & 0xffn)
    if (code < 0x21 || code > 0x7e) return value.toString() // not printable → show the number
    name += String.fromCharCode(code)
  }
  return name || value.toString()
}

function decodeApplicationInput(payload: string): DecodeResult | null {
  if (!isHex(payload)) return null
  const r = new ByteReader(payload)
  const len = r.bytes.length
  switch (r.u8()) {
    case 0: {
      // FeedPrices
      if (len < 3) return null
      const count = r.u16()
      if (count < 1 || count > 1024 || len !== 3 + count * 25) return null
      const prices = []
      for (let i = 0; i < count; i++) {
        prices.push({
          symbol: formatSymbol(r.u64()),
          timestamp: new Date(Number(r.u64()) * 1000).toISOString(),
          price: readDecimal(r),
        })
      }
      const preview = prices
        .slice(0, 3)
        .map((p) => `${p.symbol} ${p.price}`)
        .join(' · ')
      return {
        summary: `FeedPrices · ${preview}${prices.length > 3 ? ` · +${prices.length - 3} more` : ''}`,
        data: { type: 'FeedPrices', prices },
      }
    }
    case 2: {
      // Withdraw
      if (len !== 10) return null
      const amount = readDecimal(r)
      return { summary: `Withdraw · ${amount}`, data: { type: 'Withdraw', amount } }
    }
    case 3: {
      // PlaceOrder
      if (len !== 31) return null
      const symbol = formatSymbol(r.u64())
      const price = readDecimal(r)
      const size = readDecimal(r)
      const side = SIDES[r.u8()] ?? 'Unknown'
      const timeInForce = TIME_IN_FORCE[r.u8()] ?? 'Unknown'
      const postOnly = r.u8() !== 0
      const reduceOnly = r.u8() !== 0
      const flags = [postOnly && 'post-only', reduceOnly && 'reduce-only'].filter(Boolean).join(' ')
      return {
        summary: `PlaceOrder · ${side} ${size} ${symbol} @ ${price}${flags ? ` · ${flags}` : ''}`,
        data: { type: 'PlaceOrder', symbol, price, size, side, timeInForce, postOnly, reduceOnly },
      }
    }
    case 4: {
      // CancelOrder
      if (len !== 9) return null
      const orderId = r.u64().toString()
      return { summary: `CancelOrder · #${orderId}`, data: { type: 'CancelOrder', orderId } }
    }
    default:
      return null
  }
}

// ---- Voucher outputs (ERC-20 transfers) -------------------------------------

interface TokenInfo {
  symbol: string
  decimals: number
}

/**
 * ERC-20 tokens this app settles in, keyed by chain id then by lowercase
 * contract address. The voucher destination is matched against this map to
 * decide that an output is an ERC-20 call (rather than hardcoding a single
 * address), and the metadata gives the amount its symbol and decimals — the
 * token contract itself is not queried.
 */
const KNOWN_ERC20S: Record<number, Record<string, TokenInfo>> = {
  // Local dev chain (anvil) the perp-dex node runs against, with Base Sepolia
  // USDC at its canonical address.
  31337: {
    '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { symbol: 'USDC', decimals: 6 },
  },
  // Base Sepolia — same USDC, so the decoder works against a real testnet too.
  84532: {
    '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { symbol: 'USDC', decimals: 6 },
  },
}

/** Look up token metadata for a destination address, preferring the active chain. */
function lookupToken(chainId: number | undefined, address: string): TokenInfo | undefined {
  const addr = address.toLowerCase()
  const onChain = chainId !== undefined ? KNOWN_ERC20S[chainId]?.[addr] : undefined
  if (onChain) return onChain
  // Fall back to any chain's entry — the same token often shares an address.
  for (const tokens of Object.values(KNOWN_ERC20S)) {
    if (tokens[addr]) return tokens[addr]
  }
  return undefined
}

/**
 * Decode a voucher whose destination is a known ERC-20 token: the payload is
 * the calldata of an ERC-20 method, decoded with viem against the standard
 * ERC-20 ABI. Returns null when the destination is not a known token or the
 * calldata is not a recognized ERC-20 call (caller falls back to hex/UTF-8).
 */
function decodeVoucherOutput(payload: string, context: OutputContext): DecodeResult | null {
  const destination = context.record?.decoded_data?.destination
  if (!destination) return null // notices carry no destination

  const token = lookupToken(context.chainId, destination)
  if (!token) return null // destination is not a recognized ERC-20 contract
  if (!isHex(payload)) return null

  let call: ReturnType<typeof decodeFunctionData<typeof erc20Abi>>
  try {
    call = decodeFunctionData({ abi: erc20Abi, data: payload as Hex })
  } catch {
    return null // not an ERC-20 ABI call
  }

  const tokenMeta = { address: destination, symbol: token.symbol, decimals: token.decimals }
  const format = (value: bigint) => formatTokenUnits(value, token.decimals)

  switch (call.functionName) {
    case 'transfer': {
      const [to, value] = call.args
      const amount = format(value)
      return {
        summary: `ERC-20 transfer · ${amount} ${token.symbol} → ${shortHex(to)}`,
        data: { type: 'Voucher', method: 'transfer', token: tokenMeta, to, amount, rawAmount: value.toString() },
      }
    }
    case 'transferFrom': {
      const [from, to, value] = call.args
      const amount = format(value)
      return {
        summary: `ERC-20 transferFrom · ${amount} ${token.symbol} · ${shortHex(from)} → ${shortHex(to)}`,
        data: { type: 'Voucher', method: 'transferFrom', token: tokenMeta, from, to, amount, rawAmount: value.toString() },
      }
    }
    case 'approve': {
      const [spender, value] = call.args
      const amount = format(value)
      return {
        summary: `ERC-20 approve · ${amount} ${token.symbol} · spender ${shortHex(spender)}`,
        data: { type: 'Voucher', method: 'approve', token: tokenMeta, spender, amount, rawAmount: value.toString() },
      }
    }
    default:
      // A recognized ERC-20 method we don't summarize specially (e.g. a view).
      return {
        summary: `ERC-20 ${call.functionName} · ${token.symbol}`,
        data: { type: 'Voucher', method: call.functionName, token: tokenMeta, args: call.args.map(String) },
      }
  }
}

export const decode: Decoder['decode'] = (payload, context) => {
  // Voucher outputs: ERC-20 transfers to a known token contract.
  if (context.kind === 'output') return decodeVoucherOutput(payload, context)

  if (context.kind !== 'input') return null

  // Standard, shared across every app: deposits from a known portal sender.
  const deposit = decodePortalInput(payload, context)
  if (deposit) return deposit

  // Application-specific messages.
  return decodeApplicationInput(payload)
}
