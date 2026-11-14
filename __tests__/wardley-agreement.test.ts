import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  parseWardleySvg,
  wardleyMismatches,
  wardleySvgMismatches,
} from '../scripts/lib/wardley-agreement.ts'

// Mermaid 12.3.0's render of every `Wardley:` sample and of the edge cases in
// WARDLEY_EXTRA_SOURCES, without its CSS (scripts/wardley-oracle.ts --write-fixture).
const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/wardley-official-12.3.0.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { source: string; official: string }>

describe('wardley oracle agreement', () => {
  for (const [title, { source, official }] of Object.entries(FIXTURE)) {
    it(`agrees with mermaid 12.3.0 on "${title}"`, () => {
      expect(wardleyMismatches(source, official)).toEqual([])
    })
  }

  const tea = FIXTURE['Wardley: Tea Shop']!
  const reparse = () => parseWardleySvg(tea.official)

  it('reads the drawing in order, each element with its group', () => {
    const svg = reparse()
    expect(svg.viewBox).toBe('0 0 900 600')
    expect(svg.elements[0]).toMatchObject({ group: 'wardley-map', tag: 'rect' })
    const groups = [...new Set(svg.elements.map((e) => e.group))]
    expect(groups.slice(0, 5)).toEqual([
      'wardley-map',
      'wardley-axes',
      'wardley-stages',
      'wardley-links',
      'wardley-trends',
    ])
    expect(groups).toContain('wardley-node wardley-node--anchor')
    expect(
      svg.elements.filter((e) => e.group === 'wardley-links'),
    ).toHaveLength(8)
  })

  it('reports a different size and element count', () => {
    const o = reparse()
    const u = reparse()
    u.viewBox = '0 0 800 600'
    u.elements.pop()
    const out = wardleySvgMismatches(o, u).join('\n')
    expect(out).toContain('viewBox: 0 0 900 600 official, 0 0 800 600 ours')
    expect(out).toContain(
      `elements: ${o.elements.length} official, ${u.elements.length} ours`,
    )
  })

  it('reports a moved node, changed text and a different element', () => {
    const o = reparse()
    const u = reparse()
    const circle = u.elements.find((e) => e.tag === 'circle')!
    circle.attrs.cx = '1'
    const label = u.elements.find((e) => e.text === 'Cup')!
    label.text = 'Mug'
    const line = u.elements.findIndex((e) => e.group === 'wardley-links')
    u.elements[line]!.tag = 'path'
    delete u.elements[line + 1]!.attrs.x1
    const out = wardleySvgMismatches(o, u).join('\n')
    expect(out).toMatch(/wardley-node [\w -]*\d+: cx [\d.]+ official, 1 ours/)
    expect(out).toMatch(/text "Cup" official, "Mug" ours/)
    expect(out).toMatch(/element \d+: line in wardley-links official, path/)
    expect(out).toMatch(/wardley-links \d+: x1 [\d.]+ official, absent ours/)
  })

  it('tolerates rounding but not a real difference', () => {
    const o = reparse()
    const u = reparse()
    const circle = u.elements.find((e) => e.tag === 'circle')!
    circle.attrs.cx = String(Number(circle.attrs.cx) + 0.004)
    expect(wardleySvgMismatches(o, u)).toEqual([])
    circle.attrs.cx = String(Number(circle.attrs.cx) + 0.5)
    expect(wardleySvgMismatches(o, u)[0]).toMatch(/wardley-node [^:]*\d+: cx/)
  })

  it('lets the annotations box differ in width by 10% but not more', () => {
    const notes = FIXTURE['Wardley: Annotations and Notes']!
    const o = parseWardleySvg(notes.official)
    const u = parseWardleySvg(notes.official)
    const box = u.elements.find(
      (e) => e.group === 'wardley-annotations-box' && e.tag === 'rect',
    )!
    const width = Number(box.attrs.width)
    box.attrs.width = String(width * 1.05)
    expect(wardleySvgMismatches(o, u)).toEqual([])
    box.attrs.width = String(width * 1.5)
    expect(wardleySvgMismatches(o, u)[0]).toMatch(/annotations-box \d+: width/)
  })
})
