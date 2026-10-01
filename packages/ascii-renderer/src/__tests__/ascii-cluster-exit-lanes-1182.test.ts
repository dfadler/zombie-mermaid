/**
 * Cluster exits mixed with parallel-lane siblings (#1182, follow-up to
 * #1148). Two edges with the same stand-in and target (`S -->|first| T`,
 * `S -->|second| T`) are lane siblings; beside other exits they used to
 * either keep the whole cluster off the shared trunk (one other exit: it
 * punched through the wall) or leave the second sibling through the
 * cluster's side wall with both lane labels on the wall row (two others).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { parseMermaid } from '../../../../src/parser.ts'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'

type Dir = 'TD' | 'LR'

const head = (dir: Dir): string => `flowchart ${dir}
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|first| T
  S -->|second| T
`

const CASES: Array<[string, Dir, string[]]> = [
  ['TD, one other exit', 'TD', ['other']],
  ['TD, two other exits', 'TD', ['other', 'more']],
  ['LR, one other exit', 'LR', ['other']],
  ['LR, two other exits', 'LR', ['other', 'more']],
]
const TD_CASES = CASES.filter(([, d]) => d === 'TD')
const LR_CASES = CASES.filter(([, d]) => d === 'LR')

const source = (dir: Dir, others: string[]): string =>
  head(dir) + others.map((o, i) => `  S -->|${o}| ${'UVW'[i]}\n`).join('')

const render = (src: string, useAscii = false): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })
    .split('\n')
    .map((l) => l.trimEnd())

const count = (lines: string[], word: string): number =>
  lines.join('\n').split(word).length - 1

describe('cluster exits with parallel-lane siblings (#1182)', () => {
  it.each(CASES)(
    '%s: the cluster engages and owns every exit',
    (_n, dir, others) => {
      const graph = convertToAsciiGraph(parseMermaid(source(dir, others)), {
        useAscii: false,
        paddingX: 6,
        paddingY: 5,
        boxBorderPadding: 1,
        graphDirection: dir,
      })
      createMapping(graph)
      const plan = [...(graph.clusterExitPlans?.values() ?? [])][0]
      expect(plan).toBeDefined()
      expect(plan!.edges.size).toBe(2 + others.length)
      expect(graph.edges.filter((e) => e.parallelLane)).toHaveLength(2)
    },
  )

  it.each(CASES)(
    '%s: every node and label appears exactly once',
    (_n, dir, others) => {
      for (const useAscii of [false, true]) {
        const lines = render(source(dir, others), useAscii)
        for (const word of ['Start', 'Cluster', 'first', 'second', ...others]) {
          expect(count(lines, word), `${word} (ascii=${useAscii})`).toBe(1)
        }
        for (const node of ['T', 'U', 'V'].slice(0, 1 + others.length)) {
          expect(
            lines.filter((l) => l.split(/\W+/).includes(node)),
            node,
          ).toHaveLength(1)
        }
      }
    },
  )

  it.each(TD_CASES)(
    '%s: only the trunk crosses the bottom wall, and no label is on it',
    (_n, dir, others) => {
      for (const useAscii of [false, true]) {
        const lines = render(source(dir, others), useAscii)
        // The cluster's bottom wall is the last full-width border row
        // (the top border, with the entry trunk, matches too).
        const wall = lines.findLastIndex((l) =>
          useAscii ? /^\+[-|]+\+$/.test(l) : /^└[─┼]+┘$/.test(l),
        )
        expect(wall).toBeGreaterThan(-1)
        const text = lines[wall]!
        expect(text).not.toMatch(/[a-z]/)
        const crossings = useAscii
          ? (text.match(/\|/g) ?? []).length
          : (text.match(/[┼┬┴├┤]/g) ?? []).length
        expect(crossings).toBe(1)
      }
    },
  )

  it.each(LR_CASES)(
    '%s: only the trunk crosses the right wall, and no label is on it',
    (_n, dir, others) => {
      const lines = render(source(dir, others))
      const top = lines.find((l) => l.includes('┐'))!
      const col = top.indexOf('┐')
      const crossing = lines
        .map((l) => l[col] ?? ' ')
        .filter((ch) => ch !== ' ' && ch !== '│' && ch !== '┐' && ch !== '┘')
      expect(crossing).toEqual(['┼'])
    },
  )

  it.each(TD_CASES)(
    '%s: no exit leaves through the stand-in node side',
    (_n, dir, others) => {
      const lines = render(source(dir, others))
      const aRow = lines.findIndex((l) => /│\s+a\s+│/.test(l))
      for (const l of lines.slice(aRow - 2, aRow + 4)) {
        expect(l).not.toMatch(/a\s+├─|┴─┼/)
      }
    },
  )

  // A third sibling has no free side face left on the target, so the group
  // keeps today's routing rather than running a lane along a node border.
  it.each(['TD', 'LR'] as const)(
    '%s: a three-sibling lane group does not engage the cluster',
    (dir) => {
      const src = `${head(dir)}  S -->|third| T\n  S -->|other| U\n  S -->|more| V\n`
      const graph = convertToAsciiGraph(parseMermaid(src), {
        useAscii: false,
        paddingX: 6,
        paddingY: 5,
        boxBorderPadding: 1,
        graphDirection: dir,
      })
      createMapping(graph)
      const plan = [...(graph.clusterExitPlans?.values() ?? [])][0]
      expect(plan).toBeDefined()
      expect([...plan!.edges].some((e) => e.parallelLane)).toBe(false)
    },
  )

  describe('node borders and label placement', () => {
    const NODE_NAMES = ['Start', 'a', 'T', 'U', 'V']

    // Where `name` sits as a whole token (not inside a longer word).
    const findToken = (
      lines: string[],
      name: string,
    ): { row: number; col: number } | undefined => {
      for (const [row, text] of lines.entries()) {
        let from = 0
        for (;;) {
          const col = text.indexOf(name, from)
          if (col < 0) break
          const before = text[col - 1] ?? ' '
          const after = text[col + name.length] ?? ' '
          if (!/\w/.test(before) && !/\w/.test(after)) return { row, col }
          from = col + 1
        }
      }
      return undefined
    }

    const boxProblems = (
      lines: string[],
      useAscii: boolean,
      others: number,
    ): string[] => {
      const problems: string[] = []
      const at = (r: number, c: number): string => lines[r]?.[c] ?? ' '
      const corners = useAscii ? ['+', '+', '+', '+'] : ['┌', '┐', '└', '┘']
      // What an edge may legitimately merge into on each kind of border cell.
      const horizontalOk = useAscii ? '-+' : '─┬┴┼'
      const verticalOk = useAscii ? '|+' : '│├┤┼'
      for (const name of NODE_NAMES.slice(0, 3 + others)) {
        const tok = findToken(lines, name)
        if (!tok) {
          problems.push(`${name}: not found`)
          continue
        }
        const { row, col } = tok
        let left = col
        while (left > 0 && !'│|├┤+'.includes(at(row, left))) left--
        let right = col
        while (
          right < (lines[row]?.length ?? 0) &&
          !'│|├┤+'.includes(at(row, right))
        )
          right++
        let top = row - 1
        while (top > 0 && at(top, col) === ' ') top--
        let bottom = row + 1
        while (bottom < lines.length && at(bottom, col) === ' ') bottom++
        const where = `${name} (box rows ${top}-${bottom}, cols ${left}-${right})`
        const cs = [
          at(top, left),
          at(top, right),
          at(bottom, left),
          at(bottom, right),
        ]
        for (const [i, glyph] of cs.entries()) {
          if (glyph !== corners[i]) {
            problems.push(
              `${where}: corner ${i} is '${glyph}', expected '${corners[i]}'`,
            )
          }
        }
        for (let c = left + 1; c < right; c++) {
          for (const r of [top, bottom]) {
            if (!horizontalOk.includes(at(r, c))) {
              problems.push(
                `${where}: border cell (${r},${c}) is '${at(r, c)}'`,
              )
            }
          }
        }
        for (let r = top + 1; r < bottom; r++) {
          for (const c of [left, right]) {
            if (!verticalOk.includes(at(r, c))) {
              problems.push(`${where}: wall cell (${r},${c}) is '${at(r, c)}'`)
            }
          }
        }
      }
      return problems
    }

    // Every node box keeps its four corners and its walls: an edge may
    // merge a junction into a border but never replace a corner or put an
    // arrowhead on it. The second lane used to run its last approach along
    // T's own border (left wall in LR, top wall in TD).
    it.each(CASES)('%s: every node box border is intact', (_n, dir, others) => {
      for (const useAscii of [false, true]) {
        expect(
          boxProblems(
            render(source(dir, others), useAscii),
            useAscii,
            others.length,
          ),
        ).toEqual([])
      }
    })

    // Two edge labels on one row need clear line between them, or they
    // read as one run ("other-more").
    it.each(CASES)('%s: no two labels abut on a row', (_n, dir, others) => {
      for (const useAscii of [false, true]) {
        const lines = render(source(dir, others), useAscii)
        const words = ['first', 'second', ...others]
        for (const [r, text] of lines.entries()) {
          const spans = words
            .map((w) => [text.indexOf(w), w.length] as const)
            .filter(([i]) => i >= 0)
            .sort((x, y) => x[0] - y[0])
          for (let i = 1; i < spans.length; i++) {
            const prev = spans[i - 1]!
            const gap = spans[i]![0] - (prev[0] + prev[1])
            expect(
              gap,
              `row ${r} (ascii=${useAscii}):\n${text}`,
            ).toBeGreaterThanOrEqual(2)
          }
        }
      }
    })

    // Each exit's label sits on that exit's own final leg, never on a run
    // another edge shares or owns.
    it.each(LR_CASES)('%s: each label is on its own leg', (_n, dir, others) => {
      const lines = render(source(dir, others))
      const rowOf = (w: string): string => lines.find((l) => l.includes(w))!
      expect(rowOf('first')).toContain('T')
      expect(rowOf('first')).not.toContain('second')
      for (const [i, o] of others.entries()) {
        expect(rowOf(o), o).toContain('UVW'[i]!)
      }
      // The second lane's label is on a row that carries no other label
      // and no node, below T.
      const secondRow = rowOf('second')
      for (const w of ['first', ...others, 'T', 'U', 'V']) {
        expect(secondRow, w).not.toContain(w)
      }
      // ...and it starts a line cell clear of the junction it turns off.
      expect(secondRow[secondRow.indexOf('second') - 1]).toBe('─')
      expect(lines.findIndex((l) => l.includes('second'))).toBeGreaterThan(
        lines.findIndex((l) => l.includes('T')),
      )
    })

    // TD: every exit drops from the shared fan-out row, and nothing is
    // written on that row between the trunk and the last drop - so the
    // second lane visibly leaves the trunk's fan-out, not another edge's
    // labelled run.
    it.each(TD_CASES)(
      '%s: the second lane leaves the unlabelled shared fan-out',
      (_n, dir, others) => {
        for (const useAscii of [false, true]) {
          const lines = render(source(dir, others), useAscii)
          const start = findToken(lines, 'Start')!
          const trunk = start.col + 2
          const second = findToken(lines, 'second')!
          const secondCol = second.col + 3
          const vertical = useAscii ? '|' : '│'
          let r = second.row - 1
          while (lines[r]?.[secondCol] === vertical) r--
          const fanOut = lines[r]!
          expect(fanOut, 'fan-out row').not.toMatch(/[a-z]/)
          expect(fanOut[trunk], 'fan-out row meets the trunk').not.toBe(' ')
          expect(
            fanOut[secondCol],
            'second lane starts on the fan-out row',
          ).not.toBe(' ')
        }
      },
    )
  })
})
