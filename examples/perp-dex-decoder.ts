// Payload decoder for the perp-dex application, written in TypeScript against
// the decoder-kit. Build it to an ES module and host it (see decoder-kit/README.md);
// the mock server bundles and serves this file at /perp-dex-decoder.js.
//
// Dispatch mirrors the backend (src/input-decoder.hpp):
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

import {
  ByteReader,
  decodePortalInput,
  formatUnits,
  isHex,
  type Decoder,
  type DecodeResult,
} from '../decoder-kit'

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

export const decode: Decoder['decode'] = (payload, context) => {
  if (context.kind !== 'input') return null // only inputs are documented

  // Standard, shared across every app: deposits from a known portal sender.
  const deposit = decodePortalInput(payload, context)
  if (deposit) return deposit

  // Application-specific messages.
  return decodeApplicationInput(payload)
}
