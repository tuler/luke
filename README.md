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
- [Bun](https://bun.sh) as package manager

## Usage

```sh
bun install
bun dev          # http://localhost:5173
```

Enter the node's JSON-RPC URL in the top bar (default: `http://localhost:10011/rpc`). The URL is persisted in localStorage. The green/red dot shows connectivity, along with the node's chain ID and version. The sun/moon button toggles dark mode (defaults to the OS preference, persisted in localStorage).

The active server is also mirrored into a `?server=` query param on every page, so the address bar is always a shareable link that pins the node, e.g.:

```
https://tuler.github.io/luke/?server=https://my-node.example.com/rpc
```

Opening such a link adopts that server (and saves it as the new default).

> **CORS:** the browser calls the node directly, so the node must allow the explorer's origin. Set `CARTESI_JSONRPC_API_CORS_ALLOWED_ORIGINS` on the node (e.g. `*` for local development).

### Mock server

A mock node with sample data (two applications, epochs, inputs, decoded outputs, and a PRT tournament tree) is included for UI development:

```sh
bun mock/server.ts   # serves http://localhost:10011/rpc with CORS enabled
```

### Production build

```sh
bun run build        # type-checks and bundles into dist/
bun run preview
```

## Payload decoders

Input, output and report payloads are application-specific byte arrays — opaque to the node, and therefore to the explorer, which by default shows them as hex (or UTF-8 when they happen to be text). To make them readable, you can plug in a decoder: an ES module, hosted anywhere, registered per application on the app's **Overview** page. The explorer imports it at runtime — no rebuild needed — and uses it for that application's payload views and table previews, with the raw hex/UTF-8 views still available as toggles. Decoders are stored in localStorage, keyed by application address.

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

For a typed authoring experience, write decoders in TypeScript against the [`decoder-kit/`](decoder-kit/) — a dependency-free toolkit that provides the fully typed contract (`Decoder`, `DecodeContext`, `DecodeResult` and the API record types, so `context.record` is typed per `kind`), standard Cartesi **portal deposit decoding** that every app can reuse instead of reimplementing, and byte-reading helpers:

```ts
import { type Decoder, decodePortalInput, ByteReader, formatUnits } from '../decoder-kit'

export const version = 1
export const name = 'My decoder'

export const decode: Decoder['decode'] = (payload, context) => {
  if (context.kind !== 'input') return null
  const deposit = decodePortalInput(payload, context) // shared across all apps
  if (deposit) return deposit
  // …decode this application's own messages…
}
```

Decoders load as browser ES modules, so compile to a single self-contained `.js` and host it (`bun build my-decoder.ts --target=browser --format=esm --outfile=my-decoder.js`). See [`decoder-kit/README.md`](decoder-kit/README.md) for the full authoring and build workflow.

### Examples

See [`examples/decoder.js`](examples/decoder.js) for a plain-JavaScript example. The mock server serves it at `http://localhost:10011/decoder.js` — register that URL on an application's Overview page to try the full loop. A second example, [`examples/perp-dex-decoder.ts`](examples/perp-dex-decoder.ts), is written in **TypeScript** using the decoder kit; the mock bundles it on the fly and serves it at `http://localhost:10011/perp-dex-decoder.js`. It decodes the packed binary inputs of the mock `perp-dex` application, dispatching on the input *sender*: inputs from a known Cartesi portal address are asset deposits decoded by the kit's shared `decodePortalInput()`, while everything else is an application message (orders, withdrawals, price feeds) decoded by its leading type byte.

On application pages the registered decoder is mirrored into a `?decoder=` query param, so the address bar is a shareable link that carries the decoder along with the node, e.g.:

```
https://tuler.github.io/luke/apps/echo-dapp/inputs?server=…&decoder=https://example.com/decoder.js
```

Requirements and caveats:

- The URL must serve a JavaScript ES module with CORS enabled (`Access-Control-Allow-Origin`).
- When the explorer is served over HTTPS (e.g. GitHub Pages), browsers block `http://` module URLs — use `https://`, or run the explorer locally.
- **A decoder runs with full access to the explorer page. Only register URLs you trust.** Unlike `?server=`, a decoder suggested by a shared link is never adopted silently — a banner asks for confirmation first.
