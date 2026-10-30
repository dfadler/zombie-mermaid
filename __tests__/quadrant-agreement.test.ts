import { describe, expect, it } from 'vitest'
import {
  ourQuadrant,
  parseOfficialQuadrant,
  quadrantMismatches,
} from '../scripts/lib/quadrant-agreement.ts'

const SRC = `quadrantChart
    title T
    x-axis L --> R
    y-axis B --> U
    quadrant-1 One
    quadrant-2
    A: [0.3, 0.6]`

// Trimmed from mermaid 12.2.0's render of SRC (float noise and an empty label included).
const OFFICIAL = `<svg>
<g class="quadrant"><rect x="263" y="85" width="232" height="192" fill="#ECECFF"></rect><text x="0" y="0" font-size="16" dominant-baseline="hanging" text-anchor="middle" transform="translate(379, 90) rotate(0)">One</text></g>
<g class="quadrant"><rect x="31" y="85" width="232" height="192" fill="#f1f1ff"></rect><text x="0" y="0" font-size="16" dominant-baseline="hanging" text-anchor="middle" transform="translate(147, 90) rotate(0)"></text></g>
<line x1="30" y1="85" x2="496" y2="85" style="stroke: rgb(1, 2, 3); stroke-width: 2;"></line>
<circle cx="170.2" cy="162.00000000000003" r="5" fill="x"></circle>
<text x="0" y="0" font-size="12" dominant-baseline="hanging" text-anchor="middle" transform="translate(170.2, 167.00000000000003) rotate(0)">A</text>
<text x="0" y="0" font-size="16" dominant-baseline="hanging" text-anchor="middle" transform="translate(5, 363) rotate(-90)">B</text>
</svg>`

describe('quadrant figure agreement', () => {
  const official = parseOfficialQuadrant(OFFICIAL)

  it('parses rects, lines, circles and texts', () => {
    expect(official.rects).toEqual([
      [263, 85, 232, 192],
      [31, 85, 232, 192],
    ])
    expect(official.lines).toEqual([[30, 85, 496, 85, 2]])
    expect(official.circles).toEqual([[170.2, 162.00000000000003, 5]])
    expect(
      official.texts.map((t) => [t.text, t.x, t.y, t.rotation]),
    ).toContainEqual(['B', 5, 363, -90])
  })

  it('flattens our layout the same way', () => {
    const ours = ourQuadrant(SRC)
    expect(ours.rects).toHaveLength(4)
    expect(ours.lines).toHaveLength(6)
    expect(ours.circles).toHaveLength(1)
    expect(ours.texts.map((t) => t.text)).toContain('T')
  })

  it('reports no mismatch for identical figures, ignoring empty texts and float noise', () => {
    const ours = ourQuadrant(SRC)
    expect(quadrantMismatches(ours, ours)).toEqual([])
    const noisy = parseOfficialQuadrant(OFFICIAL)
    noisy.rects = ours.rects
    noisy.lines = ours.lines
    noisy.circles = [[ours.circles[0]![0] + 1e-9, ours.circles[0]![1], 5]]
    noisy.texts = [
      ...ours.texts,
      {
        text: '',
        x: 0,
        y: 0,
        fontSize: 16,
        anchor: 'middle',
        baseline: 'hanging',
        rotation: 0,
      },
    ]
    expect(quadrantMismatches(noisy, ours)).toEqual([])
  })

  it('reports a moved rect, line, circle and text, and a count difference', () => {
    const ours = ourQuadrant(SRC)
    const moved = structuredClone(ours)
    moved.rects[0]![0] += 1
    moved.lines[0]![4] += 1
    moved.circles[0]![2] += 1
    moved.texts[0]!.y += 1
    moved.texts.pop()
    moved.circles.push([0, 0, 1])
    const out = quadrantMismatches(ours, moved)
    expect(out.some((l) => l.startsWith('rects[0]'))).toBe(true)
    expect(out.some((l) => l.startsWith('lines[0]'))).toBe(true)
    expect(out.some((l) => l.startsWith('circles[0]'))).toBe(true)
    expect(out.some((l) => l.startsWith('texts:'))).toBe(true)
    expect(out.some((l) => l.startsWith('circles:'))).toBe(true)
    expect(out.some((l) => l.startsWith('text "'))).toBe(true)
  })
})
