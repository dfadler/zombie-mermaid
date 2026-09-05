// ============================================================================
// ASCII renderer — OSC 8 terminal hyperlinks (opt-in)
//
// Modern terminals (iTerm2, WezTerm, kitty, Windows Terminal, VTE-based
// terminals such as GNOME Terminal) turn a run of text wrapped in an OSC 8
// escape pair into a clickable link:
//
//   ESC ] 8 ; ; https://example.com ESC \ Docs ESC ] 8 ; ; ESC \
//
// See https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
// for the de-facto spec. The escape sequences are zero-width, so they must
// never take part in layout, column-width math, or box drawing — this module
// records *which canvas cells* carry a link in a `LinkCanvas` (parallel to
// `RoleCanvas`, the same column-major shape) at draw time, and the
// canvas-to-string conversion (`canvasToString` / `colorizeLine`) inserts
// the escape pairs around each run of linked cells as it emits a row.
// Marking cells rather than searching rendered text for the label means a
// label that repeats, or appears inside another label, still links only the
// node that actually declared the `click`.
//
// This is what lets a `click A "https://..."` directive survive into
// terminal output — see docs/decisions/no-script-interactivity.md for where
// that sits in the interactivity tiers. Off by default
// (`AsciiRenderOptions.hyperlinks`): not every terminal or pager handles
// OSC 8 gracefully, and HTML color mode (the demo site's terminal mockup)
// never emits it at all.
// ============================================================================

import type { Canvas, DrawingCoord, AsciiGraph } from './types.ts'
import type { NodeInteraction } from '../types.ts'
import { safeHref } from '../click-directive.ts'

/**
 * [maxX, maxY] of a canvas — the same arithmetic as canvas.ts's
 * `getCanvasSize`, inlined so this module (imported by canvas.ts for
 * `joinWithLinks`) doesn't import canvas.ts back.
 */
function canvasBounds(canvas: Canvas): [number, number] {
  return [canvas.length - 1, (canvas[0]?.length ?? 1) - 1]
}

/**
 * Link canvas — parallel to Canvas, records the href each cell is part of.
 * Same column-major structure: linkCanvas[x][y] gives the href at (x, y).
 * null means the cell is not part of any link.
 */
export type LinkCanvas = (string | null)[][]

/** OSC 8 close sequence (an empty URI ends the current link). */
export const OSC8_CLOSE = '\x1b]8;;\x1b\\'

/**
 * OSC 8 open sequence for `href`.
 *
 * The URI portion is limited to printable ASCII (0x21–0x7E) by the spec
 * linked above — anything else is percent-encoded here so a URL with a
 * non-ASCII path or a literal space can't break the sequence or leak a
 * control character into the terminal stream. `encodeURIComponent` on one
 * code point yields its UTF-8 percent-encoding; the `u` flag keeps a
 * surrogate pair together so it encodes as one code point rather than two
 * lone surrogates (which `encodeURIComponent` would throw on).
 */
export function osc8Open(href: string): string {
  const uri = href.replace(/[^\x21-\x7e]/gu, (ch) => encodeURIComponent(ch))
  return `\x1b]8;;${uri}\x1b\\`
}

/**
 * Matches one OSC 8 sequence — open or close, ST- or BEL-terminated. The
 * URI can never contain ESC or BEL (`osc8Open` percent-encodes anything
 * outside printable ASCII), so scanning to the first terminator is exact.
 */
export const OSC8_SEQUENCE = /\x1b\]8;[^\x07\x1b]*(?:\x1b\\|\x07)/g

/** Remove every OSC 8 sequence, leaving the visible text (and any SGR color codes) intact. */
export function stripOsc8(text: string): string {
  return text.replace(OSC8_SEQUENCE, '')
}

// ============================================================================
// Link canvas creation and marking
// ============================================================================

/**
 * Create a blank link canvas filled with nulls.
 * Dimensions are inclusive, matching `mkCanvas`: mkLinkCanvas(3, 2) covers
 * indices 0..3 by 0..2.
 */
export function mkLinkCanvas(x: number, y: number): LinkCanvas {
  const linkCanvas: LinkCanvas = []
  for (let i = 0; i <= x; i++) {
    const col: (string | null)[] = []
    for (let j = 0; j <= y; j++) {
      col.push(null)
    }
    linkCanvas.push(col)
  }
  return linkCanvas
}

/**
 * Bounds-checked write of an href to one cell. Out-of-range coordinates
 * are a silent no-op, the same contract as `write()` in canvas.ts — the
 * link canvas is created at the finished canvas's size, so a cell outside
 * it can't be printed anyway.
 */
export function setLink(
  linkCanvas: LinkCanvas,
  x: number,
  y: number,
  href: string,
): void {
  const col = linkCanvas[x]
  if (col === undefined || y < 0 || y >= col.length) return
  col[y] = href
}

/**
 * Flip the link canvas vertically to match `flipCanvasVertically` (used for
 * BT direction). Mutates in place and returns it.
 */
export function flipLinkCanvasVertically(linkCanvas: LinkCanvas): LinkCanvas {
  for (const col of linkCanvas) {
    col.reverse()
  }
  return linkCanvas
}

/**
 * Mark the label text inside a drawn box as linked to `href`.
 *
 * `box` is a standalone box canvas (from `drawNode`/`drawMultiBox`) whose
 * border occupies its outermost row and column; `offset` is where its
 * top-left corner lands on the main canvas. For each interior row (or only
 * `rows.from..rows.to`, inclusive, when given — class diagrams pass just
 * the header's class-name rows), the linked span runs from the first to the
 * last non-space cell, so a multi-word label ("Web Server") is one link
 * rather than two, and each line of a multi-line label becomes its own
 * span. A row with no text is left unmarked.
 *
 * Working from the box's own geometry (rather than scanning the merged
 * canvas for the label's characters) is what keeps this exact for labels
 * that repeat across nodes, contain box-drawing-like punctuation, or hold
 * wide characters whose placeholder cell (`WIDE_CHAR_PLACEHOLDER`) is an
 * empty string rather than a space.
 */
export function markBoxLabelLinks(
  linkCanvas: LinkCanvas,
  box: Canvas,
  offset: DrawingCoord,
  href: string,
  rows?: { from: number; to: number },
): void {
  const [maxX, maxY] = canvasBounds(box)
  const firstRow = Math.max(1, rows?.from ?? 1)
  const lastRow = Math.min(maxY - 1, rows?.to ?? maxY - 1)

  for (let y = firstRow; y <= lastRow; y++) {
    let first = -1
    let last = -1
    for (let x = 1; x <= maxX - 1; x++) {
      if (box[x]?.[y] !== ' ') {
        if (first === -1) first = x
        last = x
      }
    }
    if (first === -1) continue
    for (let x = first; x <= last; x++) {
      setLink(linkCanvas, x + offset.x, y + offset.y, href)
    }
  }
}

/**
 * Build the link canvas for a drawn flowchart/state graph: every node whose
 * `click` declared a safe href (see `safeHref` — `javascript:`/`data:` and
 * the like are dropped there, never here) gets its label cells marked. A
 * `call`/`callback`-only interaction has no href and marks nothing.
 *
 * Must run after `drawGraph` (so every node has its `drawing` and
 * `drawingCoord`) and before any BT flip of the canvas — flip this canvas
 * alongside it with `flipLinkCanvasVertically`.
 */
export function buildNodeLinkCanvas(
  graph: AsciiGraph,
  interactions: ReadonlyMap<string, NodeInteraction>,
): LinkCanvas {
  const [maxX, maxY] = canvasBounds(graph.canvas)
  const linkCanvas = mkLinkCanvas(maxX, maxY)

  for (const node of graph.nodes) {
    if (!node.drawing || !node.drawingCoord) continue
    const href = safeHref(interactions.get(node.name)?.href)
    if (href === undefined) continue
    markBoxLabelLinks(linkCanvas, node.drawing, node.drawingCoord, href)
  }

  return linkCanvas
}

// ============================================================================
// Emitting link runs while serializing a row
// ============================================================================

/**
 * Tracks the link state across one row's cells and hands back the escape
 * text to insert before each cell: a close when leaving a linked run, an
 * open when entering one (both when two different links touch), and
 * nothing while the state is unchanged. `finish()` closes a run still open
 * at the end of the row.
 *
 * The markers are pure insertions into the character stream — the SGR
 * color grouping in `colorizeLine` is left exactly as it would be without
 * links — so stripping every OSC 8 sequence from hyperlinked output yields
 * the non-hyperlinked output byte for byte.
 */
export class LinkRunTracker {
  private current: string | null = null

  /** Escape text to emit before a cell carrying `link` (null = no link). */
  advance(link: string | null): string {
    if (link === this.current) return ''
    let out = this.current !== null ? OSC8_CLOSE : ''
    if (link !== null) out += osc8Open(link)
    this.current = link
    return out
  }

  /** Escape text to emit after the row's last cell. */
  finish(): string {
    const out = this.current !== null ? OSC8_CLOSE : ''
    this.current = null
    return out
  }
}

/** Join a row's cells into plain (uncolored) text with OSC 8 pairs around each linked run. */
export function joinWithLinks(
  chars: readonly string[],
  links: readonly (string | null)[],
): string {
  const tracker = new LinkRunTracker()
  let line = ''
  for (const [i, char] of chars.entries()) {
    line += tracker.advance(links[i] ?? null) + char
  }
  return line + tracker.finish()
}
