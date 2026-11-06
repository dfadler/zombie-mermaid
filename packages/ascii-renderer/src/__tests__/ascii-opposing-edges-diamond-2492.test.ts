/**
 * #2492: `B -->|no| D` beside `D --> B` in LR, with B a diamond and D a
 * parallelogram, drew one merged route. Mermaid sends `no` out of the diamond's
 * right corner and into D's side, and the return D -> B leaves D's side below
 * it, runs left under `no` and enters the diamond's lower-right face: the two
 * do not cross and neither uses the bottom vertex. The branches share the right
 * face (`fanOutCentered`), the back edge goes for that face, and `nestedRow`
 * gives the pair rows that follow their lanes.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js.
// Mermaid 12.3.0 verdict (#2708): matches (label level, 1 source); the edge route (#2492) and geometry are not compared (#2678).
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SRC = (d: string, shape: string): string => `graph ${d}
  A --> B{Valid?}
  B -->|yes| C
  B -->|no| D${shape}
  D --> B`

const CASES: [string, string, string][] = [
  ['LR', '[Ask Again]', '╱◄'],
  ['LR', '[/Ask Again/]', '╱◄'],
  ['LR', '[\\Ask Again\\]', '╱◄'],
  ['RL', '[/Ask Again/]', '►╲'],
  ['RL', '[Ask Again]', '►╲'],
]

describe('opposing edges at a diamond / slanted node (#2492)', () => {
  it.each(CASES)(
    '%s %s: the return enters the lower slant of the diamond, below `no`, uncrossed',
    (d, shape, face) => {
      const out = renderMermaidASCII(SRC(d, shape))
      expect(out).not.toContain('┼')
      // The head meets the diamond's lower slant, in a horizontal run: the
      // return no longer comes up from under the diamond (#2645).
      expect(out).toContain(face)
      expect(out).not.toContain('▲')
      // `no` arrives above D's label row and the return leaves below it.
      const lines = out.split('\n')
      const label = lines.findIndex((l) => l.includes('Ask Again'))
      const into = lines.map((l) => /[►◄]/.test(l)).lastIndexOf(true)
      expect(into).toBeLessThan(label)
      expect(lines[label + 1]).toMatch(/└─|─┘/)
    },
  )

  // A second return edge takes a lane of its own; the direct route is only
  // for the first, so neither edge nor its label is lost.
  it('draws every return edge of a parallel pair with its label', () => {
    const out = renderMermaidASCII(`graph LR
  A --> B{Valid?}
  B -->|yes| C
  B -->|no| D[Ask Again]
  D -->|one| B
  D -->|two| B`)
    for (const label of ['yes', 'no', 'one', 'two']) {
      expect(out).toContain(label)
    }
  })

  // Mermaid centres the decision between its branches and keeps its parent on
  // its row: C above, D below, A and B level. The back edge `D --> B` used to
  // switch the whole graph's centring off, leaving C on B's row.
  it.each(['LR', 'RL'])(
    '%s: the decision sits level with its parent, between its branches',
    (d) => {
      const lines = renderMermaidASCII(
        `graph ${d}
  A[Read Input] --> B{Valid?}
  B -->|yes| C[Write Output]
  B -->|no| D[Ask Again]
  D --> B`,
      ).split('\n')
      const at = (s: string) => lines.findIndex((l) => l.includes(s))
      expect(at('Read Input')).toBe(at('Valid?'))
      expect(at('Write Output')).toBeLessThan(at('Valid?'))
      expect(at('Ask Again')).toBeGreaterThan(at('Valid?'))
      expect(at('Valid?') - at('Write Output')).toBe(
        at('Ask Again') - at('Valid?'),
      )
    },
  )

  // Paired snapshots (repo rule: SVG + ASCII). The fix is ASCII-only, so the
  // SVG snapshot pins that SVG output stays unchanged.
  it('snapshots ASCII and SVG for the issue source', () => {
    const src = SRC('LR', '[/Ask Again/]')
    expect(renderMermaidASCII(src)).toMatchSnapshot('ascii')
    expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
  })
})
