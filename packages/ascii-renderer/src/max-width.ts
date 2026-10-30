// ============================================================================
// `maxWidth`: hard width limit for ASCII output (#2057, moved from the CLI's
// `--max-width`, #335). Render normally; if too wide, retry once with the
// tightest spacing; if still too wide, throw `AsciiWidthError`. Diagram
// structure is never touched (no wrapping, no direction flip, no truncation).
// ============================================================================

import { displayWidth } from './display-width.ts'
import { stripOsc8 } from './hyperlinks.ts'

/** Tightest spacing tried by the `maxWidth` retry. */
export const COMPACT_SPACING = {
  paddingX: 1,
  paddingY: 1,
  boxBorderPadding: 0,
} as const

/**
 * Thrown when output is still wider than `AsciiRenderOptions.maxWidth` after
 * the compact-spacing retry. Stable `code: 'WIDTH_EXCEEDED'`.
 */
export class AsciiWidthError extends Error {
  readonly code = 'WIDTH_EXCEEDED' as const
  constructor(
    /** Width in terminal columns of the narrowest output produced. */
    readonly actualWidth: number,
    readonly maxWidth: number,
    /** True when the compact-spacing retry ran and was the narrowest output. */
    readonly compactApplied: boolean,
  ) {
    super(
      `ASCII output is ${actualWidth} columns wide, exceeding maxWidth of ${maxWidth}` +
        (compactApplied ? ' (compact spacing already applied)' : ''),
    )
    this.name = 'AsciiWidthError'
  }
}

// SGR color escapes (ansi.ts) and, for colorMode 'html', <span> tags.
const SGR = /\x1b\[[0-9;]*m/g

/** Drop `<...>` runs by scanning (a measuring aid, not a sanitizer). */
function dropTags(s: string): string {
  let out = ''
  let depth = false
  for (const ch of s) {
    if (ch === '<') depth = true
    else if (ch === '>' && depth) depth = false
    else if (!depth) out += ch
  }
  return out
}

/** Widest line in terminal columns, ignoring color codes, OSC 8 links and html tags. */
export function maxLineWidth(rendered: string, html = false): number {
  let w = 0
  for (const line of rendered.split('\n')) {
    const plain = stripOsc8(line.replace(SGR, ''))
    w = Math.max(w, displayWidth(html ? dropTags(plain) : plain))
  }
  return w
}
