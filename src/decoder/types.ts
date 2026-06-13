// The contract implemented by payload decoder modules. Defined canonically in
// the decoder-kit (which is also what decoder authors write against), and
// re-exported here so the explorer and authors share one source of truth.
// See decoder-kit/ and examples/ for reference implementations.

export type {
  PayloadKind,
  DecodeContext,
  DecodeResult,
  Decoder,
  // Back-compat alias for the historical name used inside the explorer.
  Decoder as DecoderModule,
} from '../../decoder-kit/types'
