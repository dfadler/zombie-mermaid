// ============================================================================
// zombie-mermaid CLI — argument parser
//
// Zero dependencies, hand-rolled — kept consistent with the library's own
// "no external dependencies" philosophy.
// ============================================================================

import { extname, format as formatPath, parse as parsePath } from 'node:path'

// ============================================================================
// Types
// ============================================================================

export interface RenderArgs {
  command: 'render'
  input: string | undefined
  ascii: boolean
  svg: boolean
  /**
   * Destination for the invocation's *file* output (SVG when `--svg` is
   * set, otherwise ASCII): a path, or `STDOUT_OUTPUT` (`-`) for stdout.
   * `undefined` means "nothing goes to a file" — only possible for
   * ASCII-only runs, since `--svg` without `-o` derives a path from the
   * input file name at parse time (see `parseRender`).
   */
  output: string | undefined
  /** `--force`/`-f`: overwrite an existing output file instead of refusing. */
  force: boolean
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
  command: 'themes' | 'help' | 'version' | 'mcp'
}

export interface WebArgs {
  command: 'web'
  port: number
}

export type CliArgs = RenderArgs | SimpleCommand | WebArgs

/** Default port for `zombie-mermaid web` when `--port` isn't given. */
export const DEFAULT_WEB_PORT = 3000

/** The `-o` value that means "write to stdout instead of a file". */
export const STDOUT_OUTPUT = '-'

/**
 * Output file extensions the `render` command recognises, and the format
 * each implies. Used two ways (see `parseRender`):
 *
 * - **Inference** — `-o out.svg` with no `--svg` flag turns `--svg` on, so
 *   the extension alone is enough to pick a format.
 * - **Conflict detection** — an extension that names a format *other* than
 *   the one `-o` is about to receive is almost certainly a mistake
 *   (`--svg -o out.txt` would write SVG markup into a `.txt`), so it's an
 *   error rather than silently honoured. Unrecognised extensions are left
 *   alone: `--svg -o diagram.xml` writes SVG to `diagram.xml`.
 */
export const OUTPUT_EXTENSIONS: Readonly<Record<string, 'svg' | 'ascii'>> = {
  '.svg': 'svg',
  '.txt': 'ascii',
}

/** Format implied by `output`'s extension, or undefined when unrecognised (or stdout). */
export function inferOutputFormat(
  output: string | undefined,
): 'svg' | 'ascii' | undefined {
  if (output === undefined || output === STDOUT_OUTPUT) return undefined
  return OUTPUT_EXTENSIONS[extname(output).toLowerCase()]
}

/**
 * Default output path for a file format when `-o` is omitted: the input
 * path with its extension swapped (`docs/flow.mmd` → `docs/flow.svg`; an
 * extensionless `flow` → `flow.svg`).
 */
export function defaultOutputPath(input: string, ext: string): string {
  const parsed = parsePath(input)
  return formatPath({ dir: parsed.dir, name: parsed.name, ext })
}

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

  // MCP server command (no flags of its own yet)
  if (first === 'mcp') {
    return { command: 'mcp' }
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
  let force = false
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
      if (i + 1 >= args.length) {
        throw new Error('-o requires a file path (or - for stdout)')
      }
      output = args[i + 1]
      i += 2
    } else if (arg === '-f' || arg === '--force') {
      force = true
      i++
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
    } else if (!arg.startsWith('-') || arg === STDOUT_OUTPUT) {
      // Positional argument = input file. A bare `-` here is *not* stdin
      // (stdin is the no-file default) — reject it like any other stray.
      if (arg === STDOUT_OUTPUT) {
        throw new Error(
          `Unexpected argument: - (use -o - to write output to stdout; omit the input file to read stdin)`,
        )
      }
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

  // ---- Output resolution (see OUTPUT_EXTENSIONS and STDOUT_OUTPUT) ----

  // 1. A recognised `-o` extension is additive: `-o out.svg` implies --svg.
  //    `.txt` implies --ascii, but only when SVG isn't also headed for
  //    that same path — that combination is a conflict, not an inference.
  const inferred = inferOutputFormat(output)
  if (inferred === 'svg') {
    svg = true
  } else if (inferred === 'ascii') {
    if (svg) {
      throw new Error(
        `-o ${output} has a .txt extension, but --svg output would be written to it. ` +
          `Use a .svg path (or -o - for stdout) for SVG output.`,
      )
    }
    ascii = true
  }

  // 2. Something must be produced.
  if (!ascii && !svg) {
    if (output !== undefined && output !== STDOUT_OUTPUT) {
      const known = Object.keys(OUTPUT_EXTENSIONS).join(', ')
      throw new Error(
        `Cannot infer an output format from "${output}" — pass --ascii or --svg, ` +
          `or use a recognised extension (${known})`,
      )
    }
    throw new Error(
      'Specify --ascii and/or --svg (or -o <path> with a .svg/.txt extension)',
    )
  }

  // 3. stdout can carry one stream. ASCII always prints there unless it is
  //    the sole format and -o names a file, so `--ascii --svg -o -` would
  //    interleave two documents.
  if (output === STDOUT_OUTPUT && ascii && svg) {
    throw new Error(
      '-o - would send both ASCII and SVG to stdout; drop --ascii, or write the SVG to a file path',
    )
  }

  // 4. --svg without -o: derive <input stem>.svg. Stdin has no name to
  //    derive from, so that case must say where the SVG should go.
  if (svg && output === undefined) {
    if (input === undefined) {
      throw new Error(
        '--svg needs -o <path> (or -o - for stdout) when reading from stdin — there is no input file name to derive an output name from',
      )
    }
    output = defaultOutputPath(input, '.svg')
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
    force,
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
