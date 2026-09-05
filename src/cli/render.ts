import { access, readFile, writeFile } from 'node:fs/promises'
import {
  renderMermaidASCII,
  diagramColorsToAsciiTheme,
} from '../ascii/index.ts'
import type { AsciiRenderOptions } from '../ascii/index.ts'
import { displayWidth } from '../ascii/display-width.ts'
import {
  DEFAULT_PADDING_X,
  DEFAULT_PADDING_Y,
  DEFAULT_BOX_BORDER_PADDING,
} from '../ascii/types.ts'
import { renderMermaidSVG } from '../index.ts'
import { THEMES } from '../theme.ts'
import type { DiagramColors } from '../theme.ts'
import { buildHtmlViewer } from './html-viewer.ts'
import type { RenderArgs } from './parse-args.ts'
import { STDOUT_OUTPUT } from './parse-args.ts'
import { parse as parsePath } from 'node:path'

// ============================================================================
// Types
// ============================================================================

export interface Writable {
  write: (s: string) => void
}

/** Fallback target width when `--max-width auto` can't detect a real terminal column count. */
const DEFAULT_AUTO_MAX_WIDTH = 80

// ============================================================================
// --max-width automatic compact-spacing fallback
//
// The smallest correct "make wide output respect the constraint" behavior
// per issue #335: when the diagram exceeds --max-width at its current
// spacing, automatically retry with the tightest spacing the renderer
// supports before giving up. This never touches diagram *structure* (no
// label wrapping, no direction flip, no truncation) — it only tightens the
// gaps around and inside boxes, so it can never corrupt the diagram, only
// shrink it. If the diagram still doesn't fit after compacting, the
// original (or best-effort compacted) output is printed in full, alongside
// a warning — never truncated output.
// ============================================================================

/** Tightest spacing values tried as the automatic --max-width fallback. */
const COMPACT_PADDING_X = 1
const COMPACT_PADDING_Y = 1
const COMPACT_BOX_BORDER_PADDING = 0

// Matches SGR color escape sequences (`\x1b[...m`) produced by ansi.ts's
// ansi16/ansi256/truecolor modes. Stripped only for width MEASUREMENT below —
// mirrors the same approach coords.ts uses for its ruler overlay.
const ANSI_ESCAPE = /\x1b\[[0-9;]*m/g

/** Widest line in already-rendered ASCII/Unicode output, ignoring ANSI color codes. */
function maxLineWidth(rendered: string): number {
  return rendered
    .split('\n')
    .reduce(
      (max, line) => Math.max(max, displayWidth(line.replace(ANSI_ESCAPE, ''))),
      0,
    )
}

/**
 * Resolve `--max-width`'s target column count.
 * `'auto'` reads the live terminal width (`process.stdout.columns`), falling
 * back to `DEFAULT_AUTO_MAX_WIDTH` when not running in a TTY (piped output,
 * CI, etc. — where there's no real terminal to fit).
 */
function resolveMaxWidth(maxWidth: number | 'auto'): number {
  if (maxWidth !== 'auto') return maxWidth
  return process.stdout.columns ?? DEFAULT_AUTO_MAX_WIDTH
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Execute the `render` command.
 *
 * @param args - Parsed CLI arguments (command === 'render')
 * @param stdout - Writable stream for ASCII output (defaults to process.stdout)
 * @param stdinContent - Pre-read stdin content for testing; if undefined and
 *   no file input, reads from process.stdin at runtime
 * @param stderr - Writable stream for warnings, e.g. `--max-width` overflow
 *   (defaults to process.stderr)
 */
export async function runRender(
  args: RenderArgs,
  stdout?: Writable,
  stdinContent?: string,
  stderr?: Writable,
): Promise<void> {
  const out = stdout ?? process.stdout
  const err = stderr ?? process.stderr

  let text: string

  if (args.input !== undefined) {
    text = await readFile(args.input, 'utf-8')
  } else if (stdinContent !== undefined) {
    text = stdinContent
  } else {
    if (process.stdin.isTTY) {
      throw new Error(
        'No input file specified and stdin is a terminal. Pipe a diagram or pass a file path.',
      )
    }
    text = await readStdin()
  }

  text = text.trim()
  if (text.length === 0) {
    throw new Error('Empty input — provide a Mermaid diagram via file or stdin')
  }

  let themeColors: DiagramColors | undefined

  if (args.theme !== undefined) {
    themeColors = THEMES[args.theme]
    if (themeColors === undefined) {
      const available = Object.keys(THEMES).join(', ')
      throw new Error(
        `Unknown theme: "${args.theme}". Available themes: ${available}`,
      )
    }
  }

  // Where each format goes (see RenderArgs.output). ASCII prints to stdout
  // unless it is the only format and -o names a file; SVG/HTML go to -o,
  // which may be stdout (`-`). parse-args guarantees --svg and --html are
  // never both set, and that ASCII never shares stdout with either.
  const svgToStdout = args.svg && args.output === STDOUT_OUTPUT
  const htmlToStdout = args.html && args.output === STDOUT_OUTPUT
  const asciiFile =
    args.ascii &&
    !args.svg &&
    !args.html &&
    args.output !== undefined &&
    args.output !== STDOUT_OUTPUT
      ? args.output
      : undefined
  const svgFile = args.svg && !svgToStdout ? args.output : undefined
  const htmlFile = args.html && !htmlToStdout ? args.output : undefined

  // Refuse to clobber before doing any work, so a refused run leaves
  // stdout untouched too (no half-printed ASCII ahead of the error).
  for (const path of [asciiFile, svgFile, htmlFile]) {
    if (path !== undefined) await assertNotExisting(path, args.force)
  }

  if (args.ascii) {
    // Use plain text by default (respects terminal colors on any background).
    // Only apply ANSI colors when the user explicitly passes --theme — and
    // only for terminal output: a .txt file gets no escape codes regardless.
    const asciiOpts: AsciiRenderOptions =
      themeColors && asciiFile === undefined
        ? { colorMode: 'auto', theme: diagramColorsToAsciiTheme(themeColors) }
        : { colorMode: 'none' }
    if (args.paddingX !== undefined) asciiOpts.paddingX = args.paddingX
    if (args.paddingY !== undefined) asciiOpts.paddingY = args.paddingY
    if (args.borderPadding !== undefined)
      asciiOpts.boxBorderPadding = args.borderPadding
    if (args.coords) asciiOpts.showCoords = true
    let ascii = renderMermaidASCII(text, asciiOpts)

    if (args.maxWidth !== undefined) {
      const targetWidth = resolveMaxWidth(args.maxWidth)
      let actualWidth = maxLineWidth(ascii)
      let compactApplied = false

      if (actualWidth > targetWidth) {
        const currentPaddingX = asciiOpts.paddingX ?? DEFAULT_PADDING_X
        const currentPaddingY = asciiOpts.paddingY ?? DEFAULT_PADDING_Y
        const currentBorderPadding =
          asciiOpts.boxBorderPadding ?? DEFAULT_BOX_BORDER_PADDING
        const compactPaddingX = Math.min(currentPaddingX, COMPACT_PADDING_X)
        const compactPaddingY = Math.min(currentPaddingY, COMPACT_PADDING_Y)
        const compactBorderPadding = Math.min(
          currentBorderPadding,
          COMPACT_BOX_BORDER_PADDING,
        )
        // Only retry if compacting would actually tighten something — e.g.
        // an explicit -x/-y/-p already at or below compact levels has
        // nothing left to give.
        const canCompact =
          compactPaddingX < currentPaddingX ||
          compactPaddingY < currentPaddingY ||
          compactBorderPadding < currentBorderPadding

        if (canCompact) {
          const compactAscii = renderMermaidASCII(text, {
            ...asciiOpts,
            paddingX: compactPaddingX,
            paddingY: compactPaddingY,
            boxBorderPadding: compactBorderPadding,
          })
          const compactWidth = maxLineWidth(compactAscii)
          if (compactWidth < actualWidth) {
            ascii = compactAscii
            actualWidth = compactWidth
            compactApplied = true
          }
        }
      }

      if (actualWidth > targetWidth) {
        const source =
          args.maxWidth === 'auto' ? `detected terminal width` : `--max-width`
        const compactNote = compactApplied
          ? `Compact spacing (-x ${COMPACT_PADDING_X} -y ${COMPACT_PADDING_Y} ` +
            `-p ${COMPACT_BOX_BORDER_PADDING}) was already applied ` +
            `automatically. `
          : ''
        const suggestion = compactApplied
          ? 'Try a narrower direction (LR vs TD), shorter labels, or widen your terminal.'
          : 'Try -x/-y/-p for tighter spacing, a narrower direction (LR vs TD), or widen your terminal.'
        err.write(
          `Warning: ASCII output is ${actualWidth} columns wide, exceeding ` +
            `${source} of ${targetWidth}. ${compactNote}zombie-mermaid does ` +
            `not reflow diagram structure to fit (no label wrapping or ` +
            `direction-flip cascade — see ` +
            `https://github.com/dfadler/zombie-mermaid/issues/335). ` +
            `${suggestion}\n`,
        )
      } else if (compactApplied) {
        err.write(
          `Note: ASCII output exceeded ${targetWidth} columns at the ` +
            `requested spacing; applied compact spacing automatically ` +
            `(-x ${COMPACT_PADDING_X} -y ${COMPACT_PADDING_Y} -p ` +
            `${COMPACT_BOX_BORDER_PADDING}) to fit.\n`,
        )
      }
    }

    if (asciiFile !== undefined) {
      await writeOutputFile(asciiFile, ascii + '\n', args.force)
    } else {
      out.write(ascii + '\n')
    }
  }

  if (args.svg) {
    const svg = renderMermaidSVG(text, themeColors ?? {})
    if (svgToStdout) {
      out.write(svg)
    } else if (svgFile !== undefined) {
      await writeOutputFile(svgFile, svg, args.force)
    }
  }

  if (args.html) {
    const svg = renderMermaidSVG(text, themeColors ?? {})
    const title = args.input ? parsePath(args.input).name : undefined
    const html = buildHtmlViewer({ svg, title })
    if (htmlToStdout) {
      out.write(html)
    } else if (htmlFile !== undefined) {
      await writeOutputFile(htmlFile, html, args.force)
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function overwriteRefusal(path: string): Error {
  return new Error(
    `Refusing to overwrite existing file "${path}" — pass --force to replace it`,
  )
}

/** Fail early if `path` already exists and `--force` wasn't given. */
async function assertNotExisting(path: string, force: boolean): Promise<void> {
  if (force) return
  let exists = true
  try {
    await access(path)
  } catch {
    exists = false
  }
  if (exists) throw overwriteRefusal(path)
}

/**
 * Write an output file, refusing to replace an existing one unless `force`.
 * `assertNotExisting` already ran before rendering; the exclusive-create
 * flag (`wx`) closes the window between that check and this write, so a
 * file that appears in between is still refused rather than clobbered.
 */
async function writeOutputFile(
  path: string,
  content: string,
  force: boolean,
): Promise<void> {
  try {
    await writeFile(path, content, {
      encoding: 'utf-8',
      flag: force ? 'w' : 'wx',
    })
  } catch (err) {
    if (
      !force &&
      err instanceof Error &&
      'code' in err &&
      err.code === 'EEXIST'
    ) {
      throw overwriteRefusal(path)
    }
    throw err
  }
}

async function readStdin(): Promise<string> {
  const chunks: string[] = []
  const stdin = process.stdin
  stdin.setEncoding('utf-8')

  return new Promise((resolve, reject) => {
    stdin.on('data', (chunk: string) => chunks.push(chunk))
    stdin.on('end', () => resolve(chunks.join('')))
    stdin.on('error', reject)
  })
}
