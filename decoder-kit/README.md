# Decoder Kit

A small, dependency-free TypeScript toolkit for writing [Cartesi Node Explorer](../README.md#payload-decoders) payload decoders. It gives you:

- **A fully typed contract** — [`types.ts`](types.ts) defines `Decoder`, `DecodeContext`, `DecodeResult` and the API record types. The explorer re-exports these same types internally, so the `context.record` your decoder receives is exactly the API record you see in the types. `DecodeContext` is discriminated by `kind`, so narrowing on `context.kind` narrows `context.record` to `Input`, `Output` or `Report`.
- **Standard portal decoding** — [`portals.ts`](portals.ts) decodes the canonical Cartesi portal deposit messages (Ether, ERC-20, ERC-721, ERC-1155). Asset deposits are identical across every application, so you call `decodePortalInput()` instead of reimplementing the layout.
- **Byte helpers** — [`bytes.ts`](bytes.ts) provides a big-endian `ByteReader`, `formatUnits`, `toUtf8` and friends for reading packed payloads.

## Writing a decoder

```ts
import { type Decoder, decodePortalInput, ByteReader, formatUnits } from '../decoder-kit'

export const version = 1
export const name = 'My decoder'

export const decode: Decoder['decode'] = (payload, context) => {
  if (context.kind !== 'input') return null

  // Standard, shared across every app: a deposit from a known portal sender.
  const deposit = decodePortalInput(payload, context)
  if (deposit) return deposit

  // Your application's own messages.
  const r = new ByteReader(payload)
  // …read fields, return { summary, data }, or null when not recognized…
}
```

Return `null`/`undefined` (or throw) when a payload isn't recognized — the explorer falls back to its hex/UTF-8 view.

[`../examples/perp-dex-decoder.ts`](../examples/perp-dex-decoder.ts) is a complete worked example.

## Building and hosting

Decoders are loaded by the explorer at runtime as **browser ES modules**, so compile your TypeScript (and the kit it imports) into a single self-contained `.js` file and host it anywhere that serves it with CORS enabled:

```sh
bun build my-decoder.ts --target=browser --format=esm --outfile=my-decoder.js
# or: esbuild my-decoder.ts --bundle --format=esm --outfile=my-decoder.js
```

Then register the hosted URL on the application's **Overview** page in the explorer.

> The mock server in [`../mock/server.ts`](../mock/server.ts) does exactly this for the perp-dex example: it bundles `examples/perp-dex-decoder.ts` on the fly with `Bun.build` and serves it at `http://localhost:10011/perp-dex-decoder.js`.

## Portal addresses

`PORTAL_ADDRESSES` are the deterministic Cartesi Rollups **v2** deployments (identical across chains for a given Rollups version), sourced from `@cartesi/viem` and the rollups-node address book. Apps on the older v1 (sunodo) deployment used different portal addresses.
