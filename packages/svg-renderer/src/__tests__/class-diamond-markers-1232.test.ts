import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../../../../src/index.ts'

const marker = (svg: string, id: string) => {
  const m = svg.match(new RegExp(`<marker id="${id}"[^>]*>[\\s\\S]*?</marker>`))
  return m?.[0] ?? ''
}

// The diamond's tip is at x=12 of a 12-wide marker. With orient
// auto-start-reverse the marker's +x points away from the line at the start,
// so the tip must sit on the endpoint (refX=12); refX=0 pushes the whole
// diamond outward under the class box (#1232).
describe('class diagram diamond markers (#1232)', () => {
  const cases = [
    ['composition', 'C *-- D', 'cls-composition', 'var(--_arrow)'],
    ['aggregation', 'E o-- F', 'cls-aggregation', 'var(--bg)'],
  ] as const

  for (const [type, line, id, fill] of cases) {
    it(`${type} references its marker at the owning end and anchors the tip on the endpoint`, () => {
      const svg = renderMermaidSVG(`classDiagram\n  ${line}`)
      expect(svg).toMatch(
        new RegExp(`data-type="${type}"[^>]*marker-start="url\\(#${id}\\)"`),
      )
      const def = marker(svg, id)
      expect(def).toContain('refX="12"')
      expect(def).toContain(`fill="${fill}"`)
    })
  }
})
