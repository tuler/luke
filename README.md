# Cartesi Node Explorer

A web UI for navigating the entities exposed by the [Cartesi Rollups Node JSON-RPC API](https://github.com/cartesi/rollups-node) (v2.0.0, current alpha release). It follows the natural hierarchy of the API:

```
Node
└── Applications
    ├── Epochs ──────────────► Inputs · Outputs · Reports · Tournaments (per epoch)
    ├── Inputs ──────────────► Outputs · Reports (per input)
    ├── Outputs (Notice / Voucher / DelegateCallVoucher, decoded)
    ├── Reports
    └── Tournaments (PRT) ───► Commitments · Matches ─► Match advances
                               └── Child tournaments (recursive)
```

Every list is paginated, sortable, and filterable (epoch, input, sender, output type, voucher address, status, …), and filters are kept in the URL so any view is shareable. Detail pages cross-link related entities — e.g. an epoch links to its inputs, an input to the outputs and reports it produced, an epoch under dispute to its tournament.

## Stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev)
- [TanStack Query](https://tanstack.com/query) for data fetching/caching
- [React Router](https://reactrouter.com) for navigation
- [Tailwind CSS 4](https://tailwindcss.com) for styling
- [Bun](https://bun.sh) workspaces (monorepo)

## Repository layout

A Bun workspace under `packages/`:

| Package | Path | Description |
| --- | --- | --- |
| `@tuler/luke-webapp` | [`packages/webapp`](packages/webapp) | the explorer (React/Vite app) |
| `@tuler/luke-decoder` | [`packages/decoder-kit`](packages/decoder-kit) | typed toolkit for writing payload decoders |
| `@tuler/luke-perp-dex-decoder` | [`packages/perp-dex-decoder`](packages/perp-dex-decoder) | example decoder (TypeScript, uses the kit) |
| `@tuler/luke-json-decoder` | [`packages/json-decoder`](packages/json-decoder) | example decoder (plain JS) |
| `@tuler/luke-mock` | [`packages/mock`](packages/mock) | mock JSON-RPC node for development |

[`infra/`](infra) holds the local package registry (verdaccio) and module CDN (esm.sh) used to publish and serve decoders — see [Payload decoders](#payload-decoders).

## Usage

```sh
bun install
bun run dev      # explorer at http://localhost:5173
```

Enter the node's JSON-RPC URL in the top bar (default: `http://localhost:10011/rpc`). The URL is persisted in localStorage. The green/red dot shows connectivity, along with the node's chain ID and version. The sun/moon button toggles dark mode (defaults to the OS preference, persisted in localStorage).

The active server is also mirrored into a `?server=` query param on every page, so the address bar is always a shareable link that pins the node, e.g.:

```
https://tuler.github.io/luke/?server=https://my-node.example.com/rpc
```

Opening such a link adopts that server (and saves it as the new default).

> **CORS:** the browser calls the node directly, so the node must allow the explorer's origin. Set `CARTESI_JSONRPC_API_CORS_ALLOWED_ORIGINS` on the node (e.g. `*` for local development).

### Mock server

A mock node with sample data (three applications — including `perp-dex` with packed binary inputs — epochs, inputs, decoded outputs, and a PRT tournament tree) is included for UI development:

```sh
bun run mock         # serves http://localhost:10011/rpc with CORS enabled
```

### Production build

```sh
bun run build        # type-checks and bundles the webapp into packages/webapp/dist
bun --filter @tuler/luke-webapp preview
```

## Payload decoders

Input, output and report payloads are application-specific byte arrays — opaque to the node, and therefore to the explorer, which by default shows them as hex (or UTF-8 when they happen to be text). To make them readable, you can plug in a decoder: an ES module — or a TypeScript source file on GitHub (see [From a GitHub source](#from-a-github-source-no-publish)) — registered per application on the app's **Overview** page. The explorer imports it at runtime — no rebuild needed — and uses it for that application's payload views and table previews, with the raw hex/UTF-8 views still available as toggles. Decoders are stored in localStorage, keyed by application address.

A decoder module implements this interface (version 1):

```js
export const version = 1          // required
export const name = 'My decoder'  // optional, shown in the UI

// Called for every payload of the application. May be async.
// Return null/undefined when the payload is not recognized — the explorer
// falls back to its hex/UTF-8 view. Same when decode() throws.
export function decode(payload, context) {
  // payload: hex byte string, e.g. "0x7b22…"
  // context: {
  //   kind: 'input' | 'output' | 'report',
  //   application: '0x…',  // application contract address (lowercase)
  //   chainId?: number,    // chain id of the connected node
  //   record?: object,     // the full API record the payload belongs to
  // }
  return {
    summary: 'transfer · amount 120',           // one line, shown in tables
    data: { action: 'transfer', amount: 120 },  // detail view: string → text,
  }                                             //   object/array → JSON
}
```

### TypeScript and the decoder kit

For a typed authoring experience, write decoders in TypeScript against [`@tuler/luke-decoder`](packages/decoder-kit) — a dependency-free toolkit that provides the fully typed contract (`Decoder`, `DecodeContext`, `DecodeResult` and the API record types, so `context.record` is typed per `kind`), standard Cartesi **portal deposit decoding** that every app can reuse instead of reimplementing, and byte-reading helpers:

```ts
import { type Decoder, decodePortalInput, ByteReader, formatUnits } from '@tuler/luke-decoder'

export const version = 1
export const name = 'My decoder'

export const decode: Decoder['decode'] = (payload, context) => {
  if (context.kind !== 'input') return null
  const deposit = decodePortalInput(payload, context) // shared across all apps
  if (deposit) return deposit
  // …decode this application's own messages…
}
```

The example decoders live in their own packages: [`packages/json-decoder`](packages/json-decoder) (plain JS) and [`packages/perp-dex-decoder`](packages/perp-dex-decoder) (TypeScript, using the kit). The perp-dex decoder reads the packed binary inputs of the mock `perp-dex` application, dispatching on the input *sender*: inputs from a known Cartesi portal address are asset deposits decoded by the kit's shared `decodePortalInput()`, while everything else is an application message (orders, withdrawals, price feeds) decoded by its leading type byte. See [`packages/decoder-kit/README.md`](packages/decoder-kit/README.md) for the authoring guide.

### From a GitHub source (no publish)

The quickest way to share a decoder is to skip packaging entirely and point the explorer straight at its TypeScript source on GitHub. Register either the file's `github.com` URL (the one in your browser's address bar, or behind the **Raw** button) or a `gh:` shorthand:

```
https://github.com/owner/repo/blob/main/src/decoder.ts
gh:owner/repo@main/src/decoder.ts
```

The explorer rewrites these to the [esm.sh](https://esm.sh) `/gh/` route, which fetches the file from the repo, transpiles the TypeScript, and resolves its `@tuler/luke-decoder` dependency — all on the fly, so there is nothing to build or publish. For example, register this repo's own perp-dex decoder against the mock `perp-dex` application:

```
https://github.com/tuler/luke/blob/main/packages/perp-dex-decoder/src/index.ts
```

The esm.sh used for this defaults to the local self-hosted one (`http://localhost:8080`, started by `registry:up`) in development and the public `https://esm.sh` in a production build; set `VITE_ESM_BASE` to override it. Notes:

- The repo (and the file) must be **public** — esm.sh fetches it anonymously.
- Pin a tag or commit (`@v0.1.0`, `@<sha>`) instead of a branch for a stable, reproducible reference.
- A decoder that imports `@tuler/luke-decoder` needs the kit available on the registry esm.sh resolves from: the local verdaccio in development (after `publish:packages`), or **public npm** for the deployed explorer over `https://esm.sh` — see [the kit README](packages/decoder-kit/README.md#building-publishing-and-serving). Decoders with no kit dependency (plain JS, or self-contained) work over public esm.sh immediately.

### Publishing and serving decoders locally

Decoders load as browser ES modules from a URL. Rather than hosting files by hand, the repo runs a local npm registry ([verdaccio](https://verdaccio.org)) that the decoder packages are published to, and a self-hosted [esm.sh](https://esm.sh) that serves any published package to the browser as an ES module (resolving its dependency on `@tuler/luke-decoder` from the same registry):

```sh
bun run registry:up        # start verdaccio (:4873) + esm.sh (:8080) via docker
bun run publish:packages   # build + publish the kit and example packages to verdaccio
# …work with the explorer…
bun run registry:down      # stop and wipe the registry
```

The published decoder is then importable at, e.g., `http://localhost:8080/@tuler/luke-perp-dex-decoder@0.1.0`. Register that URL on the application's **Overview** page in the explorer (or pass it as `?decoder=`) to try the full loop.

On application pages the registered decoder is mirrored into a `?decoder=` query param, so the address bar is a shareable link that carries the decoder along with the node, e.g.:

```
http://localhost:5173/apps/perp-dex/inputs?server=…&decoder=http://localhost:8080/@tuler/luke-perp-dex-decoder@0.1.0
```

Requirements and caveats:

- The URL must serve a JavaScript ES module with CORS enabled (`Access-Control-Allow-Origin`) — esm.sh does this for you.
- When the explorer is served over HTTPS (e.g. GitHub Pages), browsers block `http://` module URLs — use an HTTPS-hosted decoder, or run the explorer locally.
- **A decoder runs with full access to the explorer page. Only register URLs you trust.** Unlike `?server=`, a decoder suggested by a shared link is never adopted silently — a banner asks for confirmation first.
