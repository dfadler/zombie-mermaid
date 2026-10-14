import type { RenderArgs } from '../cli/parse-args.ts'

/**
 * Collect all write() calls. `output()` joins them as text (the contract
 * every ASCII/SVG/HTML test already relies on); `buffer()` concatenates them
 * as raw bytes instead, for binary (PNG) writes where decoding through a
 * string would corrupt the data.
 */
export function createMockStdout(): {
  write: (s: string | Uint8Array) => void
  output: () => string
  buffer: () => Buffer
} {
  const chunks: Array<string | Uint8Array> = []
  return {
    write: (s: string | Uint8Array) => chunks.push(s),
    output: () =>
      chunks
        .map((c) =>
          typeof c === 'string' ? c : Buffer.from(c).toString('utf-8'),
        )
        .join(''),
    buffer: () =>
      Buffer.concat(
        chunks.map((c) =>
          typeof c === 'string' ? Buffer.from(c, 'utf-8') : c,
        ),
      ),
  }
}

/** Build a RenderArgs for common test scenarios. */
export function renderArgs(overrides: Partial<RenderArgs> = {}): RenderArgs {
  return {
    command: 'render',
    input: undefined,
    ascii: false,
    svg: false,
    resolveColors: false,
    html: false,
    png: false,
    output: undefined,
    force: false,
    theme: undefined,
    paddingX: undefined,
    paddingY: undefined,
    borderPadding: undefined,
    coords: false,
    hyperlinks: false,
    maxWidth: undefined,
    direction: undefined,
    ...overrides,
  }
}
