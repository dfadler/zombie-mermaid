/**
 * #2645 PR 4b: each edge end takes the face ELK's route uses, and the ends on a
 * face follow ELK's order along it. Measured against ELK's own hints with the
 * same face and order readings the topology script uses.
 */
import { describe, expect, it } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import {
  DEFAULT_ASCII_THEME,
  registerAsciiLayout,
  type AsciiFace,
} from '@zombie-mermaid/ascii-renderer'
import { renderGraphAscii } from '../packages/ascii-renderer/src/flowchart.ts'
import type { AsciiGraph } from '../packages/ascii-renderer/src/types.ts'
import { allForkFixes } from '../demo/fork-fixes-data.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const entry = (id: string): string =>
  allForkFixes.find((f) => f.id === id)!.source

/**
 * For every node face holding two or more ends, the hint order of those ends
 * and the order they are drawn in (left to right, or top to bottom, in the
 * SVG orientation: RL and BT are mirrored back).
 */
function faceOrders(source: string): { hint: number[]; drawn: number[] }[] {
  registerAsciiLayout(asciiLayoutProvider)
  const parsed = parseMermaid(source)
  const hints = asciiLayoutProvider.graph!(parsed)!
  const dir = parsed.direction
  const out: { hint: number[]; drawn: number[] }[] = []
  const afterDraw = (g: AsciiGraph): void => {
    const groups = new Map<string, { order: number; at: number }[]>()
    g.edges.forEach((e) => {
      const h = hints.edges.find((x) => x.index === e.parsedIndex)
      if (!h || !e.ends || e.from === e.to) return
      for (const [end, hint, node] of [
        [e.ends.start, h.start, e.from],
        [e.ends.end, h.end, e.to],
      ] as const) {
        // The drawn cell sits one step outside the border for an arrowhead, so
        // read the order from the hint's own face and the drawn cross position.
        const vertical = hint.face === 'T' || hint.face === 'B'
        const flip = (dir === 'RL' && vertical) || (dir === 'BT' && !vertical)
        const k = `${node.name}|${hint.face}`
        groups.set(k, [
          ...(groups.get(k) ?? []),
          {
            order: hint.order,
            at: (vertical ? end.x : end.y) * (flip ? -1 : 1),
          },
        ])
      }
    })
    for (const list of groups.values()) {
      if (list.length < 2) continue
      out.push({
        hint: list.map((x) => x.order),
        drawn: list.map((x) => x.at),
      })
    }
  }
  renderGraphAscii(
    parsed,
    {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    },
    'none',
    DEFAULT_ASCII_THEME,
    { layoutHints: true },
    { afterDraw },
  )
  return out
}

/** Of two ends on a face, the one ELK ranks first is drawn first; equal ranks (a pair) are not compared. */
const inOrder = ({ hint, drawn }: { hint: number[]; drawn: number[] }) =>
  hint.every((a, i) =>
    hint.every((b, j) => a >= b || drawn[i]! < drawn[j]!),
  )

const FEEDBACK = entry('ascii-feedback-edge-sibling-order')
const LONGEST = entry('ascii-longest-path-layering')
const DIAMOND = entry('ascii-opposing-edges-diamond')

describe('edge-end faces follow ELK (#2645)', () => {
  it.each([
    ['feedback edge', FEEDBACK],
    ['longest path', LONGEST],
    ['opposing edges at a diamond', DIAMOND],
  ])('%s: every end is on ELK’s face', (_name, source) => {
    const c = measureSample(source)
    expect(c.faceEnds).toBeGreaterThan(0)
    expect(c.faceOk).toBe(c.faceEnds)
  })

  // Reciprocal pairs laid out side by side are lane groups (#629) and keep
  // their own faces, so the horizontal variants use the feedback source.
  it.each(['LR', 'RL', 'BT', 'TB'])(
    'the feedback source laid out %s keeps ends on ELK’s face',
    (d) => {
      const c = measureSample(FEEDBACK.replace('graph TD', `graph ${d}`))
      expect(c.faceOk).toBe(c.faceEnds)
    },
  )
})

describe('ends on a face follow ELK’s order (#2645)', () => {
  it.each([
    ['TD', LONGEST],
    ['BT', LONGEST.replace('graph TD', 'graph BT')],
    ['feedback', FEEDBACK],
    ['feedback LR', FEEDBACK.replace('graph TD', 'graph LR')],
    ['feedback RL', FEEDBACK.replace('graph TD', 'graph RL')],
    ['feedback BT', FEEDBACK.replace('graph TD', 'graph BT')],
  ])('%s', (_name, source) => {
    const faces = faceOrders(source)
    expect(faces.length).toBeGreaterThan(0)
    for (const f of faces) expect(inOrder(f)).toBe(true)
  })
})
