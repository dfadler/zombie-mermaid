// ============================================================================
// ASCII renderer — Event modeling
//
// Mermaid has no text mode for event models, so there is no reference output
// to match; this keeps the form of its drawing. Swimlanes are horizontal bands
// with their name in the left margin, time runs left to right, and every frame
// is a box in its lane with its entity type named in the top border, one
// column after the frame before it (Mermaid overlaps neighbours; a character
// grid cannot):
//
//   UI/Automation        ┌─ ui ──┐
//                        │ Cart  ├───────────┐
//                        └───────┘           │
//                                            │
//   ─────────────────────────────────────────│───────
//                                            ▼
//   Command/Read Model            ┌─ command ──┐
//                                 │ Add        │
//                                 └────────────┘
//
//   - Lanes are in the SVG's order: UI/processors, commands/read models,
//     events; a namespace's frames share one lane after the unnamed one.
//   - An arrow leaves the right side of its source, runs along to the middle of
//     its target and turns down (or up) into the target's top (or bottom). In
//     the same lane it runs straight into the target's left side. It runs behind
//     any box it passes.
//   - Text wraps at 24 columns (a longer word is cut); data (inline or a
//     `[[Name]]` block) is listed under the name.
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
const MAX_TEXT = 24
/** Blank columns between boxes. */
const GAP = 4

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

type Role = 'line' | 'text' | 'head' | 'rule'
interface Cell {
  ch: string
  role: Role
  mask: number
}

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
        out: '+',
        right: '>',
        down: 'v',
        up: '^',
      }
    : {
        h: '─',
        v: '│',
        tl: '┌',
        tr: '┐',
        bl: '└',
        br: '┘',
        out: '├',
        right: '▶',
        down: '▼',
        up: '▲',
      }

  // Lanes, top to bottom: UI group, then command/read model, then events; the
  // unnamed lane of a group before its namespaced ones.
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
    .map(([key, l]) => ({ key, label: l.label, y: 0, height: 0 }))
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
    const height = name.length + data.length + 2
    lane.height = Math.max(lane.height, height)
    return { f, name, data, tag, lane, x: 0, width: inner + 4, height }
  })

  // Lanes are bands: a rule above each, a blank row above and below the boxes
  // for the arrows' heads.
  const gutter = Math.max(...lanes.map((l) => displayWidth(l.label))) + 3
  let y = 0
  for (const l of lanes) {
    l.y = y
    y += l.height + 3
  }
  let x = gutter
  for (const b of boxes) {
    b.x = x
    x += b.width + GAP
  }
  const width = x - GAP + 1
  const height = y

  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from(
      { length: width },
      () => ({ ch: ' ', role: 'line', mask: 0 }) as Cell,
    ),
  )
  const put = (cx: number, cy: number, ch: string, role: Role): void => {
    const cell = grid[cy]?.[cx]
    if (cell) {
      cell.ch = ch
      cell.role = role
      cell.mask = 0
    }
  }
  const putText = (cx: number, cy: number, s: string, role: Role): void => {
    let at = cx
    for (const ch of s) {
      put(at, cy, ch, role)
      // A wide character takes two cells; the second is blanked.
      for (let k = 1; k < displayWidth(ch); k++) put(at + k, cy, '', role)
      at += displayWidth(ch)
    }
  }
  const mark = (cx: number, cy: number, mask: number): void => {
    const cell = grid[cy]?.[cx]
    if (!cell) return
    if (cell.role === 'rule') {
      cell.ch = ' '
      cell.role = 'line'
    }
    if (cell.ch === ' ') cell.mask |= mask
  }

  // Rules between lanes, and the lane names in the left margin.
  lanes.forEach((l, i) => {
    if (i > 0) for (let c = 0; c < width; c++) put(c, l.y - 1, g.h, 'rule')
    putText(0, l.y + 1, l.label, 'head')
  })
  const top = (b: (typeof boxes)[number]): number => b.lane.y + 1
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
      const row = top(source) + 1
      const right = source.x + source.width - 1
      exits.push([right, row])
      if (source.lane === target.lane) {
        const trow = top(target) + 1
        const turn = right + 2
        // Along, then to the target's row if it differs, then into its left side.
        for (let c = right + 1; c < target.x - 1; c++)
          mark(c, row, LEFT | RIGHT)
        if (trow !== row) {
          mark(turn, row, LEFT | (trow > row ? DOWN : UP))
          for (let r = Math.min(row, trow) + 1; r < Math.max(row, trow); r++)
            mark(turn, r, UP | DOWN)
          mark(turn, trow, (trow > row ? UP : DOWN) | RIGHT)
        }
        heads.push([target.x - 1, trow, g.right])
        continue
      }
      const cx = target.x + Math.floor(target.width / 2)
      const down = target.lane.y > source.lane.y
      for (let c = right + 1; c < cx; c++) mark(c, row, LEFT | RIGHT)
      mark(cx, row, LEFT | (down ? DOWN : UP))
      if (down) {
        for (let r = row + 1; r < top(target) - 1; r++) mark(cx, r, UP | DOWN)
        heads.push([cx, top(target) - 1, g.down])
      } else {
        const bottom = top(target) + target.height - 1
        for (let r = row - 1; r > bottom + 1; r--) mark(cx, r, UP | DOWN)
        heads.push([cx, bottom + 1, g.up])
      }
    }
  })

  for (const b of boxes) {
    const t = top(b)
    const w = b.width
    const bottom = t + b.height - 1
    for (let r = t; r <= bottom; r++)
      for (let c = b.x; c < b.x + w; c++) put(c, r, ' ', 'text')
    const tag = ` ${b.tag} `
    put(b.x, t, g.tl, 'line')
    putText(b.x + 1, t, g.h + tag, 'line')
    for (let c = b.x + 2 + displayWidth(tag); c < b.x + w - 1; c++)
      put(c, t, g.h, 'line')
    put(b.x + w - 1, t, g.tr, 'line')
    put(b.x, bottom, g.bl, 'line')
    for (let c = b.x + 1; c < b.x + w - 1; c++) put(c, bottom, g.h, 'line')
    put(b.x + w - 1, bottom, g.br, 'line')
    for (let r = t + 1; r < bottom; r++) {
      put(b.x, r, g.v, 'line')
      put(b.x + w - 1, r, g.v, 'line')
    }
    ;[...b.name, ...b.data].forEach((l, k) =>
      putText(b.x + 2, t + 1 + k, l, 'text'),
    )
  }
  for (const [cx, cy] of exits) put(cx, cy, g.out, 'line')
  for (const [cx, cy, ch] of heads) put(cx, cy, ch, 'line')

  const paint = (s: string, role: Role): string =>
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
      let runRole: Role = 'line'
      for (const cell of row.slice(0, end)) {
        const blank = cell.mask === 0 && cell.ch === ' '
        const ch =
          cell.mask !== 0
            ? ascii
              ? ASCII_GLYPH(cell.mask)
              : (UNI_GLYPH[cell.mask] ?? '│')
            : cell.ch
        const role: Role = cell.mask !== 0 ? 'line' : cell.role
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
    .replace(/^\s*\n/, '')
    .replace(/\s+$/, '')
}
