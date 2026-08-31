import { readFile, writeFile } from 'node:fs/promises'
import {
  renderMermaidASCII,
  diagramColorsToAsciiTheme,
} from '../ascii/index.ts'
import type { AsciiRenderOptions } from '../ascii/index.ts'
import { renderMermaidSVG } from '../index.ts'
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

// Matches SGR color escape sequences (`\x1b[...m`) produced by ansi.ts's
// ansi16/ansi256/truecolor modes. Stripped only for width MEASUREMENT below —
// mirrors the same approach coords.ts uses for its ruler overlay.
const ANSI_ESCAPE = /\x1b\[[0-9;]*m/g

/** Widest line in already-rendered ASCII/Unicode output, ignoring ANSI color codes. */
function maxLineWidth(rendered: string): number {
  return rendered
    .split('\n')
    .reduce((max, line) => Math.max(max, line.replace(ANSI_ESCAPE, '').length), 0)
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
    const ascii = renderMermaidASCII(text, asciiOpts)

    if (args.maxWidth !== undefined) {
      const targetWidth = resolveMaxWidth(args.maxWidth)
      const actualWidth = maxLineWidth(ascii)
      if (actualWidth > targetWidth) {
        const source =
          args.maxWidth === 'auto' ? `detected terminal width` : `--max-width`
        err.write(
          `Warning: ASCII output is ${actualWidth} columns wide, exceeding ` +
            `${source} of ${targetWidth}. zombie-mermaid does not yet reflow ` +
            `diagrams to fit (no compact spacing/label wrapping/direction-flip ` +
            `cascade — see https://github.com/dfadler/zombie-mermaid/issues/335). ` +
            `Try -x/-y/-p to reduce padding, a narrower direction (LR vs TD), or ` +
            `widen your terminal.\n`,
        )
      }
    }

    out.write(ascii + '\n')
  }

  if (args.svg && args.output) {
    const svg = renderMermaidSVG(text, themeColors ?? {})
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
