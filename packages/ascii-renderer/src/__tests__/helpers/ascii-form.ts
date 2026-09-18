/**
 * Structural fact extraction for rendered ASCII diagrams — shared by the
 * "form invariant" suites (ascii-sequence-form-invariants.test.ts,
 * ascii-class-box-occupancy.test.ts, ascii-er-box-occupancy.test.ts).
 *
 * These suites assert structural properties of the rendered output (does
 * this box overlap that one, does this label fit inside its container)
 * rather than diffing against a committed fixture. `svg-samples.visual.test.ts`
 * / `ascii-samples.visual.test.ts` only self-diff against their own baseline
 * screenshot, which can never catch a defect that was already present when
 * that baseline was captured — these helpers exist to check the renderer
 * against its own stated semantics instead (e.g. "a box must be wide enough
 * to hold its label", "an unrelated box must never be overwritten").
 *
 * Deliberately works on the *rendered string*, not renderer internals:
 * `renderSequenceAscii`/`renderClassAscii`/`renderErAscii` each do
 * parse→layout→draw→stringify in one function with no layout object
 * exposed, and (checked directly) `src/ascii/er-diagram.ts`'s own occupancy
 * guard (`boxCells`) is a flat, entity-agnostic occupied-cell set — even the
 * renderer's own internals can't answer "which entity owns this cell"
 * without a scan shaped like the one below. Matches this repo's existing
 * convention of small, local, string-based test helpers (see
 * `helpers/terminal-display-width.ts`).
 */

export interface Rect {
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Border-ish characters in both Unicode and `useAscii: true` box-drawing. */
const BORDER_CHARS = new Set([
  '│',
  '┌',
  '└',
  '├',
  '┤',
  '┐',
  '┘',
  '─',
  '┬',
  '┴',
  '┼',
  '+',
  '|',
  '-',
])

function isBorderish(ch: string | undefined): boolean {
  return ch !== undefined && BORDER_CHARS.has(ch)
}

function lineAt(lines: string[], y: number, x: number): string | undefined {
  return lines[y]?.[x]
}

/**
 * Locate a named, bordered box (an actor box, a class box, an entity box) by
 * its header text.
 *
 * Finds the row where `name` sits with a border-ish character immediately to
 * its left and right (skipping padding spaces), *and* a border-ish character
 * directly above that same column (the box's top border or a section
 * divider) — the second check keeps a name that's a substring of another
 * name, or that happens to appear inside an attribute/label string, from
 * false-matching a header row it isn't actually part of. Then walks outward
 * from that row along the left/right border columns until the border stops
 * holding, to find the box's full vertical extent.
 *
 * Works identically in Unicode and `useAscii: true` mode: it only asks "is
 * this column border-ish at this row," never which specific glyph is there.
 */
export function findBoxRect(ascii: string, name: string): Rect {
  const lines = ascii.split('\n')

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y]!
    let searchFrom = 0
    for (;;) {
      const idx = line.indexOf(name, searchFrom)
      if (idx === -1) break
      searchFrom = idx + 1

      let left = idx - 1
      while (left >= 0 && line[left] === ' ') left--
      let right = idx + name.length
      while (right < line.length && line[right] === ' ') right++

      if (!isBorderish(line[left]) || !isBorderish(line[right])) continue
      // Require a border-ish char directly above this header row (top
      // border or a divider) — rejects a match inside a box's body text.
      if (!isBorderish(lineAt(lines, y - 1, left))) continue

      const x0 = left
      const x1 = right

      let y0 = y
      while (
        isBorderish(lineAt(lines, y0 - 1, x0)) &&
        isBorderish(lineAt(lines, y0 - 1, x1))
      ) {
        y0--
      }
      let y1 = y
      while (
        isBorderish(lineAt(lines, y1 + 1, x0)) &&
        isBorderish(lineAt(lines, y1 + 1, x1))
      ) {
        y1++
      }

      return { x0, x1, y0, y1 }
    }
  }

  throw new Error(`findBoxRect: no bordered box found for "${name}"`)
}

/**
 * Locate free-floating text (a relationship label, a note's own text) that
 * isn't itself inside a bordered box header — same row/column scan as
 * `findBoxRect` but without the border precondition. Returns the tightest
 * rectangle containing every occurrence-adjacent character of `text` on its
 * line (just the matched span, not a box).
 */
export function findTextRect(ascii: string, text: string): Rect {
  const lines = ascii.split('\n')
  for (let y = 0; y < lines.length; y++) {
    const idx = lines[y]!.indexOf(text)
    if (idx !== -1) {
      return { x0: idx, x1: idx + text.length - 1, y0: y, y1: y }
    }
  }
  throw new Error(`findTextRect: "${text}" not found`)
}

/** Half-open interval overlap check between two rectangles. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0
}
