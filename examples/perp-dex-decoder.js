// Payload decoder for the perp-dex application.
//
// Dispatch is driven by the input *sender* (context.record.decoded_data.sender),
// mirroring how the backend itself decides (src/input-decoder.hpp):
//
//   • Inputs sent by a known Cartesi portal are asset deposits. They are NOT
//     application-specific — every Cartesi app receives the same portal
//     message — so they are decoded with the canonical InputEncoding layout
//     documented by Cartesi (rollups-contracts, src/common/InputEncoding.sol),
//     independent of perp-dex. The portal addresses below are the deterministic
//     Cartesi Rollups v2 deployments.
//
//   • Every other input is an application message whose first byte is the
//     input type (src/input-decoder.hpp / inputs.yaml). All integers are
//     big-endian. "u64+u8" pairs are fixed decimals (coefficient / 10^decimals);
//     symbols are ASCII packed into a u64, lowest byte first; timestamps are
//     seconds since the Unix epoch.
//
//       0 FeedPrices:  u8 type · u16 count · count × entry
//                      entry = u64 symbol · u64 timestamp · u64+u8 price
//       2 Withdraw:    u8 type · u64+u8 amount
//       3 PlaceOrder:  u8 type · u64 symbol · u64+u8 price · u64+u8 size
//                      · u8 side · u8 timeInForce · u8 postOnly · u8 reduceOnly
//       4 CancelOrder: u8 type · u64 orderId
//
// (Type 1, Deposit, never arrives as a direct application message — it always
// comes through the ERC-20 portal and is decoded by the portal branch above.)

export const version = 1
export const name = 'Perp DEX decoder'

// Deterministic Cartesi Rollups v2 portal addresses (lowercase), as published
// by @cartesi/viem and the rollups-node address book.
const PORTALS = {
  '0xa632c5c05812c6a6149b7af5c56117d1d2603828': 'EtherPortal',
  '0xaca6586a0cf05bd831f2501e7b4aea550da6562d': 'ERC20Portal',
  '0x9e8851dadb2b77103928518846c4678d48b5e371': 'ERC721Portal',
  '0x18558398dd1a8ce20956287a4da7b76ae7a96662': 'ERC1155SinglePortal',
  '0xe246abb974b307490d9c6932f48ebe79de72338a': 'ERC1155BatchPortal',
}

const ETHER_DECIMALS = 18 // wei → ETH is a protocol constant, safe to format

const SIDES = ['Buy', 'Sell']
const TIME_IN_FORCE = ['GoodTillCanceled', 'ImmediateOrCancel']

/** @param {string} payload @returns {Uint8Array} */
function toBytes(payload) {
  const bytes = new Uint8Array((payload.length - 2) / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(payload.slice(2 + i * 2, 4 + i * 2), 16)
  }
  return bytes
}

/** Sequential big-endian reader over a byte array. */
class Reader {
  /** @param {Uint8Array} bytes */
  constructor(bytes) {
    this.bytes = bytes
    this.pos = 0
  }
  get remaining() {
    return this.bytes.length - this.pos
  }
  u8() {
    return this.bytes[this.pos++]
  }
  u16() {
    return (this.bytes[this.pos++] << 8) | this.bytes[this.pos++]
  }
  /** @param {number} size @returns {bigint} */
  uint(size) {
    let value = 0n
    for (let i = 0; i < size; i++) value = (value << 8n) | BigInt(this.bytes[this.pos++])
    return value
  }
  u64() {
    return this.uint(8)
  }
  /** @param {number} size @returns {string} 0x-prefixed hex of the next `size` bytes */
  hex(size) {
    let out = '0x'
    for (let i = 0; i < size; i++) out += this.bytes[this.pos++].toString(16).padStart(2, '0')
    return out
  }
  /** @returns {string | undefined} 0x-prefixed hex of the unread tail, or undefined if none */
  rest() {
    return this.remaining > 0 ? this.hex(this.remaining) : undefined
  }
}

/** value = coefficient / 10^decimals, rendered without float rounding. @param {bigint} coefficient @param {number | bigint} decimals */
function formatDecimal(coefficient, decimals) {
  const d = BigInt(decimals)
  if (d === 0n) return coefficient.toString()
  const scale = 10n ** d
  const integral = coefficient / scale
  const fractional = (coefficient % scale).toString().padStart(Number(d), '0').replace(/0+$/, '')
  return fractional === '' ? integral.toString() : `${integral}.${fractional}`
}

/** ASCII characters packed into a u64, first character in the lowest byte. @param {bigint} value */
function formatSymbol(value) {
  let name = ''
  for (let v = value; v > 0n; v >>= 8n) {
    const code = Number(v & 0xffn)
    if (code < 0x21 || code > 0x7e) return value.toString() // not printable → show the number
    name += String.fromCharCode(code)
  }
  return name || value.toString()
}

/** @param {bigint} seconds */
function formatTimestamp(seconds) {
  return new Date(Number(seconds) * 1000).toISOString()
}

/** @param {string} address */
const short = (address) => `${address.slice(0, 10)}…`

/** @param {Reader} r */
function readDecimal(r) {
  const coefficient = r.u64()
  const decimals = r.u8()
  return formatDecimal(coefficient, decimals)
}

// ---- Standard Cartesi portal deposit messages (InputEncoding.sol) ----
// Trailing execLayerData / baseLayerData is surfaced as raw hex: it is opaque
// to the portal and, for ERC-721/1155, abi.encoded rather than packed.

/** @param {string} portal @param {Uint8Array} bytes */
function decodePortalDeposit(portal, bytes) {
  const r = new Reader(bytes)
  switch (portal) {
    case 'EtherPortal': {
      if (bytes.length < 52) return null // sender(20) + value(32)
      const sender = r.hex(20)
      const value = r.uint(32)
      const execLayerData = r.rest()
      return {
        summary: `Ether deposit · ${formatDecimal(value, ETHER_DECIMALS)} ETH from ${short(sender)}`,
        data: { portal, sender, ether: formatDecimal(value, ETHER_DECIMALS), wei: value.toString(), execLayerData },
      }
    }
    case 'ERC20Portal': {
      if (bytes.length < 72) return null // token(20) + sender(20) + value(32)
      const token = r.hex(20)
      const sender = r.hex(20)
      const amount = r.uint(32)
      const execLayerData = r.rest()
      return {
        summary: `ERC-20 deposit · ${amount} of ${short(token)} from ${short(sender)}`,
        data: { portal, token, sender, amount: amount.toString(), execLayerData },
      }
    }
    case 'ERC721Portal': {
      if (bytes.length < 72) return null // token(20) + sender(20) + tokenId(32)
      const token = r.hex(20)
      const sender = r.hex(20)
      const tokenId = r.uint(32)
      const data = r.rest()
      return {
        summary: `ERC-721 deposit · #${tokenId} of ${short(token)} from ${short(sender)}`,
        data: { portal, token, sender, tokenId: tokenId.toString(), data },
      }
    }
    case 'ERC1155SinglePortal': {
      if (bytes.length < 104) return null // token(20) + sender(20) + tokenId(32) + value(32)
      const token = r.hex(20)
      const sender = r.hex(20)
      const tokenId = r.uint(32)
      const value = r.uint(32)
      const data = r.rest()
      return {
        summary: `ERC-1155 deposit · ${value}× #${tokenId} of ${short(token)} from ${short(sender)}`,
        data: { portal, token, sender, tokenId: tokenId.toString(), value: value.toString(), data },
      }
    }
    case 'ERC1155BatchPortal': {
      if (bytes.length < 40) return null // token(20) + sender(20)
      const token = r.hex(20)
      const sender = r.hex(20)
      const data = r.rest() // abi.encode(tokenIds, values, baseLayerData, execLayerData)
      return {
        summary: `ERC-1155 batch deposit · ${short(token)} from ${short(sender)}`,
        data: { portal, token, sender, data },
      }
    }
    default:
      return null
  }
}

// ---- Application messages (perp-dex inputs.yaml) ----

/** @param {Uint8Array} bytes */
function decodeApplicationInput(bytes) {
  const r = new Reader(bytes)
  switch (r.u8()) {
    case 0: {
      // FeedPrices
      if (bytes.length < 3) return null
      const count = r.u16()
      if (count < 1 || count > 1024 || bytes.length !== 3 + count * 25) return null
      const prices = []
      for (let i = 0; i < count; i++) {
        prices.push({
          symbol: formatSymbol(r.u64()),
          timestamp: formatTimestamp(r.u64()),
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
      if (bytes.length !== 10) return null
      const amount = readDecimal(r)
      return { summary: `Withdraw · ${amount}`, data: { type: 'Withdraw', amount } }
    }
    case 3: {
      // PlaceOrder
      if (bytes.length !== 31) return null
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
      if (bytes.length !== 9) return null
      const orderId = r.u64().toString()
      return { summary: `CancelOrder · #${orderId}`, data: { type: 'CancelOrder', orderId } }
    }
    default:
      return null
  }
}

/**
 * @param {string} payload
 * @param {{ kind: 'input' | 'output' | 'report', record?: any }} context
 */
export function decode(payload, context) {
  if (context.kind !== 'input') return null // only inputs are documented
  if (!/^0x([0-9a-fA-F]{2})+$/.test(payload)) return null
  const bytes = toBytes(payload)

  // Sender-based dispatch: a known portal means this is an asset deposit,
  // decoded with the canonical Cartesi portal message (not an app message).
  const sender = context.record?.decoded_data?.sender?.toLowerCase()
  const portal = sender && PORTALS[sender]
  if (portal) return decodePortalDeposit(portal, bytes)

  return decodeApplicationInput(bytes)
}
