// ============================================================================
// zombie-mermaid CLI — argument parser
//
// Zero dependencies, hand-rolled — kept consistent with the library's own
// "no external dependencies" philosophy.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export interface RenderArgs {
  command: 'render'
  input: string | undefined
  ascii: boolean
  svg: boolean
  output: string | undefined
  theme: string | undefined
  paddingX: number | undefined
  paddingY: number | undefined
  borderPadding: number | undefined
  coords: boolean
  /**
   * Target width (terminal columns) to check ASCII output against.
   * `'auto'` resolves to the current terminal's column count at render time
   * (falling back to a fixed default when not running in a TTY).
   * A positive integer is used as-is. `undefined` (the default) means no
   * width check is performed.
   */
  maxWidth: number | 'auto' | undefined
}

export interface SimpleCommand {
  command: 'themes' | 'help' | 'version'
}

export interface WebArgs {
  command: 'web'
  port: number
}

export type CliArgs = RenderArgs | SimpleCommand | WebArgs

/** Default port for `zombie-mermaid web` when `--port` isn't given. */
export const DEFAULT_WEB_PORT = 3000

// ============================================================================
// Parser
// ============================================================================

export function parseArgs(argv: string[]): CliArgs {
  const [first, ...rest] = argv

  // Empty args → help
  if (first === undefined) {
    return { command: 'help' }
  }

  // Top-level flags (before any command)
  if (first === '--help' || first === '-h') {
    return { command: 'help' }
  }
  if (first === '--version' || first === '-v') {
    return { command: 'version' }
  }

  // Simple commands
  if (first === 'themes') {
    return { command: 'themes' }
  }

  // Render command
  if (first === 'render') {
    return parseRender(rest)
  }

  // Web command
  if (first === 'web') {
    return parseWeb(rest)
  }

  throw new Error(`Unknown command: ${first}`)
}

// ============================================================================
// render sub-parser
// ============================================================================

/** Parse a numeric flag's value, throwing a clear error if it's missing or invalid. */
function parseNonNegativeIntFlag(
  args: string[],
  i: number,
  flag: string,
): number {
  const raw = args[i + 1]
  if (i + 1 >= args.length || raw === undefined) {
    throw new Error(`${flag} requires a numeric value`)
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${flag} requires a non-negative integer, got: "${raw}"`)
  }
  return Number(raw)
}

/**
 * Parse `-w`/`--max-width`'s value: either the literal `auto` or a positive
 * integer (0 is rejected — a zero-width terminal can't fit anything, so it's
 * almost certainly a mistake rather than an intentional value).
 */
function parseMaxWidthFlag(
  args: string[],
  i: number,
  flag: string,
): number | 'auto' {
  const raw = args[i + 1]
  if (i + 1 >= args.length || raw === undefined) {
    throw new Error(`${flag} requires a value ("auto" or a positive integer)`)
  }
  if (raw === 'auto') {
    return 'auto'
  }
  const value = Number(raw)
  if (!/^\d+$/.test(raw) || value === 0 || !Number.isSafeInteger(value)) {
    throw new Error(
      `${flag} requires "auto" or a positive integer, got: "${raw}"`,
    )
  }
  return value
}

function parseRender(args: string[]): RenderArgs {
  let input: string | undefined
  let ascii = false
  let svg = false
  let output: string | undefined
  let theme: string | undefined
  let paddingX: number | undefined
  let paddingY: number | undefined
  let borderPadding: number | undefined
  let coords = false
  let maxWidth: number | 'auto' | undefined

  let i = 0
  while (i < args.length) {
    const arg = args[i]
    // `i < args.length` (the loop condition) guarantees this is defined —
    // but that's bounds-vs-loop-variable reasoning the type checker can't
    // verify, so guard explicitly rather than asserting past it.
    if (arg === undefined) {
      throw new Error(
        `parseArgs: index ${i} out of range while parsing arguments`,
      )
    }

    if (arg === '--ascii') {
      ascii = true
      i++
    } else if (arg === '--svg') {
      svg = true
      i++
    } else if (arg === '-o' || arg === '--output') {
      if (i + 1 >= args.length) throw new Error('-o requires a file path')
      output = args[i + 1]
      i += 2
    } else if (arg === '--theme') {
      if (i + 1 >= args.length) throw new Error('--theme requires a theme name')
      theme = args[i + 1]
      i += 2
    } else if (arg === '-x' || arg === '--paddingX') {
      paddingX = parseNonNegativeIntFlag(args, i, arg)
      i += 2
    } else if (arg === '-y' || arg === '--paddingY') {
      paddingY = parseNonNegativeIntFlag(args, i, arg)
      i += 2
    } else if (arg === '-p' || arg === '--borderPadding') {
      borderPadding = parseNonNegativeIntFlag(args, i, arg)
      i += 2
    } else if (arg === '--coords') {
      coords = true
      i++
    } else if (arg === '-w' || arg === '--max-width') {
      maxWidth = parseMaxWidthFlag(args, i, arg)
      i += 2
    } else if (!arg.startsWith('-')) {
      // Positional argument = input file
      if (input !== undefined) {
        throw new Error(
          `Unexpected argument: ${arg} (input file already set to "${input}")`,
        )
      }
      input = arg
      i++
    } else {
      throw new Error(`Unknown flag: ${arg}`)
    }
  }

  // Validation
  if (!ascii && !svg) {
    throw new Error('Specify --ascii and/or --svg -o <path>')
  }

  if (svg && output === undefined) {
    throw new Error('--svg requires -o <path>')
  }

  if (maxWidth !== undefined && !ascii) {
    throw new Error('-w/--max-width requires --ascii')
  }

  return {
    command: 'render',
    input,
    ascii,
    svg,
    output,
    theme,
    paddingX,
    paddingY,
    borderPadding,
    coords,
    maxWidth,
  }
}

// ============================================================================
// web sub-parser
// ============================================================================

function parseWeb(args: string[]): WebArgs {
  let port = DEFAULT_WEB_PORT

  let i = 0
  while (i < args.length) {
    const arg = args[i]
    if (arg === undefined) {
      throw new Error(
        `parseArgs: index ${i} out of range while parsing arguments`,
      )
    }

    if (arg === '--port') {
      port = parseNonNegativeIntFlag(args, i, arg)
      i += 2
    } else {
      throw new Error(`Unknown flag: ${arg}`)
    }
  }

  return { command: 'web', port }
}
