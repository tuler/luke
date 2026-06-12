import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useChainId, useNodeVersion } from '../api/hooks'
import { formatUint } from '../lib/format'
import { useServer } from '../server'

function ServerBar() {
  const { server, setServer } = useServer()
  const [draft, setDraft] = useState(server)
  useEffect(() => setDraft(server), [server])

  const chainId = useChainId()
  const version = useNodeVersion()
  const connected = chainId.isSuccess
  const checking = chainId.isLoading

  return (
    <form
      className="flex flex-1 items-center justify-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setServer(draft)
      }}
    >
      <div className="flex items-center gap-2 text-xs text-slate-300">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            checking ? 'bg-amber-400' : connected ? 'bg-emerald-400' : 'bg-red-500'
          }`}
          title={connected ? 'Connected' : checking ? 'Connecting…' : 'Unreachable'}
        />
        {connected ? (
          <span className="hidden sm:inline whitespace-nowrap">
            chain {formatUint(chainId.data?.data)} · node v{version.data?.data ?? '?'}
          </span>
        ) : (
          <span className="hidden sm:inline">{checking ? 'connecting…' : 'unreachable'}</span>
        )}
      </div>
      <input
        type="url"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setServer(draft)}
        placeholder="http://localhost:10011/rpc"
        spellCheck={false}
        className="w-full max-w-xs rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:outline-2 focus:outline-sky-400 sm:max-w-sm"
        aria-label="JSON-RPC server URL"
      />
    </form>
  )
}

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap">
            <span className="grid h-7 w-7 place-items-center rounded bg-sky-500 font-bold text-white">
              C
            </span>
            <span className="font-semibold tracking-tight">Cartesi Node Explorer</span>
          </Link>
          <ServerBar />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs text-slate-400">
        Cartesi Rollups Node JSON-RPC API v2.0.0 — read-only explorer
      </footer>
    </div>
  )
}
