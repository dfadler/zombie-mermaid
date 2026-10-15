import { access, readFile, writeFile } from 'node:fs/promises'
import {
  renderMermaidASCII,
  diagramColorsToAsciiTheme,
  AsciiWidthError,
} from '@zombie-mermaid/ascii-renderer'
import type { AsciiRenderOptions } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '../index.ts'
import type { RenderOptions, DiagramColors } from '@zombie-mermaid/core'
import { THEMES } from '@zombie-mermaid/core'
import { withSourceLine } from './diagnostics.ts'
import { buildHtmlViewer } from './html-viewer.ts'
import { renderPng } from './png.ts'
import type { RenderArgs } from './parse-args.ts'
import { STDOUT_OUTPUT } from './parse-args.ts'
import { parse as parsePath } from 'node:path'

// ============================================================================
// Types
// ============================================================================

export interface Writable {
  write: (s: string | Uint8Array) => void
}

/** Fallback target width when `--max-width auto` can't detect a real terminal column count. */
const DEFAULT_AUTO_MAX_WIDTH = 80

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
 */
export async function runRender(
  args: RenderArgs,
  stdout?: Writable,
  stdinContent?: string,
): Promise<void> {
  const out = stdout ?? process.stdout

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

  if (text.trim().length === 0) {
    throw new Error('Empty input — provide a Mermaid diagram via file or stdin')
  }

  try {
    await renderText(args, text, out)
  } catch (e) {
    throw withSourceLine(e, text)
  }
}

async function renderText(
  args: RenderArgs,
  text: string,
  out: Writable,
): Promise<void> {
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
  // unless it is the only format and -o names a file; SVG/HTML/PNG go to -o,
  // which may be stdout (`-`). parse-args guarantees --svg/--html/--png are
  // never set more than one at a time, and that ASCII never shares stdout
  // with any of them.
  const svgToStdout = args.svg && args.output === STDOUT_OUTPUT
  const htmlToStdout = args.html && args.output === STDOUT_OUTPUT
  const pngToStdout = args.png && args.output === STDOUT_OUTPUT
  const asciiFile =
    args.ascii &&
    !args.svg &&
    !args.html &&
    !args.png &&
    args.output !== undefined &&
    args.output !== STDOUT_OUTPUT
      ? args.output
      : undefined
  const svgFile = args.svg && !svgToStdout ? args.output : undefined
  const htmlFile = args.html && !htmlToStdout ? args.output : undefined
  const pngFile = args.png && !pngToStdout ? args.output : undefined

  // Refuse to clobber before doing any work, so a refused run leaves
  // stdout untouched too (no half-printed ASCII ahead of the error).
  for (const path of [asciiFile, svgFile, htmlFile, pngFile]) {
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
    if (args.profile !== undefined) asciiOpts.profile = args.profile
    if (args.direction !== undefined) asciiOpts.direction = args.direction
    // Only for terminal output: a .txt file gets no escape codes regardless
    // (same contract as the ANSI color guard above), so OSC 8 hyperlink
    // sequences must never be written into a file target.
    if (args.hyperlinks && asciiFile === undefined) asciiOpts.hyperlinks = true
    if (args.maxWidth !== undefined)
      asciiOpts.maxWidth = resolveMaxWidth(args.maxWidth)
    let ascii: string
    try {
      ascii = renderMermaidASCII(text, asciiOpts)
    } catch (e) {
      if (!(e instanceof AsciiWidthError)) throw e
      const source =
        args.maxWidth === 'auto' ? 'detected terminal width' : '--max-width'
      throw new Error(
        `ASCII output is ${e.actualWidth} columns wide, exceeding ${source} ` +
          `of ${e.maxWidth}. ${e.compactApplied ? 'Compact spacing (-x 1 -y 1 -p 0) was already applied. ' : ''}` +
          `zombie-mermaid does not reflow diagram structure to fit (no label ` +
          `wrapping or direction-flip cascade). ` +
          (e.compactApplied
            ? 'Try a narrower direction (LR vs TD), shorter labels, or raise the limit.'
            : 'Try -x/-y/-p for tighter spacing, a narrower direction (LR vs TD), or raise the limit.'),
      )
    }

    // ASCII has no "skip" destination (the `if (args.ascii)` guard above
    // already covers "not requested") — it goes to stdout whenever no file
    // was resolved for it, so "going to stdout" is simply "no ascii file".
    await emit(
      resolveTarget(asciiFile === undefined, asciiFile),
      ascii + '\n',
      out,
      args.force,
    )
  }

  if (args.svg) {
    const svgOpts: RenderOptions = {
      ...themeColors,
      resolveColors: args.resolveColors,
    }
    if (args.direction !== undefined) svgOpts.direction = args.direction
    const svg = renderMermaidSVG(text, svgOpts)
    await emit(resolveTarget(svgToStdout, svgFile), svg, out, args.force)
  }

  if (args.html) {
    const svg = renderMermaidSVG(text, themeColors ?? {})
    const title = args.input ? parsePath(args.input).name : undefined
    const html = buildHtmlViewer({ svg, title })
    await emit(resolveTarget(htmlToStdout, htmlFile), html, out, args.force)
  }

  if (args.png) {
    // Rasterizers can't evaluate CSS var()/color-mix(), so PNG always
    // resolves colors first — the equivalent of always passing
    // --resolve-colors — rather than requiring the user to remember it
    // (see issue #456's item 1, which this consumes automatically).
    const svgOpts: RenderOptions = { ...themeColors, resolveColors: true }
    if (args.direction !== undefined) svgOpts.direction = args.direction
    const svg = renderMermaidSVG(text, svgOpts)
    const png = await renderPng(svg)
    await emit(resolveTarget(pngToStdout, pngFile), png, out, args.force)
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Where one rendered format's output goes. Every format in `runRender`
 * (ascii/svg/html/png) reduces to the same three-way choice — stdout, a
 * named file, or nowhere — so the decision is made once here instead of
 * being re-derived per format.
 */
type OutputTarget =
  { kind: 'stdout' } | { kind: 'file'; path: string } | { kind: 'skip' }

/**
 * Decide a format's output target: stdout when `toStdout`, else the given
 * `file` path when one was resolved for it, else skip (the format wasn't
 * requested to go anywhere — see each call site's precomputed booleans).
 */
function resolveTarget(
  toStdout: boolean,
  file: string | undefined,
): OutputTarget {
  if (toStdout) return { kind: 'stdout' }
  if (file !== undefined) return { kind: 'file', path: file }
  return { kind: 'skip' }
}

/** Write `content` to the resolved `target`, or do nothing for `'skip'`. */
async function emit(
  target: OutputTarget,
  content: string | Uint8Array,
  out: Writable,
  force: boolean,
): Promise<void> {
  switch (target.kind) {
    case 'stdout':
      out.write(content)
      break
    case 'file':
      await writeOutputFile(target.path, content, force)
      break
    case 'skip':
      break
  }
}

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
  content: string | Uint8Array,
  force: boolean,
): Promise<void> {
  try {
    await writeFile(path, content, {
      // Ignored by Node when `content` is binary (PNG) — only applies to
      // the string (SVG/HTML/ASCII) case.
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

export async function readStdin(): Promise<string> {
  const chunks: string[] = []
  const stdin = process.stdin
  stdin.setEncoding('utf-8')

  return new Promise((resolve, reject) => {
    stdin.on('data', (chunk: string) => chunks.push(chunk))
    stdin.on('end', () => resolve(chunks.join('')))
    stdin.on('error', reject)
  })
}
