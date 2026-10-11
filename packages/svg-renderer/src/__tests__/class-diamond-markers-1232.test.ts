import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../../../../src/index.ts'

// String slicing rather than RegExp(variable): the repo's Semgrep gate blocks
// non-literal regexes (detect-non-literal-regexp), even in tests.
const marker = (svg: string, id: string) => {
  const start = svg.indexOf(`<marker id="${id}"`)
  const end = svg.indexOf('</marker>', start)
  return start === -1 || end === -1 ? '' : svg.slice(start, end)
}

const attrValue = (def: string, attr: string) => {
  const start = def.indexOf(`${attr}="`) + attr.length + 2
  return def.slice(start, def.indexOf('"', start))
}

const num = (def: string, attr: string) => Number(attrValue(def, attr))

const relationship = (svg: string, type: string) =>
  svg.split('<polyline').find((p) => p.includes(`data-type="${type}"`)) ?? ''

// The diamond's tip must sit on the line's endpoint. With orient
// auto-start-reverse the marker's +x points away from the line at the start,
// so refX has to be the tip's x; refX=0 pushes the whole diamond outward
// under the class box (#1232). The polygon must also be inset by half its
// stroke, or the marker viewport clips the diamond's points flat.
const unscoped = (svg: string) => svg.replace(/zm[0-9a-z]+-/g, '')

describe('class diagram diamond markers (#1232)', () => {
  const cases = [
    ['composition', 'C *-- D', 'cls-composition', 'var(--_arrow)'],
    ['aggregation', 'E o-- F', 'cls-aggregation', 'var(--bg)'],
  ] as const

  for (const [type, line, id, fill] of cases) {
    it(`${type} references its marker at the owning end`, () => {
      const svg = unscoped(renderMermaidSVG(`classDiagram\n  ${line}`))
      expect(relationship(svg, type)).toContain(`marker-start="url(#${id})"`)
      expect(marker(svg, id)).toContain(`fill="${fill}"`)
    })

    it(`${type} anchors its tip on the endpoint without clipping the stroke`, () => {
      const def = marker(
        unscoped(renderMermaidSVG(`classDiagram\n  ${line}`)),
        id,
      )
      const points = attrValue(def, 'points')
        .split(',')
        .map((p) => p.trim().split(/\s+/).map(Number) as [number, number])
      const xs = points.map((p) => p[0])
      const ys = points.map((p) => p[1])
      const half = num(def, 'stroke-width') / 2
      expect(num(def, 'refX')).toBe(Math.max(...xs))
      expect(Math.min(...xs) - half).toBeGreaterThanOrEqual(0)
      expect(Math.min(...ys) - half).toBeGreaterThanOrEqual(0)
      expect(Math.max(...xs) + half).toBeLessThanOrEqual(
        num(def, 'markerWidth'),
      )
      expect(Math.max(...ys) + half).toBeLessThanOrEqual(
        num(def, 'markerHeight'),
      )
    })
  }
})
