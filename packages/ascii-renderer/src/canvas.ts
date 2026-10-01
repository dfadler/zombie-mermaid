// ============================================================================
// ASCII renderer — 2D text canvas
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/draw.go.
// The canvas is a column-major 2D array of single-character strings.
// canvas[x][y] gives the character at column x, row y.
// ============================================================================

import type {
  Canvas,
  DrawingCoord,
  RoleCanvas,
  LabelRect,
  CharRole,
  AsciiTheme,
  ColorMode,
} from './types.ts'
import { colorizeLine, DEFAULT_ASCII_THEME } from './ansi.ts'
import { toDisplayCells, WIDE_CHAR_PLACEHOLDER } from './display-width.ts'
import { joinWithLinks } from './hyperlinks.ts'
import type { LinkCanvas } from './hyperlinks.ts'

/**
 * Create a blank canvas filled with spaces.
 * Dimensions are inclusive: mkCanvas(3, 2) creates a 4x3 grid (indices 0..3, 0..2).
 */
export function mkCanvas(x: number, y: number): Canvas {
  const canvas: Canvas = []
  for (let i = 0; i <= x; i++) {
    const col: string[] = []
    for (let j = 0; j <= y; j++) {
      col.push(' ')
    }
    canvas.push(col)
  }
  return canvas
}

/** Create a blank canvas with the same dimensions as the given canvas. */
export function copyCanvas(source: Canvas): Canvas {
  const [maxX, maxY] = getCanvasSize(source)
  return mkCanvas(maxX, maxY)
}

// ============================================================================
// Role canvas creation and management
// ============================================================================

/**
 * Create a blank role canvas filled with nulls.
 * Same dimensions as mkCanvas — column-major, roleCanvas[x][y].
 */
export function mkRoleCanvas(x: number, y: number): RoleCanvas {
  const roleCanvas: RoleCanvas = []
  for (let i = 0; i <= x; i++) {
    const col: (CharRole | null)[] = []
    for (let j = 0; j <= y; j++) {
      col.push(null)
    }
    roleCanvas.push(col)
  }
  return roleCanvas
}

/** Create a blank role canvas with the same dimensions as the given role canvas. */
export function copyRoleCanvas(source: RoleCanvas): RoleCanvas {
  const maxX = source.length - 1
  const maxY = (source[0]?.length ?? 1) - 1
  return mkRoleCanvas(maxX, maxY)
}

/**
 * Grow the role canvas to fit at least (newX, newY), preserving existing roles.
 * Mutates the role canvas in place and returns it.
 */
export function increaseRoleCanvasSize(
  roleCanvas: RoleCanvas,
  newX: number,
  newY: number,
): RoleCanvas {
  const currX = roleCanvas.length - 1
  const currY = (roleCanvas[0]?.length ?? 1) - 1
  const targetX = Math.max(newX, currX)
  const targetY = Math.max(newY, currY)
  const grown = mkRoleCanvas(targetX, targetY)
  for (let x = 0; x < grown.length; x++) {
    for (let y = 0; y < (grown[0]?.length ?? 0); y++) {
      if (x < roleCanvas.length && y < (roleCanvas[0]?.length ?? 0)) {
        grown[x]![y] = roleCanvas[x]![y]!
      }
    }
  }
  roleCanvas.length = 0
  roleCanvas.push(...grown)
  return roleCanvas
}

/**
 * Set a role at a specific coordinate.
 * Expands the role canvas if necessary.
 */
export function setRole(
  roleCanvas: RoleCanvas,
  x: number,
  y: number,
  role: CharRole,
): void {
  if (x >= roleCanvas.length || y >= (roleCanvas[0]?.length ?? 0)) {
    increaseRoleCanvasSize(roleCanvas, x, y)
  }
  roleCanvas[x]![y] = role
}

/**
 * Merge role canvases — same logic as mergeCanvases but for roles.
 * Non-null roles in overlays overwrite null roles in base.
 */
export function mergeRoleCanvases(
  base: RoleCanvas,
  offset: DrawingCoord,
  ...overlays: RoleCanvas[]
): RoleCanvas {
  let maxX = base.length - 1
  let maxY = (base[0]?.length ?? 1) - 1

  for (const overlay of overlays) {
    const oX = overlay.length - 1
    const oY = (overlay[0]?.length ?? 1) - 1
    maxX = Math.max(maxX, oX + offset.x)
    maxY = Math.max(maxY, oY + offset.y)
  }

  const merged = mkRoleCanvas(maxX, maxY)

  // Copy base
  for (let x = 0; x <= maxX; x++) {
    for (let y = 0; y <= maxY; y++) {
      if (x < base.length && y < (base[0]?.length ?? 0)) {
        merged[x]![y] = base[x]![y]!
      }
    }
  }

  // Apply overlays
  for (const overlay of overlays) {
    for (let x = 0; x < overlay.length; x++) {
      for (let y = 0; y < (overlay[0]?.length ?? 0); y++) {
        const role = overlay[x]?.[y]
        if (role !== null && role !== undefined) {
          const mx = x + offset.x
          const my = y + offset.y
          merged[mx]![my] = role
        }
      }
    }
  }

  return merged
}

/** Returns [maxX, maxY] — the highest valid indices in each dimension. */
export function getCanvasSize(canvas: Canvas): [number, number] {
  return [canvas.length - 1, (canvas[0]?.length ?? 1) - 1]
}

/**
 * Grow the canvas to fit at least (newX, newY), preserving existing content.
 * Mutates the canvas in place and returns it.
 */
export function increaseSize(
  canvas: Canvas,
  newX: number,
  newY: number,
): Canvas {
  const [currX, currY] = getCanvasSize(canvas)
  const targetX = Math.max(newX, currX)
  const targetY = Math.max(newY, currY)
  const grown = mkCanvas(targetX, targetY)
  for (let x = 0; x < grown.length; x++) {
    for (let y = 0; y < (grown[0]?.length ?? 0); y++) {
      if (x < canvas.length && y < (canvas[0]?.length ?? 0)) {
        grown[x]![y] = canvas[x]![y]!
      }
    }
  }
  // Mutate in place: splice old contents and replace with grown
  canvas.length = 0
  canvas.push(...grown)
  return canvas
}

/**
 * Bounds-checked write to a single canvas cell.
 *
 * Sets the character at (x, y) if the coordinate falls within the canvas;
 * out-of-range coordinates are silently clipped (a no-op) instead of
 * mutating the canvas. This is the single write path drawing modules should
 * use instead of indexing `canvas[x]![y] = ch` directly, which had three
 * different out-of-range behaviors depending on axis — none of them a clean
 * bounds check:
 *   - x out of range: threw, via the `canvas[x]!` non-null assertion.
 *   - y too large (but x in range): did *not* throw — JS silently
 *     ragged-extends that column's array. This was observable downstream:
 *     `mergeCanvases`/`canvasToString` would read the extended slot back as
 *     `undefined`, which `canvasToString` then concatenates into the output
 *     as the literal string `"undefined"`.
 *   - y negative (but x in range): silently set an own property keyed by
 *     the negative index (e.g. `arr[-1]`) rather than a real array element;
 *     rendering code never reads it back, so this was a silent no-op.
 * `write()` normalizes all three cases to the same silent no-op. That is a
 * behavior *change*, not a preservation of the prior status quo — callers
 * migrating to `write()` need their own bounds check if they relied on the
 * old per-axis behavior (see `drawSubgraphLabel` in `draw-subgraphs.ts`,
 * which needs a tighter, exclusive bound than `write()`'s own clip to avoid
 * overwriting a subgraph's border with an oversized title).
 *
 * When `roleTracking` is provided, the role is recorded via `setRole`
 * alongside the character write (used by callers, like the sequence-diagram
 * and xychart renderers, that track character roles inline rather than
 * deriving them from the finished canvas afterward). `role` and
 * `roleCanvas` are bundled into one parameter so a call can't pass one
 * without the other — passing just a role with nowhere to record it would
 * otherwise type-check while silently dropping the role, an error only
 * visible in colorized/ANSI output.
 */
export function write(
  canvas: Canvas,
  x: number,
  y: number,
  ch: string,
  roleTracking?: { role: CharRole; roleCanvas: RoleCanvas },
): void {
  const [maxX, maxY] = getCanvasSize(canvas)
  if (x < 0 || x > maxX || y < 0 || y > maxY) return
  canvas[x]![y] = ch
  if (roleTracking) {
    setRole(roleTracking.roleCanvas, x, y, roleTracking.role)
  }
}

// ============================================================================
// Junction merging — Unicode box-drawing character compositing
// ============================================================================

/** All Unicode box-drawing characters that participate in junction merging. */
const JUNCTION_CHARS = new Set([
  '─',
  '│',
  '┌',
  '┐',
  '└',
  '┘',
  '├',
  '┤',
  '┬',
  '┴',
  '┼',
  '╴',
  '╵',
  '╶',
  '╷',
])

export function isJunctionChar(c: string): boolean {
  return JUNCTION_CHARS.has(c)
}

/** Check if a character is alphanumeric (part of a label). */
function isAlphanumeric(c: string): boolean {
  return /^[a-zA-Z0-9]$/.test(c)
}

/**
 * When two junction characters overlap during canvas merging,
 * resolve them to the correct combined junction.
 * E.g., '─' overlapping '│' becomes '┼'.
 */
const JUNCTION_MAP: Record<string, Record<string, string>> = {
  '─': {
    '│': '┼',
    '┌': '┬',
    '┐': '┬',
    '└': '┴',
    '┘': '┴',
    '├': '┼',
    '┤': '┼',
    '┬': '┬',
    '┴': '┴',
  },
  '│': {
    '─': '┼',
    '┌': '├',
    '┐': '┤',
    '└': '├',
    '┘': '┤',
    '├': '├',
    '┤': '┤',
    '┬': '┼',
    '┴': '┼',
  },
  '┌': {
    '─': '┬',
    '│': '├',
    '┐': '┬',
    '└': '├',
    '┘': '┼',
    '├': '├',
    '┤': '┼',
    '┬': '┬',
    '┴': '┼',
  },
  '┐': {
    '─': '┬',
    '│': '┤',
    '┌': '┬',
    '└': '┼',
    '┘': '┤',
    '├': '┼',
    '┤': '┤',
    '┬': '┬',
    '┴': '┼',
  },
  '└': {
    '─': '┴',
    '│': '├',
    '┌': '├',
    '┐': '┼',
    '┘': '┴',
    '├': '├',
    '┤': '┼',
    '┬': '┼',
    '┴': '┴',
  },
  '┘': {
    '─': '┴',
    '│': '┤',
    '┌': '┼',
    '┐': '┤',
    '└': '┴',
    '├': '┼',
    '┤': '┤',
    '┬': '┼',
    '┴': '┴',
  },
  '├': {
    '─': '┼',
    '│': '├',
    '┌': '├',
    '┐': '┼',
    '└': '├',
    '┘': '┼',
    '┤': '┼',
    '┬': '┼',
    '┴': '┼',
  },
  '┤': {
    '─': '┼',
    '│': '┤',
    '┌': '┼',
    '┐': '┤',
    '└': '┼',
    '┘': '┤',
    '├': '┼',
    '┬': '┼',
    '┴': '┼',
  },
  '┬': {
    '─': '┬',
    '│': '┼',
    '┌': '┬',
    '┐': '┬',
    '└': '┼',
    '┘': '┼',
    '├': '┼',
    '┤': '┼',
    '┴': '┼',
  },
  '┴': {
    '─': '┴',
    '│': '┼',
    '┌': '┼',
    '┐': '┼',
    '└': '┴',
    '┘': '┴',
    '├': '┼',
    '┤': '┼',
    '┬': '┼',
  },
}

export function mergeJunctions(c1: string, c2: string): string {
  return JUNCTION_MAP[c1]?.[c2] ?? c1
}

// ============================================================================
// Canvas merging — composite multiple canvases with offset
// ============================================================================

/**
 * Blank out (replace with a space) any cell in a *later* canvas that a
 * *earlier* one in `canvases` already painted a non-space character into.
 * Canvases are otherwise untouched — same length/shape, same content at
 * every cell no earlier canvas has already claimed.
 *
 * `mergeCanvases` itself always lets the *last* non-space overlay win a
 * shared cell (see its own doc), which is the right default for most of
 * `draw.ts`'s layers (an arrowhead correctly overwrites the corner beneath
 * it, a later label wins a real collision, etc.) — but for the *line*
 * layer specifically, "last edge processed wins" is arbitrary and can pick
 * the wrong one: `edge-cell-styles.ts`'s module doc already documents
 * "first claim wins" as this renderer's intended rule for a cell two
 * differently-styled, unrelated edges both route through (that module
 * tracks exactly this to *detect* the conflict and trigger a reroute
 * around it — see grid.ts's `rerouteAroundStyleConflicts`), but drawing
 * itself never consulted that rule: every edge's line canvas painted in
 * `graph.edges` order and `mergeCanvases` let whichever one came *last*
 * silently overwrite an earlier edge's own, differently-styled glyph. Most
 * of the time rerouting already prevents the two from sharing a cell at
 * all, so this is a no-op; when it can't (e.g. a same-source fan-out with
 * 3+ distinct styles has no fully conflict-free route among the routing
 * candidates available — see #1067, "All Edge Styles"), applying "first
 * claim wins" here at the character level, immediately before the line
 * layer is merged, keeps whichever edge got there first rendered
 * consistently in its own style instead of visibly switching styles
 * mid-route where a later sibling's paint won by sheer draw order.
 *
 * Scoped to the line layer only (`draw.ts`'s `lineCanvases`) — corners,
 * arrowheads, box-start connectors and labels are composited in their own
 * later `mergeCanvases` passes with their existing (correct, layer-specific)
 * merge semantics, untouched by this function.
 *
 * A claimed cell only suppresses a *later* canvas's character when the two
 * wouldn't otherwise combine into something meaningful — i.e. when they
 * aren't both plain Unicode junction characters (`isJunctionChar`). Two
 * *different* junction characters at the same cell are usually a genuine
 * perpendicular crossing (one edge's `─`, another's `│`), which `drawLine`
 * relies on `mergeCanvases`'s own junction-merge logic to combine into `┼`
 * — blanket-suppressing by coordinate alone would silently turn that
 * crossing into whichever edge happened to draw first. Mixed-style
 * characters (dashed `┄`/`┆`, heavy `━`/`┃`) are never junction chars, so
 * they still fall through to plain first-claim suppression — the exact
 * #1067 "All Edge Styles" scenario this function exists for.
 */
export function firstClaimWins(canvases: readonly Canvas[]): Canvas[] {
  const claimed = new Map<string, string>()
  const result: Canvas[] = []
  for (const canvas of canvases) {
    const [maxX, maxY] = getCanvasSize(canvas)
    // `copyCanvas` (despite its name) returns a *blank* canvas of the same
    // size, not a clone of `canvas`'s content — see its own doc. Every cell
    // must be written explicitly below, not just the ones this function
    // blanks out.
    const out = copyCanvas(canvas)
    for (let x = 0; x <= maxX; x++) {
      for (let y = 0; y <= maxY; y++) {
        const c = canvas[x]?.[y]
        if (c === undefined || c === ' ') continue
        const key = `${x},${y}`
        const existing = claimed.get(key)
        if (existing !== undefined) {
          // A repeat of the *same* character (a collinear duplicate, e.g.
          // two edges both drawing '─' through a shared trunk cell) is
          // still a first-claim suppression, not a crossing — `mergeJunctions`
          // has no entry for a character merged with itself and would just
          // fall back to it, so letting it through would be a harmless but
          // pointless no-op; treating it as "still claimed" keeps the rule
          // simple and matches "collinear overlap" from the case that
          // actually needs a merge (two *different* junction characters).
          const isCrossing =
            existing !== c && isJunctionChar(existing) && isJunctionChar(c)
          if (!isCrossing) continue
        } else {
          claimed.set(key, c)
        }
        out[x]![y] = c
      }
    }
    result.push(out)
  }
  return result
}

/**
 * Merge overlay canvases onto a base canvas at the given offset.
 * Non-space characters in overlays overwrite the base.
 * When both characters are Unicode junction chars, they're merged intelligently.
 */
export function mergeCanvases(
  base: Canvas,
  offset: DrawingCoord,
  useAscii: boolean,
  ...overlays: Canvas[]
): Canvas {
  let [maxX, maxY] = getCanvasSize(base)
  for (const overlay of overlays) {
    const [oX, oY] = getCanvasSize(overlay)
    maxX = Math.max(maxX, oX + offset.x)
    maxY = Math.max(maxY, oY + offset.y)
  }

  const merged = mkCanvas(maxX, maxY)

  // Copy base
  for (let x = 0; x <= maxX; x++) {
    for (let y = 0; y <= maxY; y++) {
      if (x < base.length && y < (base[0]?.length ?? 0)) {
        merged[x]![y] = base[x]![y]!
      }
    }
  }

  // Apply overlays
  for (const overlay of overlays) {
    for (let x = 0; x < overlay.length; x++) {
      for (let y = 0; y < (overlay[0]?.length ?? 0); y++) {
        const c = overlay[x]![y]!
        if (c !== ' ') {
          const mx = x + offset.x
          const my = y + offset.y
          const current = merged[mx]![my]!
          if (!useAscii && isJunctionChar(c) && isJunctionChar(current)) {
            merged[mx]![my] = mergeJunctions(current, c)
          } else if (isAlphanumeric(current) && isAlphanumeric(c)) {
            // Don't overwrite existing label text with new label text
            // This prevents label collisions (first label wins)
          } else {
            merged[mx]![my] = c
          }
        }
      }
    }
  }

  return merged
}

// ============================================================================
// Canvas → string conversion
// ============================================================================

/** Options for converting canvas to string with optional coloring. */
export interface CanvasToStringOptions {
  /** Role canvas for applying colors. If not provided, output is plain text. */
  roleCanvas?: RoleCanvas
  /** Color mode for terminal output. Default: 'none' */
  colorMode?: ColorMode
  /** Theme colors for ASCII output. Uses default theme if not provided. */
  theme?: AsciiTheme
  /**
   * Link canvas (see hyperlinks.ts) — each run of cells carrying an href is
   * wrapped in an OSC 8 terminal-hyperlink escape pair. Ignored in 'html'
   * color mode, which is rendered by a browser, not a terminal.
   */
  linkCanvas?: LinkCanvas
}

/**
 * Convert the canvas to a multi-line string (row by row, left to right).
 * Optionally applies ANSI color codes based on character roles, and OSC 8
 * hyperlink escapes based on the link canvas.
 */
export function canvasToString(
  canvas: Canvas,
  options?: CanvasToStringOptions,
): string {
  const [maxX, maxY] = getCanvasSize(canvas)
  const lines: string[] = []

  const roleCanvas = options?.roleCanvas
  const colorMode = options?.colorMode ?? 'none'
  const theme = options?.theme ?? DEFAULT_ASCII_THEME
  const linkCanvas = colorMode === 'html' ? undefined : options?.linkCanvas

  for (let y = 0; y <= maxY; y++) {
    if (colorMode === 'none' || !roleCanvas) {
      // Plain text output — no colors
      const chars: string[] = []
      for (let x = 0; x <= maxX; x++) {
        chars.push(canvas[x]![y]!)
      }
      if (linkCanvas) {
        const links = chars.map((_, x) => linkCanvas[x]?.[y] ?? null)
        lines.push(joinWithLinks(chars, links))
      } else {
        lines.push(chars.join(''))
      }
    } else {
      // Colored output — collect chars, roles, and links for this row
      const chars: string[] = []
      const roles: (CharRole | null)[] = []
      const links: (string | null)[] = []
      for (let x = 0; x <= maxX; x++) {
        chars.push(canvas[x]![y]!)
        roles.push(roleCanvas[x]?.[y] ?? null)
        links.push(linkCanvas?.[x]?.[y] ?? null)
      }
      lines.push(
        colorizeLine(
          chars,
          roles,
          theme,
          colorMode,
          linkCanvas ? links : undefined,
        ),
      )
    }
  }

  return lines.join('\n')
}

// ============================================================================
// Canvas vertical flip — used for BT (bottom-to-top) direction support.
//
// The ASCII renderer lays out graphs top-down (TD). For BT direction, we
// flip the finished canvas vertically and remap directional characters so
// arrows point upward and corners are mirrored correctly.
// ============================================================================

/**
 * Characters that change meaning when the Y-axis is flipped.
 * Symmetric characters (─, │, ├, ┤, ┼) are unchanged.
 */
const VERTICAL_FLIP_MAP: Record<string, string> = {
  // Unicode arrows
  '▲': '▼',
  '▼': '▲',
  // Diagonal arrowheads — U+2196–U+2199, not the filled triangles (◢◣◤◥),
  // since JetBrains Mono NL has no glyph for those at all. See
  // draw-arrows.ts's drawArrowHead and issue #1062.
  '↖': '↙',
  '↙': '↖',
  '↗': '↘',
  '↘': '↗',
  // ASCII arrows
  '^': 'v',
  v: '^',
  // Unicode corners
  '┌': '└',
  '└': '┌',
  '┐': '┘',
  '┘': '┐',
  // Unicode junctions (T-pieces flip vertically)
  '┬': '┴',
  '┴': '┬',
  // Rounded corners (rounded rectangle, cylinder caps)
  '╭': '╰',
  '╰': '╭',
  '╮': '╯',
  '╯': '╮',
  // Box-start junctions (exit points from node boxes)
  '╵': '╷',
  '╷': '╵',
}

/**
 * Flip the canvas vertically (mirror across the horizontal center).
 * Reverses row order within each column and remaps directional characters
 * (arrows, corners, junctions) so they point the correct way after flip.
 *
 * Cells `roleCanvas` marks as `'text'` (node/edge labels) are never remapped:
 * a label containing `v` or `^` is prose, not an arrowhead. Call
 * `mirrorLabelRows` first so multi-line labels keep reading order.
 *
 * Used to transform a TD-rendered canvas into BT output.
 * Mutates the canvas in place and returns it. `roleCanvas` must still be
 * unflipped when this runs.
 */
export function flipCanvasVertically(
  canvas: Canvas,
  roleCanvas?: RoleCanvas,
): Canvas {
  // Remap directional characters that change meaning after vertical flip
  for (const [x, col] of canvas.entries()) {
    for (const [y, ch] of col.entries()) {
      if (roleCanvas?.[x]?.[y] === 'text') continue
      const flipped = VERTICAL_FLIP_MAP[ch]
      if (flipped) col[y] = flipped
    }
  }

  // Reverse each column array (Y-axis flip in column-major layout)
  for (const col of canvas) {
    col.reverse()
  }

  return canvas
}

/**
 * Pre-compensate multi-line labels for a following vertical flip: within each
 * label rectangle, reverse the row order of the `'text'` cells, so that after
 * `flipCanvasVertically` the label's lines read top-to-bottom again while the
 * label itself still lands at the mirrored position.
 *
 * The rectangles come from `drawGraph` (it knows which rows each label was
 * drawn on), so blank lines inside a label and lines of different widths need
 * no special handling. `linkCanvas` is permuted identically to `canvas`.
 * Mutates in place; call before the flips, while every canvas is still
 * unflipped.
 */
export function mirrorLabelRows(
  canvas: Canvas,
  roleCanvas: RoleCanvas,
  labelRects: LabelRect[],
  linkCanvas?: (string | null)[][],
): void {
  // Collect every cell before moving any, so a moved cell is never re-read.
  const moves: { cells: [number, number][]; ySum: number }[] = []
  const seen = new Set<string>()
  for (const { x0, y0, x1, y1 } of labelRects) {
    if (y0 === y1) continue
    const cells: [number, number][] = []
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const key = `${x},${y}`
        if (roleCanvas[x]?.[y] !== 'text' || seen.has(key)) continue
        seen.add(key)
        cells.push([x, y])
      }
    }
    moves.push({ cells, ySum: y0 + y1 })
  }

  for (const { cells, ySum } of moves) {
    moveCells(canvas, cells, ySum, ' ')
    moveCells(roleCanvas, cells, ySum, null)
    if (linkCanvas) moveCells(linkCanvas, cells, ySum, null)
  }
}

function moveCells<T>(
  layer: T[][],
  cells: [number, number][],
  ySum: number,
  empty: T,
): void {
  const saved = cells.map(([cx, cy]) => layer[cx]![cy]!)
  for (const [cx, cy] of cells) layer[cx]![cy] = empty
  for (const [i, [cx, cy]] of cells.entries()) {
    layer[cx]![ySum - cy] = saved[i]!
  }
}

/**
 * Flip the role canvas vertically to match flipCanvasVertically.
 * Mutates the role canvas in place and returns it.
 */
export function flipRoleCanvasVertically(roleCanvas: RoleCanvas): RoleCanvas {
  for (const col of roleCanvas) {
    col.reverse()
  }
  return roleCanvas
}

// ============================================================================
// Canvas horizontal flip — used for RL (right-to-left) direction support.
//
// RL is laid out as LR and the finished canvas is mirrored left-to-right,
// remapping glyphs whose meaning depends on the X-axis. The counterpart of the
// vertical flip above.
// ============================================================================

/**
 * Characters that change meaning when the X-axis is flipped. Symmetric
 * characters (─, │, ┬, ┴, ┼, ╵, ╷) are unchanged.
 */
const HORIZONTAL_FLIP_MAP: Record<string, string> = {
  // Arrowheads
  '►': '◄',
  '◄': '►',
  '>': '<',
  '<': '>',
  // Diagonal arrowheads (U+2196-U+2199)
  '↖': '↗',
  '↗': '↖',
  '↙': '↘',
  '↘': '↙',
  // Corners
  '┌': '┐',
  '┐': '┌',
  '└': '┘',
  '┘': '└',
  // Junctions (T-pieces flip horizontally)
  '├': '┤',
  '┤': '├',
  // Rounded corners
  '╭': '╮',
  '╮': '╭',
  '╰': '╯',
  '╯': '╰',
  // Double-line corners and junctions
  '╔': '╗',
  '╗': '╔',
  '╚': '╝',
  '╝': '╚',
  '╟': '╢',
  '╢': '╟',
  // Corner brackets
  '⌜': '⌝',
  '⌝': '⌜',
  '⌞': '⌟',
  '⌟': '⌞',
  // Slanted strokes and triangles
  '╱': '╲',
  '╲': '╱',
  '/': '\\',
  '\\': '/',
  '◢': '◣',
  '◣': '◢',
  '◤': '◥',
  '◥': '◤',
  '◸': '◹',
  '◹': '◸',
  '◺': '◿',
  '◿': '◺',
}

/**
 * Flip the canvas horizontally (mirror across the vertical center).
 * Reverses column order and remaps directional characters so arrows point
 * the other way and corners mirror correctly.
 *
 * Cells `roleCanvas` marks as `'text'` are never remapped: a label containing
 * `<` or `/` is prose, not an arrowhead. Call `mirrorLabelColumns` first so
 * labels keep reading left-to-right.
 *
 * Used to transform an LR-rendered canvas into RL output. Mutates the canvas
 * in place and returns it. `roleCanvas` must still be unflipped when this runs.
 */
export function flipCanvasHorizontally(
  canvas: Canvas,
  roleCanvas?: RoleCanvas,
): Canvas {
  for (const [x, col] of canvas.entries()) {
    for (const [y, ch] of col.entries()) {
      if (roleCanvas?.[x]?.[y] === 'text') continue
      const flipped = HORIZONTAL_FLIP_MAP[ch]
      if (flipped) col[y] = flipped
    }
  }
  canvas.reverse()
  return canvas
}

/**
 * Pre-compensate labels for a following horizontal flip: within each label
 * rectangle, reflect the `'text'` cells across the rectangle's vertical
 * center, so that after `flipCanvasHorizontally` each label lands at its
 * mirrored position but still reads left-to-right (wide-character placeholder
 * cells keep their order too, since the two reflections cancel). `linkCanvas`
 * is permuted identically. Mutates in place; call before the flips.
 */
export function mirrorLabelColumns(
  canvas: Canvas,
  roleCanvas: RoleCanvas,
  labelRects: LabelRect[],
  linkCanvas?: (string | null)[][],
): void {
  const moves: { cells: [number, number][]; xSum: number }[] = []
  const seen = new Set<string>()
  for (const { x0, y0, x1, y1 } of labelRects) {
    if (x0 === x1) continue
    const cells: [number, number][] = []
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const key = `${x},${y}`
        // A wide glyph's placeholder cell is '' and carries no role of its
        // own, but it must travel with the glyph it follows.
        const isText =
          roleCanvas[x]?.[y] === 'text' ||
          canvas[x]?.[y] === WIDE_CHAR_PLACEHOLDER
        if (!isText || seen.has(key)) continue
        seen.add(key)
        cells.push([x, y])
      }
    }
    moves.push({ cells, xSum: x0 + x1 })
  }

  for (const { cells, xSum } of moves) {
    moveCellsX(canvas, cells, xSum, ' ')
    moveCellsX(roleCanvas, cells, xSum, null)
    if (linkCanvas) moveCellsX(linkCanvas, cells, xSum, null)
  }
}

function moveCellsX<T>(
  layer: T[][],
  cells: [number, number][],
  xSum: number,
  empty: T,
): void {
  const saved = cells.map(([cx, cy]) => layer[cx]![cy]!)
  for (const [cx, cy] of cells) layer[cx]![cy] = empty
  for (const [i, [cx, cy]] of cells.entries()) {
    layer[xSum - cx]![cy] = saved[i]!
  }
}

/** Flip the role canvas horizontally to match flipCanvasHorizontally. */
export function flipRoleCanvasHorizontally(roleCanvas: RoleCanvas): RoleCanvas {
  roleCanvas.reverse()
  return roleCanvas
}

/**
 * Draw text string onto the canvas starting at the given coordinate.
 * By default, preserves existing non-space characters (labels don't overwrite each other).
 * Set forceOverwrite=true to always overwrite (for box content).
 *
 * Wide characters (CJK/kana/hangul/fullwidth-form/emoji — see
 * `isWideChar`/`toDisplayCells` in `display-width.ts`) occupy two grid cells:
 * the glyph itself followed by a placeholder cell. This keeps grid-cell
 * count in sync with the two terminal columns the glyph actually renders as,
 * so text drawn here lines up with widths computed via `displayWidth`.
 */
export function drawText(
  canvas: Canvas,
  start: DrawingCoord,
  text: string,
  forceOverwrite = false,
): void {
  const cells = toDisplayCells(text)
  increaseSize(canvas, start.x + cells.length, start.y)
  for (const [i, cell] of cells.entries()) {
    const x = start.x + i
    const current = canvas[x]![start.y]!
    // Only write if target is empty or we're forcing overwrite
    if (forceOverwrite || current === ' ') {
      canvas[x]![start.y] = cell
    }
  }
}

/**
 * Set the canvas size to fit all grid columns and rows.
 * Called after layout to ensure the canvas covers the full drawing area.
 *
 * `offsetX`/`offsetY` must be the same drawing-coordinate offset
 * `gridToDrawingCoord` adds to every point it computes (`graph.offsetX`/
 * `offsetY`, set by `offsetDrawingForSubgraphs`) — omitting them once left
 * the canvas exactly that much too narrow/short, silently clipping any
 * edge line whose drawing coordinate landed in the unreserved margin (see
 * `createMapping`'s call site for the full story).
 */
export function setCanvasSizeToGrid(
  canvas: Canvas,
  columnWidth: Map<number, number>,
  rowHeight: Map<number, number>,
  offsetX = 0,
  offsetY = 0,
): void {
  let maxX = offsetX
  let maxY = offsetY
  for (const w of columnWidth.values()) maxX += w
  for (const h of rowHeight.values()) maxY += h
  increaseSize(canvas, maxX - 1, maxY - 1)
}

/**
 * Set the role canvas size to match the grid dimensions.
 * Should be called alongside setCanvasSizeToGrid, with the same
 * `offsetX`/`offsetY` — see that function's doc.
 */
export function setRoleCanvasSizeToGrid(
  roleCanvas: RoleCanvas,
  columnWidth: Map<number, number>,
  rowHeight: Map<number, number>,
  offsetX = 0,
  offsetY = 0,
): void {
  let maxX = offsetX
  let maxY = offsetY
  for (const w of columnWidth.values()) maxX += w
  for (const h of rowHeight.values()) maxY += h
  increaseRoleCanvasSize(roleCanvas, maxX - 1, maxY - 1)
}
