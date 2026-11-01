/**
 * #2492: `B -->|no| D` beside `D --> B` in LR, with B a diamond and D a
 * parallelogram, drew one merged route. Mermaid sends `no` out of the diamond's
 * right corner and into D's side, and the return D -> B leaves D's side below
 * it, runs left under `no` and enters the diamond's lower-right face: the two
 * do not cross and neither uses the bottom vertex. The branches share the right
 * face (`fanOutCentered`), the back edge goes for that face, and `nestedRow`
 * gives the pair rows that follow their lanes.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SRC = (d: string, shape: string): string => `graph ${d}
  A --> B{Valid?}
  B -->|yes| C
  B -->|no| D${shape}
  D --> B`

/**
 * The row of the arrow into D and of the return's own corner. D's box has
 * corners too, so the return's is found by following its stroke down from the
 * `▲`: the first row where that column stops being `│`.
 */
function rows(out: string): { into: number; back: number } {
  const lines = out.split('\n')
  const head = lines.findIndex((l) => l.includes('▲'))
  const col = lines[head]!.indexOf('▲')
  let back = head + 1
  while (lines[back]?.[col] === '│') back++
  const into = lines.map((l) => /[►◄]/.test(l)).lastIndexOf(true)
  return { into, back }
}

const CASES: [string, string, string][] = [
  ['LR', '[Ask Again]', '╱ ▲'],
  ['LR', '[/Ask Again/]', '╱ ▲'],
  ['LR', '[\\Ask Again\\]', '╱ ▲'],
  ['RL', '[/Ask Again/]', '▲ ╲'],
  ['RL', '[Ask Again]', '▲ ╲'],
]

describe('opposing edges at a diamond / slanted node (#2492)', () => {
  it.each(CASES)(
    '%s %s: the return enters the diamond face, below `no`, uncrossed',
    (d, shape, face) => {
      const out = renderMermaidASCII(SRC(d, shape))
      expect(out).not.toContain('┼')
      // The head sits beside the diamond's lower face, not under the vertex.
      expect(out).toContain(face)
      // The stroke runs on straight down from the head (an RL flip once
      // moved its first cell to the other side of the diamond).
      const lines = out.split('\n')
      const row = lines.findIndex((l) => l.includes('▲'))
      expect(lines[row + 1]![lines[row]!.indexOf('▲')]).toBe('│')
      // `no` and the return meet D on different rows, the return lower.
      const { into, back } = rows(out)
      expect(back).toBeGreaterThan(into)
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

  // Paired snapshots (repo rule: SVG + ASCII). The fix is ASCII-only, so the
  // SVG snapshot pins that SVG output stays unchanged.
  it('snapshots ASCII and SVG for the issue source', () => {
    const src = SRC('LR', '[/Ask Again/]')
    expect(renderMermaidASCII(src)).toMatchSnapshot('ascii')
    expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
  })
})
