import { useState } from 'react'
import { hexByteLength, hexToUtf8 } from '../lib/format'
import { Hex, linkClass } from './ui'

/** Displays a hex byte array with a hex/UTF-8 toggle and byte size. */
export function PayloadView({ value }: { value?: string | null }) {
  const utf8 = hexToUtf8(value)
  const [mode, setMode] = useState<'hex' | 'utf8'>(utf8 !== null ? 'utf8' : 'hex')
  const size = hexByteLength(value)

  if (!value || value === '0x') {
    return <span className="text-sm text-slate-400 dark:text-slate-500">empty (0 bytes)</span>
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{size.toLocaleString()} bytes</span>
        {utf8 !== null && (
          <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
            {(['utf8', 'hex'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 cursor-pointer ${
                  mode === m
                    ? 'bg-sky-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {m === 'utf8' ? 'UTF-8' : 'Hex'}
              </button>
            ))}
          </div>
        )}
        <Copy value={mode === 'utf8' && utf8 !== null ? utf8 : value} />
      </div>
      <pre className="max-h-64 overflow-auto rounded-md bg-slate-50 border border-slate-200 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all font-mono text-slate-800 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200">
        {mode === 'utf8' && utf8 !== null ? utf8 : value}
      </pre>
    </div>
  )
}

function Copy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className={`cursor-pointer ${linkClass}`}
    >
      {copied ? 'copied ✓' : 'copy'}
    </button>
  )
}

/** Short inline preview of a payload for table cells. */
export function PayloadPreview({ value, max = 24 }: { value?: string | null; max?: number }) {
  if (!value || value === '0x') return <span className="text-slate-400 dark:text-slate-500">—</span>
  const utf8 = hexToUtf8(value)
  if (utf8 !== null) {
    const text = utf8.length > max ? utf8.slice(0, max) + '…' : utf8
    return (
      <span className="text-slate-700 dark:text-slate-300" title={utf8}>
        “{text}”
      </span>
    )
  }
  return <Hex value={value} head={10} tail={4} />
}
