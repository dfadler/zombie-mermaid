// ============================================================================
// MermaidParseError — typed carrier for parser failures
//
// `.message` is exactly the string passed in, so existing message-based
// tests and consumers are unaffected. `line` (1-based) is taken from the
// options, or else from a leading "Line N: " in the message, so a throw site
// migrates by swapping `Error` for `MermaidParseError`. All fields optional:
// many throw sites carry no position.
//
// Every parser throw uses this (#1979). svg-renderer's ElkNotRegisteredError
// deliberately does not extend it: a missing peer dependency is not bad input.
// ============================================================================

export interface MermaidParseErrorOptions {
  line?: number
  column?: number
  diagramType?: string
  /** Machine-readable code, e.g. `LIMIT_EXCEEDED`. */
  code?: string
  cause?: unknown
}

const LINE_PREFIX = /^Line (\d+): /

export class MermaidParseError extends Error {
  readonly line?: number
  readonly column?: number
  readonly diagramType?: string
  readonly code?: string

  constructor(message: string, options: MermaidParseErrorOptions = {}) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    )
    this.name = 'MermaidParseError'
    const prefixed = LINE_PREFIX.exec(message)?.[1]
    const line =
      options.line ?? (prefixed === undefined ? undefined : Number(prefixed))
    if (line !== undefined) this.line = line
    if (options.column !== undefined) this.column = options.column
    if (options.diagramType !== undefined)
      this.diagramType = options.diagramType
    if (options.code !== undefined) this.code = options.code
  }
}
