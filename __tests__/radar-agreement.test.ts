import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  parseRadarSvg,
  radarMismatches,
  radarSvgMismatches,
} from '../scripts/lib/radar-agreement.ts'

// Mermaid 12.3.0's render of every `Radar:` sample and of the edge cases in
// RADAR_EXTRA_SOURCES, without its CSS (scripts/radar-oracle.ts --write-fixture).
const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/radar-official-12.3.0.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { source: string; official: string }>

describe('radar oracle agreement', () => {
  for (const [title, { source, official }] of Object.entries(FIXTURE)) {
    it(`agrees with mermaid 12.3.0 on "${title}"`, () => {
      expect(radarMismatches(source, official)).toEqual([])
    })
  }

  const basic = FIXTURE['Radar: Basic']!
  const reparse = () => parseRadarSvg(basic.official)

  it('reads the drawing in order', () => {
    const svg = reparse()
    expect(svg.viewBox).toBe('0 0 700 700')
    expect(svg.center).toBe('translate(350, 350)')
    const classes = svg.elements.map((e) => e.cls)
    expect(classes.filter((c) => c === 'radarGraticule')).toHaveLength(5)
    expect(classes.filter((c) => c === 'radarAxisLine')).toHaveLength(6)
    expect(classes.filter((c) => c.startsWith('radarCurve-'))).toHaveLength(2)
    expect(classes.at(-1)).toBe('radarTitle')
  })

  it('reports a different size, centre and element count', () => {
    const o = reparse()
    const u = reparse()
    expect(o.elements.length - 1).toBe(u.elements.length - 1)
    u.viewBox = '0 0 600 600'
    u.center = 'translate(300, 300)'
    u.elements.pop()
    const out = radarSvgMismatches(o, u).join('\n')
    expect(out).toMatch(/viewBox: 0 0 700 700 official, 0 0 600 600 ours/)
    expect(out).toMatch(/centre: translate\(350, 350\) official/)
    expect(out).toContain(
      `elements: ${o.elements.length} official, ${u.elements.length} ours`,
    )
  })

  it('reports a moved label, a changed curve and a different order', () => {
    const o = reparse()
    const u = reparse()
    const label = u.elements.find((e) => e.cls === 'radarAxisLabel')!
    label.attrs.y = '-300'
    label.text = 'Maths'
    const curve = u.elements.find((e) => e.cls === 'radarCurve-0')!
    curve.attrs.d = curve.attrs.d!.replace('M', 'L')
    const circle = u.elements.findIndex((e) => e.cls === 'radarGraticule')
    u.elements[circle]!.cls = 'radarAxisLine'
    const out = radarSvgMismatches(o, u).join('\n')
    expect(out).toMatch(/radarAxisLabel \d+: y -319 official, -300 ours/)
    expect(out).toMatch(/text "Math" official, "Maths" ours/)
    expect(out).toMatch(/radarCurve-0 \d+: d M/)
    expect(out).toMatch(/element \d+: circle.radarGraticule official/)
  })

  it('tolerates rounding but not a real difference', () => {
    const o = reparse()
    const u = reparse()
    const ring = u.elements.find((e) => e.cls === 'radarGraticule')!
    ring.attrs.r = String(Number(ring.attrs.r) + 0.004)
    expect(radarSvgMismatches(o, u)).toEqual([])
    ring.attrs.r = String(Number(ring.attrs.r) + 0.5)
    expect(radarSvgMismatches(o, u)[0]).toMatch(/radarGraticule \d+: r 60/)
  })
})
