# @tuler/luke-decoder

A small, dependency-free TypeScript toolkit for writing [Cartesi Node Explorer](../../README.md#payload-decoders) payload decoders. It gives you:

- **A fully typed contract** — [`src/types.ts`](src/types.ts) defines `Decoder`, `DecodeContext`, `DecodeResult` and the API record types. The explorer re-exports these same types internally, so the `context.record` your decoder receives is exactly the API record you see in the types. `DecodeContext` is discriminated by `kind`, so narrowing on `context.kind` narrows `context.record` to `Input`, `Output` or `Report`.
- **Standard portal decoding** — [`src/portals.ts`](src/portals.ts) decodes the canonical Cartesi portal deposit messages (Ether, ERC-20, ERC-721, ERC-1155). Asset deposits are identical across every application, so you call `decodePortalInput()` instead of reimplementing the layout.
- **Byte helpers** — [`src/bytes.ts`](src/bytes.ts) provides a big-endian `ByteReader`, `formatUnits`, `toUtf8` and friends for reading packed payloads.

## Writing a decoder

```ts
import { type Decoder, decodePortalInput, ByteReader, formatUnits } from '@tuler/luke-decoder'

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

[`../perp-dex-decoder`](../perp-dex-decoder) is a complete worked example package.

## Loading from GitHub source (no publish)

The simplest way to share a decoder is to skip packaging and point the explorer at its TypeScript source on GitHub — register the file's `github.com` URL or a `gh:owner/repo@ref/path.ts` shorthand on the application's **Overview** page. The explorer routes it through [esm.sh](https://esm.sh), which transpiles the source and resolves this kit on the fly. The repo must be public; for a kit-based decoder to work against the deployed explorer (public `https://esm.sh`), this kit must be on **public npm** (`npm publish` from `dist/`, see below) — locally, verdaccio is enough. See the [explorer README](../../README.md#from-a-github-source-no-publish) for details.

## Building, publishing and serving

To distribute a decoder as a versioned package instead, it is built (`bun build` bundling the package's own code, keeping `@tuler/luke-decoder` as an external dependency), published to a registry, and served to the browser by [esm.sh](https://esm.sh) — which resolves and bundles the `@tuler/luke-decoder` dependency from the same registry on the fly. In this repo a local [verdaccio](https://verdaccio.org) + esm.sh pair does this. From the repo root:

```sh
bun run registry:up        # start verdaccio + esm.sh
bun run publish:packages   # build + publish the kit and example decoders
```

The decoder is then importable at `http://localhost:8080/@tuler/<name>@<version>`; register that URL on the application's **Overview** page in the explorer. esm.sh serves it with CORS enabled.

To ship a decoder elsewhere, publish your package to any npm registry and serve it through a public esm.sh-style CDN, or bundle it to a single self-contained `.js` (`bun build my-decoder.ts --target=browser --format=esm --outfile=my-decoder.js`) and host that file directly.

## Portal addresses

`PORTAL_ADDRESSES` are the deterministic Cartesi Rollups **v2** deployments (identical across chains for a given Rollups version), sourced from `@cartesi/viem` and the rollups-node address book. Apps on the older v1 (sunodo) deployment used different portal addresses.
