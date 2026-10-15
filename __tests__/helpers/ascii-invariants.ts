/**
 * Whole-canvas ASCII invariant checker (#1858), generalizing the #1432 trace.
 * Pure functions over the rendered string; test helper only, not shipped.
 *
 * Arm-table rules apply to the unicode charset (the ASCII charset reuses
 * `-|+` for everything, so only the rectangle rule applies there).
 * Each rule returns violations with cell coordinates and a canvas excerpt.
 */
export type Dir = 'U' | 'D' | 'L' | 'R'
const ARMS: Record<string, string> = {}
const def = (chars: string, arms: string) => {
  for (const c of chars) ARMS[c] = arms
}
def('│┆┊┃╎', 'UD')
def('─┄┈━╌', 'LR')
def('┌╭┏', 'RD')
def('┐╮┓', 'LD')
def('└╰┗', 'RU')
def('┘╯┛', 'LU')
def('├┣', 'UDR')
def('┤┫', 'UDL')
def('┬┳', 'LRD')
def('┴┻', 'LRU')
def('┼╋', 'UDLR')
const HEADS: Record<string, Dir> = { '▼': 'D', '▲': 'U', '►': 'R', '◄': 'L' }
const STEP: Record<Dir, [number, number]> = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
}
const OPP: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' }

export interface Violation {
  rule: string
  x: number
  y: number
  message: string
}

/** One cell per terminal column: a wide (CJK/emoji) glyph is followed by a NUL filler. */
const WIDE =
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{1f300}-\u{1faff}\u{20000}-\u{3fffd}]/u
export const toGrid = (out: string): string[][] =>
  out
    .split('\n')
    .map((l) => [...l].flatMap((c) => (WIDE.test(c) ? [c, '\0'] : [c])))

function excerpt(grid: string[][], x: number, y: number): string {
  return [y - 1, y, y + 1]
    .map((r) =>
      grid[r] ? grid[r]!.slice(Math.max(0, x - 4), x + 5).join('') : '',
    )
    .join(' | ')
}
const v = (
  grid: string[][],
  rule: string,
  x: number,
  y: number,
  msg: string,
): Violation => ({
  rule,
  x,
  y,
  message: `${rule} at (${x},${y}): ${msg} [${excerpt(grid, x, y)}]`,
})

/** Every row has the same display length. */
export function checkEqualWidth(grid: string[][]): Violation[] {
  const width = (row: string[]) => row.length
  const w = grid[0] ? width(grid[0]) : 0
  return grid.flatMap((row, y) =>
    width(row) === w
      ? []
      : [
          v(
            grid,
            'equal-width',
            width(row),
            y,
            `row is ${width(row)} wide, expected ${w}`,
          ),
        ],
  )
}

/** An arrowhead needs a line cell directly behind it that points at it. */
export function checkArrowheads(grid: string[][]): Violation[] {
  const out: Violation[] = []
  grid.forEach((row, y) =>
    row.forEach((ch, x) => {
      const d = HEADS[ch]
      if (!d) return
      const [dx, dy] = STEP[OPP[d]]
      // Walk back along the stroke. An edge label sits on the stroke (#1432
      // bridges it the same way), so skip a run of label text, then expect a
      // line cell with an arm toward the head.
      let k = 1
      let back = grid[y + dy]?.[x + dx] ?? ' '
      const label = (c: string) => c !== ' ' && !ARMS[c] && !HEADS[c]
      while (
        label(back) ||
        (dx !== 0 && back === ' ' && label(grid[y]?.[x + (k + 1) * dx] ?? ' '))
      ) {
        if (++k > 40) break
        back = grid[y + k * dy]?.[x + k * dx] ?? ' '
      }
      if (!ARMS[back]?.includes(d))
        out.push(
          v(
            grid,
            'arrowhead',
            x,
            y,
            `'${ch}' has no line cell behind it (found '${back}')`,
          ),
        )
    }),
  )
  return out
}

/**
 * Junction consistency / orphan stubs: every arm of a line glyph must lead to
 * a cell that continues it (reciprocal arm, arrowhead, or text such as a
 * label or box wall). An arm into blank space or off-canvas is a stub.
 */
export function checkArms(grid: string[][]): Violation[] {
  const out: Violation[] = []
  grid.forEach((row, y) =>
    row.forEach((ch, x) => {
      const arms = ARMS[ch]
      if (!arms) return
      for (const d of arms as unknown as Dir[]) {
        const [dx, dy] = STEP[d]
        const n = grid[y + dy]?.[x + dx] ?? ' '
        // `┌─ Title ──`: a frame title pads the stroke with a blank.
        const titlePad =
          n === ' ' &&
          /[\p{L}\p{N}]/u.test(grid[y + 2 * dy]?.[x + 2 * dx] ?? ' ')
        if (n === ' ' && titlePad) continue
        if (n === ' ')
          out.push(
            v(grid, 'orphan-arm', x, y, `'${ch}' arm ${d} leads to blank`),
          )
        // A straight stroke ending on a perpendicular straight one is how a
        // line meets a box wall or a dashed crossing: by design, not a stub.
        else if (
          ARMS[n] &&
          !ARMS[n]!.includes(OPP[d]) &&
          !(ARMS[ch]!.length === 2 && ARMS[n]!.length === 2)
        )
          out.push(
            v(
              grid,
              'junction',
              x,
              y,
              `'${ch}' arm ${d} meets '${n}' with no arm back`,
            ),
          )
        else if (HEADS[n] && 'UD'.includes(HEADS[n]!) !== 'UD'.includes(d))
          out.push(
            v(
              grid,
              'junction',
              x,
              y,
              `'${ch}' arm ${d} meets head '${n}' pointing ${HEADS[n]}`,
            ),
          )
      }
    }),
  )
  return out
}

/** Connector glyphs sitting directly beside text inside a box's text rows. */
export function checkNodeTextClear(grid: string[][]): Violation[] {
  const out: Violation[] = []
  const at = (x: number, y: number) => grid[y]?.[x] ?? ' '
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y]!.length; x++) {
      if (!'┌╭┏'.includes(at(x, y))) continue
      let x1 = x + 1
      while (at(x1, y) !== ' ' && !'┐╮┓'.includes(at(x1, y))) x1++
      if (!'┐╮┓'.includes(at(x1, y))) continue
      let y1 = y + 1
      while (y1 < grid.length && !'└╰┗'.includes(at(x, y1))) y1++
      if (y1 >= grid.length || !'┘╯┛'.includes(at(x1, y1))) continue
      // Frames that hold other boxes (subgraphs) are not node text.
      const nested = grid
        .slice(y + 1, y1)
        .some((row) => row.slice(x + 1, x1).some((c) => '┌╭┏└╰┗'.includes(c)))
      if (nested) continue
      for (let r = y + 1; r < y1; r++) {
        // A full-width separator (class compartments) has a T on each wall.
        if ('├┣'.includes(at(x, r)) && '┤┫'.includes(at(x1, r))) continue
        for (let c = x + 1; c < x1; c++) {
          const ch = at(c, r)
          if (
            (ARMS[ch] || HEADS[ch]) &&
            /[\p{L}\p{N}]/u.test(at(c - 1, r) + at(c + 1, r))
          )
            out.push(
              v(
                grid,
                'node-text-overlap',
                c,
                r,
                `connector glyph '${ch}' inside box text`,
              ),
            )
        }
      }
    }
  return out
}

const at = (grid: string[][], x: number, y: number) => grid[y]?.[x] ?? ' '
const hasArm = (ch: string, d: Dir) => ARMS[ch]?.includes(d) ?? false

/**
 * A straight stroke with a perpendicular line running into it from both sides
 * is a crossing drawn without a junction glyph (#2112): the later line erased
 * the earlier one's cell, so it reads as two edges that stop at each other.
 */
export function checkCrossings(grid: string[][]): Violation[] {
  const out: Violation[] = []
  grid.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (
        '│┊'.includes(ch) &&
        hasArm(at(grid, x - 1, y), 'R') &&
        hasArm(at(grid, x + 1, y), 'L')
      )
        out.push(
          v(grid, 'crossing', x, y, `'${ch}' is crossed with no junction`),
        )
      if (
        '─╌'.includes(ch) &&
        hasArm(at(grid, x, y - 1), 'D') &&
        hasArm(at(grid, x, y + 1), 'U')
      )
        out.push(
          v(grid, 'crossing', x, y, `'${ch}' is crossed with no junction`),
        )
    }),
  )
  return out
}

/** Rectangles drawn with corner glyphs (contents are not inspected). */
function findBoxes(grid: string[][]) {
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = []
  grid.forEach((row, y) =>
    row.forEach((ch, x0) => {
      if (!'┌╭┏'.includes(ch)) return
      let x1 = x0 + 1
      while ('─━'.includes(at(grid, x1, y))) x1++
      if (!'┐╮┓'.includes(at(grid, x1, y))) return
      let y1 = y + 1
      while (y1 < grid.length && '│┃├┣'.includes(at(grid, x0, y1))) y1++
      if ('└╰┗'.includes(at(grid, x0, y1)) && '┘╯┛'.includes(at(grid, x1, y1)))
        boxes.push({ x0, x1, y0: y, y1 })
    }),
  )
  return boxes
}

/**
 * An edge must leave a box through a face, not run along its border (#2112):
 * a horizontal run of two or more line cells in the row directly above a box's
 * top border or below its bottom border, across the box's width.
 */
export function checkBorderHug(grid: string[][]): Violation[] {
  const out: Violation[] = []
  for (const b of findBoxes(grid))
    for (const y of [b.y0 - 1, b.y1 + 1])
      for (let x = b.x0; x < b.x1; x++)
        if (hasArm(at(grid, x, y), 'R') && hasArm(at(grid, x + 1, y), 'L'))
          out.push(
            v(grid, 'border-hug', x, y, 'edge runs along the box border'),
          )
  return out
}

/**
 * A relationship label must belong to one edge. Outside every box, text that
 * touches a line glyph, sits between two verticals, or has no line within two
 * cells (or directly above or below it, for a label under a horizontal line)
 * is ambiguous or floating (#2112).
 */
export function checkLabels(grid: string[][]): Violation[] {
  const out: Violation[] = []
  const boxes = findBoxes(grid)
  const inBox = (x: number, y: number) =>
    boxes.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1)
  const isText = (x: number, y: number) => {
    const c = at(grid, x, y)
    return c !== ' ' && !ARMS[c] && !'○╟╢╧╤'.includes(c) && !inBox(x, y)
  }
  const vert = (x: number, y: number) =>
    hasArm(at(grid, x, y), 'U') && hasArm(at(grid, x, y), 'D')
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!isText(x, y)) continue
      let x1 = x
      // words of one label are one blank apart
      while (
        isText(x1 + 1, y) ||
        (at(grid, x1 + 1, y) === ' ' && isText(x1 + 2, y))
      )
        x1++
      if (ARMS[at(grid, x - 1, y)] || ARMS[at(grid, x1 + 1, y)])
        out.push(v(grid, 'label', x, y, 'label touches a line glyph'))
      else if (vert(x - 2, y) && (vert(x1 + 2, y) || vert(x1 + 3, y)))
        out.push(v(grid, 'label', x, y, 'label sits between two verticals'))
      else {
        let near = false
        for (let k = x - 2; k <= x1 + 2; k++) {
          if (k >= x && k <= x1) {
            if (
              hasArm(at(grid, k, y - 1), 'D') ||
              hasArm(at(grid, k, y + 1), 'U')
            )
              near = true
          } else if (ARMS[at(grid, k, y)]) near = true
        }
        if (!near) out.push(v(grid, 'label', x, y, 'label has no line near it'))
      }
      x = x1
    }
  })
  return out
}

export type Rule =
  | 'equal-width'
  | 'arrowhead'
  | 'arms'
  | 'node-text'
  | 'crossing'
  | 'border-hug'
  | 'label'

/** `skip` drops a rule for a diagram kind that does not promise it. */
export function checkAll(
  out: string,
  opts: { unicode: boolean; skip?: readonly Rule[]; er?: boolean },
): Violation[] {
  const grid = toGrid(out)
  const on = (r: Rule) => !opts.skip?.includes(r)
  const er = opts.unicode && opts.er
  return [
    // ER only: a sequence lifeline is crossed by messages without a junction,
    // and other diagrams may run edges along a box face or label them by
    // their own rules.
    ...(er && on('crossing') ? checkCrossings(grid) : []),
    ...(er && on('border-hug') ? checkBorderHug(grid) : []),
    ...(er && on('label') ? checkLabels(grid) : []),
    ...(on('equal-width') ? checkEqualWidth(grid) : []),
    ...(opts.unicode && on('arrowhead') ? checkArrowheads(grid) : []),
    ...(opts.unicode && on('arms') ? checkArms(grid) : []),
    ...(opts.unicode && on('node-text') ? checkNodeTextClear(grid) : []),
  ]
}
