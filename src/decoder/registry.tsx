import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'cartesi-explorer.decoders'

/** Decoder module URLs keyed by lowercase application contract address. */
type DecoderUrls = Record<string, string>

interface DecoderContextValue {
  decoders: DecoderUrls
  setDecoder: (application: string, url: string) => void
  removeDecoder: (application: string) => void
}

const DecoderContext = createContext<DecoderContextValue>({
  decoders: {},
  setDecoder: () => {},
  removeDecoder: () => {},
})

export function DecoderProvider({ children }: { children: ReactNode }) {
  const [decoders, setDecoders] = useState<DecoderUrls>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as DecoderUrls
    } catch {
      return {}
    }
  })

  const update = useCallback((mutate: (prev: DecoderUrls) => DecoderUrls) => {
    setDecoders((prev) => {
      const next = mutate(prev)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setDecoder = useCallback(
    (application: string, url: string) => {
      const trimmed = url.trim()
      if (!trimmed) return
      update((prev) => ({ ...prev, [application.toLowerCase()]: trimmed }))
    },
    [update],
  )

  const removeDecoder = useCallback(
    (application: string) => {
      update((prev) => {
        const next = { ...prev }
        delete next[application.toLowerCase()]
        return next
      })
    },
    [update],
  )

  return (
    <DecoderContext.Provider value={{ decoders, setDecoder, removeDecoder }}>
      {children}
    </DecoderContext.Provider>
  )
}

export function useDecoders() {
  return useContext(DecoderContext)
}

/** URL of the decoder registered for an application address, if any. */
export function useDecoderUrl(application?: string): string | undefined {
  const { decoders } = useDecoders()
  return application ? decoders[application.toLowerCase()] : undefined
}
