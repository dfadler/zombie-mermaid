import { readFile, writeFile } from 'node:fs/promises'
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
import type { RenderOptions } from '../types.ts'
import { THEMES } from '../theme.ts'
import type { DiagramColors } from '../theme.ts'
import type { RenderArgs } from './parse-args.ts'

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

  if (args.ascii) {
    // Use plain text by default (respects terminal colors on any background).
    // Only apply ANSI colors when the user explicitly passes --theme.
    const asciiOpts: AsciiRenderOptions = themeColors
      ? { colorMode: 'auto', theme: diagramColorsToAsciiTheme(themeColors) }
      : { colorMode: 'none' }
    if (args.paddingX !== undefined) asciiOpts.paddingX = args.paddingX
    if (args.paddingY !== undefined) asciiOpts.paddingY = args.paddingY
    if (args.borderPadding !== undefined)
      asciiOpts.boxBorderPadding = args.borderPadding
    if (args.coords) asciiOpts.showCoords = true
    if (args.direction !== undefined) asciiOpts.direction = args.direction
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

    out.write(ascii + '\n')
  }

  if (args.svg && args.output) {
    const svgOpts: RenderOptions = { ...themeColors }
    if (args.direction !== undefined) svgOpts.direction = args.direction
    const svg = renderMermaidSVG(text, svgOpts)
    await writeFile(args.output, svg, 'utf-8')
  }
}

// ============================================================================
// Helpers
// ============================================================================

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
