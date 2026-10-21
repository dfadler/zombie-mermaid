/**
 * Whole-canvas ASCII invariants over every gallery sample (#1858).
 * Checker: __tests__/helpers/ascii-invariants.ts. New samples are covered
 * automatically; a known renderer bug goes in KNOWN below with its issue
 * number (an entry that stops failing is itself an error, so it can't rot).
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { samples } from '../packages/site/samples-data.ts'
import { xychartSamples } from '../packages/site/xychart-samples-data.ts'
import {
  checkAll,
  checkArms,
  checkArrowheads,
  checkEqualWidth,
  checkNodeTextClear,
  toGrid,
  type Rule,
} from './helpers/ascii-invariants.ts'

/** Sample title -> issue tracking the renderer bug (unicode charset). */
const KNOWN: Record<string, string> = {}

/** Rules a diagram kind does not promise (pie/xychart are ragged by design). */
function skipFor(source: string): Rule[] {
  if (/^\s*(xychart|pie)/m.test(source)) return ['equal-width', 'arms']
  if (/^\s*sequenceDiagram/m.test(source)) return ['arms'] // lifelines/frames
  if (/^\s*erDiagram/m.test(source)) return ['arms'] // Crow's-foot `│` marks
  return []
}

const cases = [
  ...samples.filter((s) => s.category !== 'Hero'),
  ...xychartSamples,
]

describe('ASCII canvas invariants over all samples (#1858)', () => {
  for (const s of cases) {
    for (const useAscii of [false, true]) {
      const known = KNOWN[s.title]
      it(`${s.title} (${useAscii ? 'ascii' : 'unicode'})`, () => {
        const out = renderMermaidASCII(s.source, {
          colorMode: 'none',
          useAscii,
        })
        const vs = checkAll(out, {
          unicode: !useAscii,
          skip: skipFor(s.source),
          er: /^\s*erDiagram/m.test(s.source),
        })
        if (known && !useAscii) {
          expect(
            vs.length,
            `${known} may be fixed: drop from KNOWN`,
          ).toBeGreaterThan(0)
        } else {
          expect(vs.map((x) => x.message)).toEqual([])
        }
      })
    }
  }
})

describe('checker sabotage (rules fire on a corrupted grid)', () => {
  const good = renderMermaidASCII('flowchart TD\n  A --> B', {
    colorMode: 'none',
  })
  const grid = () => toGrid(good)
  const find = (g: string[][], ch: string): [number, number] => {
    for (let y = 0; y < g.length; y++) {
      const x = g[y]!.indexOf(ch)
      if (x >= 0) return [x, y]
    }
    throw new Error(`no ${ch}`)
  }

  it('is clean on an intact canvas', () => {
    expect(checkAll(good, { unicode: true })).toEqual([])
  })
  it('flags a ragged row', () => {
    const g = grid()
    g[1]!.pop()
    expect(checkEqualWidth(g)).toHaveLength(1)
  })
  it('flags an arrowhead whose stem was erased', () => {
    const g = grid()
    const [x, y] = find(g, '▼')
    g[y - 1]![x] = ' '
    expect(checkArrowheads(g).length).toBeGreaterThan(0)
  })
  it('flags an orphan stub when a neighbour is erased', () => {
    const g = grid()
    const [x, y] = find(g, '▼')
    g[y]![x] = ' '
    g[y - 2]![x] = ' '
    expect(checkArms(g).length).toBeGreaterThan(0)
  })
  it('flags a connector glyph inside node text', () => {
    const g = grid()
    const [x, y] = find(g, 'A')
    g[y]![x] = '─'
    g[y]![x + 1] = 'B'
    expect(checkNodeTextClear(g).length).toBeGreaterThan(0)
  })
})
