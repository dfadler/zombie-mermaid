// ============================================================================
// zombie-mermaid CLI — argument parser
//
// Zero dependencies, hand-rolled — kept consistent with the library's own
// "no external dependencies" philosophy.
// ============================================================================

import { extname, format as formatPath, parse as parsePath } from 'node:path'
import { isDirection } from '@zombie-mermaid/core'
import type { Direction } from '@zombie-mermaid/core'

// ============================================================================
// Types
// ============================================================================

export interface RenderArgs {
  command: 'render'
  input: string | undefined
  ascii: boolean
  svg: boolean
  /** `--resolve-colors`: substitute computed sRGB values for CSS var()/color-mix() in SVG output. */
  resolveColors: boolean
  /**
   * `--html`: write a self-contained HTML pan/zoom viewer (see
   * `src/cli/html-viewer.ts`) instead of raw SVG markup. Mutually exclusive
   * with `--svg` in the same invocation — both want the same file-output
   * slot but produce different artifacts, so combining them is a parse
   * error rather than a silent pick.
   */
  html: boolean
  /**
   * `--png`: rasterize to PNG via the optional `@resvg/resvg-js` native
   * dependency (see `src/cli/png.ts`), at the SVG's own declared pixel
   * dimensions — no scaling. Colors are always resolved first (as if
   * `--resolve-colors` were passed): a rasterizer can't evaluate CSS
   * `var()`/`color-mix()`, so skipping that step would render the whole
   * theme black (GitHub issue #456). Mutually exclusive with `--svg`/
   * `--html` — all three want the same file-output slot.
   */
  png: boolean
  /**
   * Destination for the invocation's *file* output (SVG, HTML, or PNG when
   * `--svg`/`--html`/`--png` is set, otherwise ASCII): a path, or
   * `STDOUT_OUTPUT` (`-`) for stdout. `undefined` means "nothing goes to a
   * file" — only possible for ASCII-only runs, since `--svg`/`--html`/
   * `--png` without `-o` derives a path from the input file name at parse
   * time (see `parseRender`).
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
   * `--hyperlinks`: emit OSC 8 terminal hyperlinks for `click` hrefs in
   * ASCII output (see `AsciiRenderOptions.hyperlinks`). Off by default —
   * the flag is the explicit opt-in; no terminal capability detection.
   */
  hyperlinks: boolean
  /**
   * Target width (terminal columns) to check ASCII output against.
   * `'auto'` resolves to the current terminal's column count at render time
   * (falling back to a fixed default when not running in a TTY).
   * A positive integer is used as-is. `undefined` (the default) means no
   * width check is performed.
   */
  maxWidth: number | 'auto' | undefined
  /**
   * Layout direction override (`--direction`), already upper-cased and
   * validated. Passed straight through as `RenderOptions.direction` /
   * `AsciiRenderOptions.direction`; `undefined` (the default) keeps the
   * diagram's own direction.
   */
  direction: Direction | undefined
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
export const OUTPUT_EXTENSIONS: Readonly<
  Record<string, 'svg' | 'ascii' | 'html' | 'png'>
> = {
  '.svg': 'svg',
  '.txt': 'ascii',
  '.html': 'html',
  '.htm': 'html',
  '.png': 'png',
}

/** Format implied by `output`'s extension, or undefined when unrecognised (or stdout). */
export function inferOutputFormat(
  output: string | undefined,
): 'svg' | 'ascii' | 'html' | 'png' | undefined {
  if (output === undefined || output === STDOUT_OUTPUT) return undefined
  return OUTPUT_EXTENSIONS[extname(output).toLowerCase()]
}

/**
 * The three artifact formats that share the single `-o` file-output slot
 * (as opposed to `ascii`, which prints to the terminal and can coexist with
 * any one of these). Centralizing flag/extension/label here is what lets
 * `parseRender`'s exclusivity and inference checks below stay one small
 * loop instead of growing a new hand-written pairwise `if` for every format
 * this CLI adds.
 */
const FILE_FORMATS = {
  svg: {
    flag: '--svg',
    ext: '.svg',
    article: 'a',
    display: 'SVG',
    label: 'raw SVG output',
  },
  html: {
    flag: '--html',
    ext: '.html',
    article: 'an',
    display: 'HTML',
    label: 'the HTML viewer',
  },
  png: {
    flag: '--png',
    ext: '.png',
    article: 'a',
    display: 'PNG',
    label: 'the PNG rasterization',
  },
} as const satisfies Record<
  'svg' | 'html' | 'png',
  { flag: string; ext: string; article: string; display: string; label: string }
>

type FileFormat = keyof typeof FILE_FORMATS
const FILE_FORMAT_KEYS = Object.keys(FILE_FORMATS) as FileFormat[]

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

/**
 * Parse `--direction`'s value: one of the Mermaid direction tokens, accepted
 * case-insensitively (the same leniency a `graph lr` header gets from the
 * parser) and normalized to the upper-case `Direction` the renderers take.
 */
function parseDirectionFlag(
  args: string[],
  i: number,
  flag: string,
): Direction {
  const raw = args[i + 1]
  if (i + 1 >= args.length || raw === undefined) {
    throw new Error(`${flag} requires a value (one of TD, TB, BT, LR, RL)`)
  }
  const upper = raw.toUpperCase()
  if (!isDirection(upper)) {
    throw new Error(`${flag} requires one of TD, TB, BT, LR, RL, got: "${raw}"`)
  }
  return upper
}

function parseRender(args: string[]): RenderArgs {
  let input: string | undefined
  let ascii = false
  let svg = false
  let resolveColors = false
  let html = false
  let png = false
  let output: string | undefined
  let force = false
  let theme: string | undefined
  let paddingX: number | undefined
  let paddingY: number | undefined
  let borderPadding: number | undefined
  let coords = false
  let hyperlinks = false
  let maxWidth: number | 'auto' | undefined
  let direction: Direction | undefined

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
    } else if (arg === '--resolve-colors') {
      resolveColors = true
      i++
    } else if (arg === '--html') {
      html = true
      i++
    } else if (arg === '--png') {
      png = true
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
    } else if (arg === '--hyperlinks') {
      hyperlinks = true
      i++
    } else if (arg === '-w' || arg === '--max-width') {
      maxWidth = parseMaxWidthFlag(args, i, arg)
      i += 2
    } else if (arg === '--direction') {
      direction = parseDirectionFlag(args, i, arg)
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

  const fileFlags: Record<FileFormat, boolean> = { svg, html, png }

  // 0. --svg/--html/--png all want the single file-output slot below but
  //    produce different artifacts — no single -o path can hold more than
  //    one, so setting two is a parse error rather than a silent pick. Run
  //    the command twice (with different -o paths) for multiple outputs
  //    from one input.
  const explicitlySet = FILE_FORMAT_KEYS.filter((key) => fileFlags[key])
  if (explicitlySet.length > 1) {
    const [a, b] = explicitlySet as [FileFormat, FileFormat]
    throw new Error(
      `${FILE_FORMATS[a].flag} and ${FILE_FORMATS[b].flag} cannot both be set — they would write different content to the same output path. Run the command twice with different -o paths for each.`,
    )
  }

  // 1. A recognised `-o` extension is additive: `-o out.svg` implies --svg,
  //    `-o out.png` implies --png, etc. `.txt` implies --ascii, but only
  //    when svg/html/png isn't also headed for that same path — that
  //    combination is a conflict, not an inference.
  const inferred = inferOutputFormat(output)
  if (inferred !== undefined && inferred !== 'ascii') {
    const conflictingKey = FILE_FORMAT_KEYS.find(
      (key) => key !== inferred && fileFlags[key],
    )
    if (conflictingKey !== undefined) {
      const wanted = FILE_FORMATS[inferred]
      const conflicting = FILE_FORMATS[conflictingKey]
      throw new Error(
        `-o ${output} has ${wanted.article} ${wanted.ext} extension, but ${conflicting.flag} output would be written to it. ` +
          `Use a ${conflicting.ext} path (or -o - for stdout) for ${conflicting.label}.`,
      )
    }
    if (inferred === 'svg') svg = true
    else if (inferred === 'html') html = true
    else png = true
  } else if (inferred === 'ascii') {
    const conflictingKey = FILE_FORMAT_KEYS.find((key) => fileFlags[key])
    if (conflictingKey !== undefined) {
      const conflicting = FILE_FORMATS[conflictingKey]
      throw new Error(
        `-o ${output} has a .txt extension, but ${conflicting.flag} output would be written to it. ` +
          `Use a ${conflicting.ext} path (or -o - for stdout) instead.`,
      )
    }
    ascii = true
  }

  // 2. Something must be produced.
  if (!ascii && !svg && !html && !png) {
    if (output !== undefined && output !== STDOUT_OUTPUT) {
      const known = Object.keys(OUTPUT_EXTENSIONS).join(', ')
      throw new Error(
        `Cannot infer an output format from "${output}" — pass --ascii, --svg, --html, or --png, ` +
          `or use a recognised extension (${known})`,
      )
    }
    throw new Error(
      'Specify --ascii, --svg, --html, and/or --png (or -o <path> with a .svg/.txt/.html/.png extension)',
    )
  }

  // 3. stdout can carry one stream. ASCII always prints there unless it is
  //    the sole format and -o names a file, so `--ascii --svg -o -` (or
  //    `--ascii --html -o -`/`--ascii --png -o -`) would interleave two
  //    documents.
  const resolvedFileFlags: Record<FileFormat, boolean> = { svg, html, png }
  const fileFormat = FILE_FORMAT_KEYS.find((key) => resolvedFileFlags[key])
  if (output === STDOUT_OUTPUT && ascii && fileFormat !== undefined) {
    const display = FILE_FORMATS[fileFormat].display
    throw new Error(
      `-o - would send both ASCII and ${display} to stdout; drop --ascii, or write the ${display} to a file path`,
    )
  }

  // 4. --svg/--html/--png without -o: derive <input stem>.svg/.html/.png.
  //    Stdin has no name to derive from, so that case must say where
  //    output goes.
  if (fileFormat !== undefined && output === undefined) {
    const { flag, ext } = FILE_FORMATS[fileFormat]
    if (input === undefined) {
      throw new Error(
        `${flag} needs -o <path> (or -o - for stdout) when reading from stdin — there is no input file name to derive an output name from`,
      )
    }
    output = defaultOutputPath(input, ext)
  }

  if (maxWidth !== undefined && !ascii) {
    throw new Error('-w/--max-width requires --ascii')
  }

  if (hyperlinks && !ascii) {
    throw new Error('--hyperlinks requires --ascii')
  }

  if (resolveColors && !svg) {
    throw new Error('--resolve-colors requires --svg')
  }

  return {
    command: 'render',
    input,
    ascii,
    svg,
    resolveColors,
    html,
    png,
    output,
    force,
    theme,
    paddingX,
    paddingY,
    borderPadding,
    coords,
    hyperlinks,
    maxWidth,
    direction,
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
