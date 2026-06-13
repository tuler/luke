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
