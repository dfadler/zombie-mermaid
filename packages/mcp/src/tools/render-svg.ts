// ============================================================================
// zombie-mermaid MCP server — `render_mermaid_svg` tool
//
// Thin MCP adapter around the library's own renderMermaidSVG(). No new
// rendering logic lives here — this only maps a validated tool call onto
// RenderOptions and back onto an MCP CallToolResult.
// ============================================================================

import { z } from 'zod'
import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  lstatSync,
  openSync,
  realpathSync,
  writeSync,
} from 'node:fs'
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { THEMES } from '@zombie-mermaid/core'
import type { DiagramColors } from '@zombie-mermaid/core'

/**
 * Narrow a string array to zod's required non-empty-tuple shape without an
 * `as` assertion. `THEMES` always has entries (it's a populated module-level
 * const), but `Object.keys()` returns a plain `string[]` the type system
 * can't statically know is non-empty.
 */
function toNonEmptyStringTuple(values: string[]): [string, ...string[]] {
  const [first, ...rest] = values
  if (first === undefined) {
    throw new Error('Expected at least one built-in theme to be registered')
  }
  return [first, ...rest]
}

const themeNames = toNonEmptyStringTuple(Object.keys(THEMES))

const baseShape = {
  diagram: z
    .string()
    .min(1, 'diagram must not be empty')
    .describe(
      'Mermaid diagram source text, e.g. "graph TD\\n  A --> B". Supports ' +
        'flowcharts, state diagrams, sequence diagrams, class diagrams, ER ' +
        'diagrams, and XY charts.',
    ),
  theme: z
    .enum(themeNames)
    .optional()
    .describe(`Built-in theme name. One of: ${themeNames.join(', ')}`),
  transparent: z
    .boolean()
    .optional()
    .describe(
      'Render with a transparent background instead of the theme background color. Default: false.',
    ),
  font: z
    .string()
    .optional()
    .describe('Font family for diagram text. Default: "Inter".'),
}

/** `#rgb` or `#rrggbb` — the forms the renderer's color math accepts. */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export const renderSvgInputShape = {
  ...baseShape,
  bg: z
    .string()
    .regex(HEX_COLOR, 'bg must be a hex color like #fff or #1a1b26')
    .optional()
    .describe(
      'Background color override as hex (#rgb or #rrggbb). Applied on top ' +
        'of the theme.',
    ),
  fg: z
    .string()
    .regex(HEX_COLOR, 'fg must be a hex color like #000 or #c0caf5')
    .optional()
    .describe(
      'Foreground/text color override as hex (#rgb or #rrggbb). Applied on ' +
        'top of the theme.',
    ),
  outputPath: z
    .string()
    .min(1, 'outputPath must not be empty')
    .optional()
    .describe(
      'Write the SVG to this file instead of returning it, and return ' +
        '{ saved, size } (absolute path, bytes). Must end in .svg and ' +
        "resolve inside the MCP server's working directory; the parent " +
        'directory must already exist; symlinks and non-regular files are ' +
        'refused. An existing .svg file at the path is overwritten.',
    ),
}

export interface RenderSvgToolArgs {
  diagram: string
  theme?: string | undefined
  transparent?: boolean | undefined
  font?: string | undefined
  bg?: string | undefined
  fg?: string | undefined
  outputPath?: string | undefined
}

/**
 * True if `target` is `base` itself or lies beneath it. Uses `relative()` so
 * `..` traversal and sibling-prefix tricks (`/work` vs `/work-evil`) both fail.
 */
function isInside(base: string, target: string): boolean {
  const rel = relative(base, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Writes every byte of `bytes` to `fd` from position 0, continuing after a
 * short write and throwing if a write makes no progress, so a full disk can't
 * leave a truncated SVG that is reported as saved. `write` is injectable for tests.
 */
export function writeAll(
  fd: number,
  bytes: Buffer,
  write: typeof writeSync = writeSync,
): void {
  let offset = 0
  while (offset < bytes.length) {
    const written = write(fd, bytes, offset, bytes.length - offset, offset)
    if (written === 0) throw new Error('SVG write made no progress')
    offset += written
  }
}

/**
 * Write `svg` to `outputPath` under the server's working directory, or throw
 * a descriptive Error. Safety model (all checks run before any byte is
 * written):
 *
 *  1. The path is resolved to absolute against `process.cwd()` and must end
 *     in `.svg` (case-insensitive).
 *  2. It must lie inside the real (symlink-resolved) working directory, after
 *     resolving `..` lexically AND after resolving symlinks on the parent
 *     directory, so a symlinked directory can't redirect the write elsewhere.
 *  3. The parent directory must already exist (nothing is created).
 *  4. The file itself is opened with `O_NOFOLLOW`, so a symlink at the final
 *     component is refused even if swapped in after the check; an existing
 *     target must be a regular file (never a directory, FIFO, device, ...)
 *     and is only truncated after that `fstat` confirms it.
 */
export function writeSvgFile(
  outputPath: string,
  svg: string,
): { saved: string; size: number } {
  const base = realpathSync(process.cwd())
  const target = resolve(base, outputPath)
  if (extname(target).toLowerCase() !== '.svg') {
    throw new Error('outputPath must end in .svg')
  }
  if (!isInside(base, target)) {
    throw new Error(
      'outputPath must resolve inside the MCP server working directory',
    )
  }
  let realParent: string
  try {
    realParent = realpathSync(dirname(target))
  } catch {
    throw new Error('outputPath parent directory does not exist')
  }
  if (!isInside(base, realParent)) {
    throw new Error(
      'outputPath resolves outside the working directory via a symlink',
    )
  }
  const finalPath = resolve(realParent, basename(target))
  try {
    if (lstatSync(finalPath).isSymbolicLink()) {
      throw new Error('outputPath must not be a symlink')
    }
  } catch (err) {
    if (!(err instanceof Error && 'code' in err && err.code === 'ENOENT')) {
      throw err
    }
  }
  const fd = openSync(
    finalPath,
    // O_NONBLOCK keeps a FIFO with no reader from blocking this synchronous
    // open (and the whole server); the `fstat` check below then rejects it.
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_NOFOLLOW |
      constants.O_NONBLOCK,
    0o644,
  )
  try {
    if (!fstatSync(fd).isFile()) {
      throw new Error('outputPath exists and is not a regular file')
    }
    ftruncateSync(fd, 0)
    const bytes = Buffer.from(svg, 'utf8')
    writeAll(fd, bytes)
    return { saved: finalPath, size: bytes.length }
  } finally {
    closeSync(fd)
  }
}

/**
 * MCP tool handler for `render_mermaid_svg`. Renders Mermaid source to a
 * self-contained SVG string (or, with `outputPath`, a `{ saved, size }` JSON
 * report after writing it to disk), returned as `text` content — SVG is XML text,
 * not the raster image the `image` content type expects.
 *
 * Catches rendering errors (e.g. invalid Mermaid syntax) and returns them
 * as an MCP tool error result (`isError: true`) instead of throwing, so a
 * bad diagram from the caller surfaces as a normal tool response rather
 * than a protocol-level failure.
 */
export function renderSvgHandler(input: RenderSvgToolArgs): CallToolResult {
  try {
    const themeColors: DiagramColors | undefined = input.theme
      ? THEMES[input.theme]
      : undefined
    const svg = renderMermaidSVG(input.diagram, {
      ...themeColors,
      transparent: input.transparent,
      font: input.font,
      // Only set when provided so an absent override never clobbers the theme.
      ...(input.bg !== undefined ? { bg: input.bg } : {}),
      ...(input.fg !== undefined ? { fg: input.fg } : {}),
    })
    if (input.outputPath !== undefined) {
      const saved = writeSvgFile(input.outputPath, svg)
      return { content: [{ type: 'text', text: JSON.stringify(saved) }] }
    }
    return { content: [{ type: 'text', text: svg }] }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to render diagram to SVG: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    }
  }
}
