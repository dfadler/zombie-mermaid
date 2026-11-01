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

/** The arrow into D and the corner of the return, as row numbers. */
function rows(out: string): { into: number; back: number } {
  const lines = out.split('\n')
  const last = (re: RegExp) => lines.map((l) => re.test(l)).lastIndexOf(true)
  return { into: last(/[►◄]/), back: last(/[└┘]/) }
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

  // Paired snapshots (repo rule: SVG + ASCII). The fix is ASCII-only, so the
  // SVG snapshot pins that SVG output stays unchanged.
  it('snapshots ASCII and SVG for the issue source', () => {
    const src = SRC('LR', '[/Ask Again/]')
    expect(renderMermaidASCII(src)).toMatchSnapshot('ascii')
    expect(renderMermaidSVG(src)).toMatchSnapshot('svg')
  })
})
