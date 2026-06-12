import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { shortHex } from '../lib/format'

/** Monospace hex value with middle truncation and click-to-copy. */
export function Hex({
  value,
  head = 8,
  tail = 6,
  full = false,
  to,
}: {
  value?: string | null
  head?: number
  tail?: number
  full?: boolean
  to?: string
}) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="text-slate-400">—</span>

  const text = full ? value : shortHex(value, head, tail)
  const inner = to ? (
    <Link to={to} className="text-sky-700 hover:underline">
      {text}
    </Link>
  ) : (
    <span>{text}</span>
  )

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[13px] break-all" title={value}>
      {inner}
      <button
        type="button"
        aria-label="Copy"
        className="text-slate-300 hover:text-slate-600 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? (
          <span className="text-emerald-600 text-xs">✓</span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V2a.5.5 0 0 0-.5-.5H6Z" />
            <path d="M2 5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1H8.5v1a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5h1V5H2Z" />
          </svg>
        )}
      </button>
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  // application
  OK: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  DIVERGED: 'bg-red-100 text-red-800',
  CORRUPTED: 'bg-red-100 text-red-800',
  // epoch
  OPEN: 'bg-sky-100 text-sky-800',
  CLOSED: 'bg-slate-200 text-slate-700',
  INPUTS_PROCESSED: 'bg-indigo-100 text-indigo-800',
  CLAIM_COMPUTED: 'bg-violet-100 text-violet-800',
  CLAIM_SUBMITTED: 'bg-amber-100 text-amber-800',
  CLAIM_STAGED: 'bg-amber-100 text-amber-800',
  CLAIM_ACCEPTED: 'bg-emerald-100 text-emerald-800',
  CLAIM_REJECTED: 'bg-red-100 text-red-800',
  CLAIM_FORECLOSED: 'bg-red-100 text-red-800',
  // input
  NONE: 'bg-slate-200 text-slate-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXCEPTION: 'bg-red-100 text-red-800',
  MACHINE_HALTED: 'bg-red-100 text-red-800',
  OUTPUTS_LIMIT_EXCEEDED: 'bg-amber-100 text-amber-800',
  CYCLE_LIMIT_EXCEEDED: 'bg-amber-100 text-amber-800',
  TIME_LIMIT_EXCEEDED: 'bg-amber-100 text-amber-800',
  PAYLOAD_LENGTH_LIMIT_EXCEEDED: 'bg-amber-100 text-amber-800',
  // match winner / deletion
  ONE: 'bg-emerald-100 text-emerald-800',
  TWO: 'bg-emerald-100 text-emerald-800',
  STEP: 'bg-violet-100 text-violet-800',
  TIMEOUT: 'bg-amber-100 text-amber-800',
  CHILD_TOURNAMENT: 'bg-indigo-100 text-indigo-800',
  NOT_DELETED: 'bg-slate-200 text-slate-700',
}

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-400">—</span>
  const color = STATUS_COLORS[status] ?? 'bg-slate-200 text-slate-700'
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${color}`}
    >
      {status}
    </span>
  )
}

export function Section({
  title,
  actions,
  children,
}: {
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Key/value rows for detail pages. */
export function KV({ rows }: { rows: Array<[ReactNode, ReactNode] | null> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-[max-content_1fr]">
      {rows
        .filter((row): row is [ReactNode, ReactNode] => row !== null)
        .map(([key, value], i) => (
          <div key={i} className="contents">
            <dt className="text-sm text-slate-500">{key}</dt>
            <dd className="text-sm text-slate-900 min-w-0">{value}</dd>
          </div>
        ))}
    </dl>
  )
}

export function Collapsible({
  label,
  children,
  defaultOpen = false,
}: {
  label: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm text-sky-700 hover:underline cursor-pointer"
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}

export function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500 justify-center">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
      {label}
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  )
}

export function EmptyState({ label = 'Nothing found.' }: { label?: string }) {
  return <div className="py-8 text-center text-sm text-slate-400">{label}</div>
}

export function Crumbs({ items }: { items: Array<{ label: ReactNode; to?: string }> }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-300">/</span>}
          {item.to ? (
            <Link to={item.to} className="text-sky-700 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-700 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
