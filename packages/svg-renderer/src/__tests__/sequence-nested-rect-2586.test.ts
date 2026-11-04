/**
 * #2586: nested `rect` paints above its outer `rect`; every `rect` stays under
 * loop/alt frames. Matches the DOM order of mermaid 12.3.0 (rects first, outer
 * before inner, frame lines after).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

const svg = (body: string) => renderMermaidSVG('sequenceDiagram\nA->>B: x\n' + body)
const at = (s: string, needle: string) => {
  const i = s.indexOf(needle)
  expect(i).toBeGreaterThan(-1)
  return i
}
const C1 = 'rgb(200, 220, 255)'
const C2 = 'rgb(255, 220, 200)'
const C3 = 'rgb(200, 255, 200)'

describe('nested rect z-order (#2586)', () => {
  it('draws the outer rect before the inner one', () => {
    const s = svg(`rect ${C1}\nA->>B: x\nrect ${C2}\nB->>A: inner\nend\nend`)
    expect(at(s, C2)).toBeGreaterThan(at(s, C1))
  })

  it('orders three nested rects outer to inner', () => {
    const s = svg(
      `rect ${C1}\nA->>B: a\nrect ${C2}\nB->>A: b\nrect ${C3}\nA->>B: c\nend\nend\nend`,
    )
    expect(at(s, C3)).toBeGreaterThan(at(s, C2))
    expect(at(s, C2)).toBeGreaterThan(at(s, C1))
  })

  it('keeps a rect under a loop frame around it and a loop frame inside it', () => {
    const inLoop = svg(`loop L\nrect ${C1}\nA->>B: in\nend\nend`)
    const loopIn = svg(`rect ${C1}\nloop L\nA->>B: in\nend\nend`)
    for (const s of [inLoop, loopIn]) {
      expect(at(s, C1)).toBeLessThan(at(s, 'data-type="loop"'))
    }
  })
})
