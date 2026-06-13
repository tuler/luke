// Public contract implemented by payload decoder modules.
//
// A decoder is a remote ES module registered per application (by URL) that
// translates that application's opaque payload bytes into readable data.
// See examples/decoder.js for a reference implementation.

/** Payload kinds a decoder may be asked to handle. */
export type PayloadKind = 'input' | 'output' | 'report'

export interface DecodeContext {
  kind: PayloadKind
  /** Application contract address, lowercase "0x…" hex. */
  application: string
  /** Chain id of the connected node, when known. */
  chainId?: number
  /** Full API record (Input, Output or Report) the payload belongs to. */
  record?: unknown
}

export interface DecodeResult {
  /** One-line human-readable summary, shown in table cells. */
  summary?: string
  /** Structured value for the detail view: a string renders as text, objects/arrays as JSON. */
  data?: unknown
}

export interface DecoderModule {
  /** Interface version; this explorer supports version 1. */
  version: 1
  /** Display name shown in the registration UI. */
  name?: string
  /**
   * Decodes a hex payload ("0x…"). Return null/undefined when the payload is
   * not recognized — the explorer falls back to its hex/UTF-8 view. Throwing
   * is treated the same, plus an unobtrusive error hint.
   */
  decode(
    payload: string,
    context: DecodeContext,
  ): DecodeResult | null | undefined | Promise<DecodeResult | null | undefined>
}
