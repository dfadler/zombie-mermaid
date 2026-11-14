// ============================================================================
// ASCII renderer — Event modeling
//
// Mermaid has no text mode for event models, so there is no reference output
// to match. The SVG runs time left to right across wide swimlanes, which at
// terminal widths would run off the screen after a handful of frames, so this
// turns it a quarter: swimlanes are columns, time runs down, every frame is a
// box in its lane's column with its entity type named in the top border:
//
//   UI/Automation     Command/Read Model      Events
//   ┌─ ui ───────┐
//   │ CartUI     │
//   └─────┬──────┘
//         │
//         │      ┌─ command ──┐
//         └────▶ │ AddItem    │
//                └─────┬──────┘
//                      │
//                      │             ┌─ event ────┐
//                      └───────────▶ │ ItemAdded  │
//                                    └────────────┘
//
//   - A lane is as wide as its widest box (text wraps at 28 columns, a longer word is cut); lanes
//     are in the SVG's order: UI/processors, commands/read models, events,
//     with a namespace's frames sharing one lane after the unnamed one.
//   - An arrow leaves the bottom of its source, drops to the target's middle
//     row and turns into the target's side (straight down into the top
//     for a frame in the same lane). It runs behind any box it passes.
//   - Data (inline or a `[[Name]]` block) is listed under the name.
//   - Headings are painted in the theme accent, frames and arrows in the line
//     colour. Widths are display widths.
// ============================================================================

import { parseEventModeling } from '@zombie-mermaid/mermaid-parser'
import type {
  EventModeling,
  EventModelingFrame,
} from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

/** Text inside a box wraps at this many columns. */
const MAX_TEXT = 28
/** Blank columns between lanes, and blank rows between boxes. */
const LANE_GAP = 6
const ROW_GAP = 1

const TYPE_LABEL = {
  ui: 'ui',
  processor: 'processor',
  command: 'command',
  readmodel: 'read model',
  event: 'event',
} as const

/** Cut a word wider than the box into pieces that fit. */
function chop(word: string): string[] {
  const pieces: string[] = []
  let cur = ''
  for (const ch of word) {
    if (cur && displayWidth(cur + ch) > MAX_TEXT) {
      pieces.push(cur)
      cur = ''
    }
    cur += ch
  }
  return [...pieces, cur]
}

/** Greedy word wrap by display width; a word wider than the limit is cut. */
function wrap(text: string): string[] {
  const out: string[] = []
  for (const line of text.split('\n')) {
    let cur = ''
    for (const word of line.split(/\s+/).filter(Boolean)) {
      for (const piece of chop(word)) {
        const next = cur ? `${cur} ${piece}` : piece
        if (cur && displayWidth(next) > MAX_TEXT) {
          out.push(cur)
          cur = piece
        } else cur = next
      }
    }
    out.push(cur)
  }
  return out
}

/** The data a frame carries, one string per source line. */
function dataLines(f: EventModelingFrame, em: EventModeling): string[] {
  const block = em.dataBlocks.find((b) => b.name === f.dataRef)
  const raw = block?.value ?? f.dataInline
  if (raw === undefined) return []
  const trimmed = raw.trim()
  const body = /^[{"']/.test(trimmed) ? trimmed.slice(1, -1) : trimmed
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap(wrap)
}

/** Lane key: entity group (0 UI, 1 command/read model, 2 event) and namespace. */
function laneOf(f: EventModelingFrame): { group: number; label: string } {
  const group =
    f.entityType === 'ui' || f.entityType === 'processor'
      ? 0
      : f.entityType === 'event'
        ? 2
        : 1
  const base = ['UI/Automation', 'Command/Read Model', 'Events'][group]!
  const prefix = ['UI/A: ', 'C/RM: ', 'Stream: '][group]!
  return { group, label: f.namespace ? prefix + f.namespace : base }
}

// Which sides of a cell a line touches.
const UP = 1
const DOWN = 2
const LEFT = 4
const RIGHT = 8
const UNI_GLYPH: Record<number, string> = {
  [UP | DOWN]: '│',
  [LEFT | RIGHT]: '─',
  [UP | RIGHT]: '└',
  [UP | LEFT]: '┘',
  [DOWN | RIGHT]: '┌',
  [DOWN | LEFT]: '┐',
  [UP | DOWN | RIGHT]: '├',
  [UP | DOWN | LEFT]: '┤',
  [LEFT | RIGHT | DOWN]: '┬',
  [LEFT | RIGHT | UP]: '┴',
  [UP | DOWN | LEFT | RIGHT]: '┼',
}
const ASCII_GLYPH = (mask: number): string =>
  mask & (LEFT | RIGHT) && mask & (UP | DOWN)
    ? '+'
    : mask & (LEFT | RIGHT)
      ? '-'
      : '|'

export function renderEventModelingAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const em = parseEventModeling(text)
  if (em.frames.length === 0) return ''
  const ascii = config.useAscii
  const g = ascii
    ? {
        h: '-',
        v: '|',
        tl: '+',
        tr: '+',
        bl: '+',
        br: '+',
        down: '+',
        right: '>',
      }
    : {
        h: '─',
        v: '│',
        tl: '┌',
        tr: '┐',
        bl: '└',
        br: '┘',
        down: '┬',
        right: '▶',
      }
  const left = ascii ? '<' : '◀'
  const arrowDown = ascii ? 'v' : '▼'

  // Lanes, left to right.
  const laneKeys = new Map<
    string,
    { group: number; label: string; named: boolean; order: number }
  >()
  for (const f of em.frames) {
    const l = laneOf(f)
    const key = `${l.group}:${l.label}`
    if (!laneKeys.has(key))
      laneKeys.set(key, {
        ...l,
        named: f.namespace !== undefined,
        order: laneKeys.size,
      })
  }
  const lanes = [...laneKeys.entries()]
    .sort(
      ([, a], [, b]) =>
        a.group - b.group ||
        Number(a.named) - Number(b.named) ||
        a.order - b.order,
    )
    .map(([key, l]) => ({ key, label: l.label, x: 0, width: 0 }))
  const laneIndex = new Map(lanes.map((l, i) => [l.key, i]))

  const boxes = em.frames.map((f) => {
    const l = laneOf(f)
    const name = wrap(f.name)
    const data = dataLines(f, em)
    const tag = TYPE_LABEL[f.entityType]
    const inner = Math.max(
      ...name.map(displayWidth),
      ...data.map(displayWidth),
      displayWidth(tag) + 3,
    )
    const lane = lanes[laneIndex.get(`${l.group}:${l.label}`)!]!
    lane.width = Math.max(lane.width, inner + 4)
    return {
      f,
      name,
      data,
      tag,
      lane,
      top: 0,
      height: name.length + data.length + 2,
    }
  })
  for (const l of lanes) l.width = Math.max(l.width, displayWidth(l.label))
  let x = 0
  for (const l of lanes) {
    l.x = x
    x += l.width + LANE_GAP
  }

  let y = 2
  for (const b of boxes) {
    b.top = y
    y += b.height + ROW_GAP + 1
  }
  const height = y - ROW_GAP - 1
  const width = x - LANE_GAP

  type Cell = { ch: string; role: 'line' | 'text' | 'head'; mask: number }
  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from(
      { length: width },
      () => ({ ch: ' ', role: 'line', mask: 0 }) as Cell,
    ),
  )
  const put = (
    cx: number,
    cy: number,
    ch: string,
    role: Cell['role'],
  ): void => {
    const cell = grid[cy]?.[cx]
    if (cell) {
      cell.ch = ch
      cell.role = role
      cell.mask = 0
    }
  }
  const putText = (
    cx: number,
    cy: number,
    s: string,
    role: Cell['role'],
  ): void => {
    let at = cx
    for (const ch of s) {
      put(at, cy, ch, role)
      // A wide character takes two cells; the second is blanked.
      const w = displayWidth(ch)
      for (let k = 1; k < w; k++) put(at + k, cy, '', role)
      at += w
    }
  }
  const mark = (cx: number, cy: number, mask: number): void => {
    const cell = grid[cy]?.[cx]
    if (cell && cell.ch === ' ') cell.mask |= mask
  }

  for (const l of lanes) putText(l.x, 0, l.label, 'head')

  // Arrows first (boxes are drawn over them), then boxes, then arrowheads.
  const heads: Array<[number, number, string]> = []
  const exits: Array<[number, number]> = []
  em.frames.forEach((f, i) => {
    const target = boxes[i]!
    const sources = f.sources.length
      ? f.sources
      : f.reset
        ? []
        : (() => {
            for (let k = i - 1; k >= 0; k--)
              if (boxes[k]!.lane !== target.lane) return [boxes[k]!.f.id]
            return []
          })()
    for (const id of sources) {
      const si = em.frames.findIndex((s) => s.id === id)
      if (si < 0 || si >= i) continue
      const source = boxes[si]!
      const cs = source.lane.x + Math.floor(source.lane.width / 2)
      const from = source.top + source.height
      exits.push([cs, from - 1])
      if (source.lane === target.lane) {
        for (let r = from; r < target.top - 1; r++) mark(cs, r, UP | DOWN)
        heads.push([cs, target.top - 1, arrowDown])
        continue
      }
      const ym = target.top + Math.floor(target.height / 2)
      for (let r = from; r < ym; r++) mark(cs, r, UP | DOWN)
      const toRight = target.lane.x > source.lane.x
      mark(cs, ym, UP | (toRight ? RIGHT : LEFT))
      if (toRight) {
        for (let c = cs + 1; c < target.lane.x - 1; c++)
          mark(c, ym, LEFT | RIGHT)
        heads.push([target.lane.x - 1, ym, g.right])
      } else {
        const edge = target.lane.x + target.lane.width
        for (let c = cs - 1; c > edge; c--) mark(c, ym, LEFT | RIGHT)
        heads.push([edge, ym, left])
      }
    }
  })

  for (const b of boxes) {
    const bx = b.lane.x
    const w = b.lane.width
    const bottom = b.top + b.height - 1
    for (let r = b.top; r <= bottom; r++)
      for (let c = bx; c < bx + w; c++) put(c, r, ' ', 'text')
    const tag = ` ${b.tag} `
    put(bx, b.top, g.tl, 'line')
    putText(bx + 1, b.top, g.h + tag, 'line')
    for (let c = bx + 2 + displayWidth(tag); c < bx + w - 1; c++)
      put(c, b.top, g.h, 'line')
    put(bx + w - 1, b.top, g.tr, 'line')
    put(bx, bottom, g.bl, 'line')
    for (let c = bx + 1; c < bx + w - 1; c++) put(c, bottom, g.h, 'line')
    put(bx + w - 1, bottom, g.br, 'line')
    for (let r = b.top + 1; r < bottom; r++) {
      put(bx, r, g.v, 'line')
      put(bx + w - 1, r, g.v, 'line')
    }
    const lines = [...b.name, ...b.data]
    lines.forEach((l, k) => putText(bx + 2, b.top + 1 + k, l, 'text'))
  }
  for (const [cx, cy] of exits) put(cx, cy, g.down, 'line')
  for (const [cx, cy, ch] of heads) put(cx, cy, ch, 'line')

  const paint = (s: string, role: Cell['role']): string =>
    colorizeText(
      s,
      role === 'head'
        ? (theme.accent ?? theme.fg)
        : role === 'text'
          ? theme.fg
          : theme.line,
      colorMode,
    )
  return grid
    .map((row) => {
      let end = row.length
      while (end > 0 && row[end - 1]!.ch === ' ' && row[end - 1]!.mask === 0)
        end--
      let out = ''
      let run = ''
      let runRole: Cell['role'] = 'line'
      for (const cell of row.slice(0, end)) {
        const blank = cell.mask === 0 && cell.ch === ' '
        const ch =
          cell.mask !== 0
            ? ascii
              ? ASCII_GLYPH(cell.mask)
              : (UNI_GLYPH[cell.mask] ?? '│')
            : cell.ch
        const role: Cell['role'] = cell.mask !== 0 ? 'line' : cell.role
        if (!blank && role !== runRole) {
          if (run !== '') out += paint(run, runRole)
          run = ''
          runRole = role
        }
        run += ch
      }
      return out + (run === '' ? '' : paint(run, runRole))
    })
    .join('\n')
}
