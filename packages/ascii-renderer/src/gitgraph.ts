// ============================================================================
// ASCII renderer — GitGraph
//
// Mermaid has no text mode for gitGraph, so there is no reference output to
// match. The SVG runs time left to right (or down, or up) with a wide label
// under every commit, which at terminal widths would run off the screen after
// a dozen commits, so this draws the same graph the way `git log --graph`
// does: one row per commit, one column per branch, oldest first.
//
//     main  develop
//     ●     ┆   init
//     ●     ┆   docs
//     ├─────●   feature-a
//     │     ●   feature-b
//     ◎─────╯   release-1
//     ●     ┆   hotfix
//
//   - Branches are columns in Mermaid's order (`order:` then creation); the
//     name is written over its column, and `showBranches: false` drops the
//     names and the dotted lines. A branch is dotted (`┆`) outside the span
//     from its first commit to its last (or the last that takes from it).
//   - A commit is a symbol on its branch: `●` normal, `✕` reverse, `◆`
//     highlight, `◎` merge, `○` cherry-pick (`*`, `X`, `#`, `@`, `o` in ASCII
//     mode). A branch's first commit joins the commit it forked from with
//     `├──`; a merge or cherry-pick joins the commit it took from with `──╯`
//     (`──╮` in `BT`).
//   - The row's text is the commit id (unless `showCommitLabel: false`; a
//     merge has one only when it was given an `id:`, a cherry-pick never)
//     followed by its tags in brackets.
//   - `LR` and `TB` read downward, oldest first; `BT` upward, newest at the
//     top as `git log` prints it, with the names under the columns.
//   - `parallelCommits: true` puts commits of the same depth (root 0, else one
//     below their deepest parent) on one row, as Mermaid puts them at one
//     position, when their lanes and joins do not overlap; the row then lists
//     their ids left to right, separated by commas. Without it, or when two
//     commits of one depth would overlap, each has its own row.
//   - Colours: a column is painted in the series colour of its branch. The
//     diagram title, when there is one, is centred over the graph.
//
// Widths are display widths (CJK and emoji names line up).
// ============================================================================

import {
  parseGitGraph,
  getSeriesColor,
  CHART_ACCENT_FALLBACK,
} from '@zombie-mermaid/mermaid-parser'
import type { GitCommit } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

interface Glyphs {
  vertical: string
  dotted: string
  horizontal: string
  cross: string
  forkRight: string
  forkLeft: string
  /** Join from a commit above, towards the left / towards the right. */
  joinUpLeft: string
  joinUpRight: string
  joinDownLeft: string
  joinDownRight: string
  normal: string
  reverse: string
  highlight: string
  merge: string
  cherry: string
}

const UNI: Glyphs = {
  vertical: '│',
  dotted: '┆',
  horizontal: '─',
  cross: '┼',
  forkRight: '├',
  forkLeft: '┤',
  joinUpLeft: '╯',
  joinUpRight: '╰',
  joinDownLeft: '╮',
  joinDownRight: '╭',
  normal: '●',
  reverse: '✕',
  highlight: '◆',
  merge: '◎',
  cherry: '○',
}
const ASC: Glyphs = {
  vertical: '|',
  dotted: ':',
  horizontal: '-',
  cross: '+',
  forkRight: '+',
  forkLeft: '+',
  // Not `/` and `\`: ASCII output never has diagonals (ascii.test.ts).
  joinUpLeft: '+',
  joinUpRight: '+',
  joinDownLeft: '+',
  joinDownRight: '+',
  normal: '*',
  reverse: 'X',
  highlight: '#',
  merge: '@',
  cherry: 'o',
}

export function renderGitGraphAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const gg = parseGitGraph(text)
  const g = config.useAscii ? ASC : UNI
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)
  const accent = theme.accent ?? CHART_ACCENT_FALLBACK
  const colorOf = (lane: number): string =>
    lane === 0 ? accent : getSeriesColor(lane, accent, theme.bg)
  const up = gg.direction === 'BT'

  // Column of each lane: the name over it sets how far apart they are.
  const names = gg.branches.map((b) => b.split(/\\n|\n|<br\s*\/?>/i).join(' '))
  const x: number[] = []
  let cursor = 0
  gg.branches.forEach((_, i) => {
    x.push(cursor)
    cursor += Math.max(
      3,
      gg.config.showBranches ? displayWidth(names[i]!) + 2 : 3,
    )
  })
  const lane = new Map(gg.branches.map((b, i) => [b, i] as const))
  const lanes = gg.branches.length
  // The last column's glyph, then the gap before the text.
  const graphWidth = x[lanes - 1]! + 1 + 1
  const commits = new Map<string, GitCommit>(gg.commits.map((c) => [c.id, c]))
  // The lanes a commit's glyph and its joins cover, as a [from, to] range.
  const spanOf = (c: GitCommit): [number, number] => {
    const col = lane.get(c.branch)!
    let lo = col
    let hi = col
    for (const p of c.parents) {
      const from = lane.get(commits.get(p)?.branch ?? c.branch)!
      lo = Math.min(lo, from)
      hi = Math.max(hi, from)
    }
    return [lo, hi]
  }
  // Rows of commits: one each, or with `parallelCommits` those of one depth
  // whose spans do not overlap (first fit, in source order).
  const groups: { depth: number; commits: GitCommit[] }[] = []
  if (gg.config.parallelCommits) {
    const depth = new Map<string, number>()
    for (const c of gg.commits) {
      const d = Math.max(-1, ...c.parents.map((p) => depth.get(p) ?? -1)) + 1
      depth.set(c.id, d)
      const [lo, hi] = spanOf(c)
      // Two forks off the same commit share its join line, so they sit side by side.
      const sibling = (o: GitCommit): boolean =>
        c.parents.length === 1 &&
        o.parents.length === 1 &&
        c.parents[0] === o.parents[0] &&
        commits.get(c.parents[0]!)!.branch !== c.branch &&
        commits.get(c.parents[0]!)!.branch !== o.branch
      const room = groups.find(
        (g) =>
          g.depth === d &&
          g.commits.every((o) => {
            const [a, b] = spanOf(o)
            return hi < a || lo > b || sibling(o)
          }),
      )
      if (room) room.commits.push(c)
      else groups.push({ depth: d, commits: [c] })
    }
    groups.sort((a, b) => a.depth - b.depth) // Stable: rows of a depth keep their order.
  } else for (const c of gg.commits) groups.push({ depth: 0, commits: [c] })
  const rowOf = new Map<string, number>()
  groups.forEach((g, i) => g.commits.forEach((c) => rowOf.set(c.id, i)))
  // A branch is drawn solid from its first commit to its last (or the last
  // commit that takes something from it); outside that it is only the dotted
  // branch line, which `showBranches: false` removes.
  const firstSeq = gg.branches.map(() => Infinity)
  const lastSeq = gg.branches.map(() => -Infinity)
  for (const c of gg.commits) {
    const i = lane.get(c.branch)!
    const r = rowOf.get(c.id)!
    firstSeq[i] = Math.min(firstSeq[i]!, r)
    lastSeq[i] = Math.max(lastSeq[i]!, r)
    const o = c.parents[1] === undefined ? undefined : commits.get(c.parents[1])
    if (o) {
      const k = lane.get(o.branch)!
      lastSeq[k] = Math.max(lastSeq[k]!, r)
    }
  }
  const idle = gg.config.showBranches ? g.dotted : ' '

  const sym = (c: GitCommit): string => {
    switch (c.customType ?? c.type) {
      case 'REVERSE':
        return g.reverse
      case 'HIGHLIGHT':
        return g.highlight
      case 'MERGE':
        return g.merge
      case 'CHERRY_PICK':
        return g.cherry
      default:
        return g.normal
    }
  }

  const rows: string[] = []
  // Visible width of each row: colour modes wrap rows in escapes or HTML.
  const rowWidths: number[] = []
  for (const [row, group] of groups.entries()) {
    // cells[i] is the glyph at lane i; `fill` are the horizontal join cells between lanes.
    const cells: { ch: string; lane: number }[] = []
    const put = (at: number, ch: string, l: number): void => {
      cells[at] = { ch, lane: l }
    }
    for (let i = 0; i < lanes; i++)
      put(
        x[i]!,
        row >= firstSeq[i]! && row <= lastSeq[i]! ? g.vertical : idle,
        i,
      )
    for (const c of group.commits) {
      const col = lane.get(c.branch)!

      // The commit this one grows out of on another lane, or the one it takes.
      const first = commits.get(c.parents[0] ?? '')
      const other =
        c.parents[1] !== undefined ? commits.get(c.parents[1]) : undefined
      const joins: { from: number; fork: boolean }[] = []
      if (first && first.branch !== c.branch)
        joins.push({ from: lane.get(first.branch)!, fork: true })
      // A pick of a commit on the lane it already forked from adds no second join.
      if (other && !joins.some((j) => j.from === lane.get(other.branch)))
        joins.push({ from: lane.get(other.branch)!, fork: false })
      for (const j of joins) {
        if (j.from === col) continue
        const lo = Math.min(j.from, col)
        const hi = Math.max(j.from, col)
        for (let cx = x[lo]! + 1; cx < x[hi]!; cx++) {
          const crossing = x.includes(cx)
          const lane2 = x.indexOf(cx)
          put(cx, crossing ? g.cross : g.horizontal, crossing ? lane2 : j.from)
        }
        const left = j.from < col
        put(
          x[j.from]!,
          j.fork
            ? left
              ? g.forkRight
              : g.forkLeft
            : up
              ? left
                ? g.joinDownRight
                : g.joinDownLeft
              : left
                ? g.joinUpRight
                : g.joinUpLeft,
          j.from,
        )
      }
    }
    // The glyphs last: a commit sits on the line another fork of its row passes.
    for (const c of group.commits) {
      const col = lane.get(c.branch)!
      put(x[col]!, sym(c), col)
    }

    let line = ''
    for (let cx = 0; cx < graphWidth; cx++) {
      const cell = cells[cx]
      line += cell ? paint(cell.ch, colorOf(cell.lane)) : ' '
    }
    // Left to right by lane, so the ids read in the order of the glyphs above them.
    const caption = [...group.commits]
      .sort((a, b) => lane.get(a.branch)! - lane.get(b.branch)!)
      .map((c) => {
        const label =
          gg.config.showCommitLabel &&
          c.type !== 'CHERRY_PICK' &&
          (c.type !== 'MERGE' || c.customId)
            ? c.id
            : ''
        const tags = c.tags.map((t) => `[${t}]`).join(' ')
        return [label, tags].filter(Boolean).join('  ')
      })
      .filter(Boolean)
      .join(', ')
    rowWidths.push(
      graphWidth + (caption === '' ? 0 : 2 + displayWidth(caption)),
    )
    rows.push(
      caption === ''
        ? line.replace(/\s+$/, '')
        : `${line}  ${paint(caption, theme.fg)}`,
    )
  }

  // The names over (or, for BT, under) their columns.
  const header = (): string => {
    let line = ''
    let at = 0
    gg.branches.forEach((_, i) => {
      line += ' '.repeat(Math.max(0, x[i]! - at))
      line += paint(names[i]!, colorOf(i))
      at = x[i]! + displayWidth(names[i]!)
    })
    return line
  }
  const body = up ? [...rows].reverse() : rows
  const out: string[] = []
  if (gg.title) {
    const width = Math.max(graphWidth, ...rowWidths)
    const pad = Math.max(0, Math.floor((width - displayWidth(gg.title)) / 2))
    out.push(' '.repeat(pad) + paint(gg.title, theme.fg), '')
  }
  if (gg.config.showBranches && !up) out.push(header())
  out.push(...body)
  if (gg.config.showBranches && up) out.push(header())
  if (body.length === 0 && !gg.config.showBranches) out.push('')
  return out.join('\n')
}
