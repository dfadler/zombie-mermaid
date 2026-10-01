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
})
