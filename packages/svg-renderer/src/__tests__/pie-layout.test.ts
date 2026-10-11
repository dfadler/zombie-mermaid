import { describe, it, expect } from 'vitest'
import { parsePieChart } from '@zombie-mermaid/mermaid-parser'
import type { PositionedPieChart } from '@zombie-mermaid/mermaid-parser'
import { layoutPieChart, PIE } from '../pie/layout.ts'
import { estimateTextWidth } from '../styles.ts'

// Geometry follows Mermaid's pieRenderer.ts (default config): a 450px frame,
// radius 185 at (225, 225), slices clockwise from 12 o'clock in source
// order, labels at 0.75r, legend 216px right of the centre, rows 22px apart.

const layout = (src: string): PositionedPieChart =>
  layoutPieChart(parsePieChart(src))

const TAU = Math.PI * 2
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6)

describe('pie layout: Mermaid frame', () => {
  it('uses a 450px-tall frame with radius 185 centred at (225, 225)', () => {
    const p = layout('pie\n  "A" : 1\n  "B" : 1')
    expect(p.height).toBe(450)
    expect(p.radius).toBe(185)
    expect(p.cx).toBe(225)
    expect(p.cy).toBe(225)
    // Outline circle: radius + half the 2px outer stroke.
    expect(p.outerRadius).toBe(186)
  })

  it('places the title centred over the pie, baseline 25px from the top', () => {
    const p = layout('pie title Pets\n  "A" : 1')
    expect(p.title).toEqual({ text: 'Pets', x: 225, y: 25 })
  })

  it('omits the title when there is none', () => {
    expect(layout('pie\n  "A" : 1').title).toBeUndefined()
  })

  it('sizes the width as pie + margin + swatch + gap + longest legend text', () => {
    const p = layout('pie\n  "Short" : 1\n  "A much longer label" : 1')
    const longest = estimateTextWidth('A much longer label', 17, 400)
    expect(p.width).toBe(Math.ceil(450 + 40 + 18 + 4 + longest))
  })

  it('widens the viewBox for a title wider than the chart, keeping the pie centred under it', () => {
    const title =
      'An extremely long pie chart title that runs well past the legend'
    const p = layout(`pie title ${title}\n  "A" : 1`)
    const titleW = estimateTextWidth(title, 25, 400)
    expect(titleW / 2).toBeGreaterThan(225)
    // Content shifted right by the overhang on the left.
    close(p.cx, titleW / 2)
    close(p.title!.x, p.cx)
    expect(p.width).toBeGreaterThanOrEqual(Math.floor(titleW))
  })
})

describe('pie layout: slices', () => {
  it("draws slices in source order, clockwise from 12 o'clock, unsorted", () => {
    const p = layout('pie\n  "Small" : 10\n  "Big" : 70\n  "Mid" : 20')
    expect(p.slices.map((s) => s.label)).toEqual(['Small', 'Big', 'Mid'])
    close(p.slices[0]!.startAngle, 0)
    close(p.slices[0]!.endAngle, 0.1 * TAU)
    close(p.slices[1]!.startAngle, 0.1 * TAU)
    close(p.slices[1]!.endAngle, 0.8 * TAU)
    close(p.slices[2]!.endAngle, TAU)
    // First slice starts at the top of the circle.
    expect(p.slices[0]!.path.startsWith('M225,40A185,185,0,0,1,')).toBe(true)
  })

  it('angles always cover exactly the full circle', () => {
    const p = layout('pie\n  "A" : 3.3\n  "B" : 7.1\n  "C" : 12.9\n  "D" : 0.9')
    const sweep = p.slices.reduce((t, s) => t + (s.endAngle - s.startAngle), 0)
    close(sweep, TAU)
  })

  it('labels each slice with toFixed(0) of its share, at 0.75 of the radius', () => {
    const p = layout(
      'pie\n  "Calcium" : 42.96\n  "Potassium" : 50.05\n  "Magnesium" : 10.01\n  "Iron" : 5',
    )
    // Mermaid's own docs example renders 40% / 46% / 9% / 5%.
    expect(p.slices.map((s) => s.percentText)).toEqual([
      '40%',
      '46%',
      '9%',
      '5%',
    ])
    for (const s of p.slices) {
      const mid = (s.startAngle + s.endAngle) / 2
      close(s.labelX, 225 + 185 * 0.75 * Math.sin(mid))
      close(s.labelY, 225 - 185 * 0.75 * Math.cos(mid))
    }
  })

  it('uses whole-number percentages only, even for shares like 33.3%', () => {
    const p = layout('pie\n  "A" : 1\n  "B" : 1\n  "C" : 1')
    expect(p.slices.map((s) => s.percentText)).toEqual(['33%', '33%', '33%'])
  })

  it('draws a single slice as a full circle labelled 100%, label straight below the centre', () => {
    const p = layout('pie\n  "Only" : 5')
    expect(p.slices).toHaveLength(1)
    const s = p.slices[0]!
    expect(s.percentText).toBe('100%')
    expect(s.path).toBe('M225,40A185,185,0,1,1,225,410A185,185,0,1,1,225,40Z')
    close(s.labelX, 225)
    close(s.labelY, 225 + 185 * 0.75)
  })

  it('leaves out slices under 1% but keeps them in the legend; the rest fill the circle', () => {
    const p = layout('pie\n  "Big" : 995\n  "Tiny" : 5\n  "Other" : 100')
    // Tiny = 5/1100 = 0.45%.
    expect(p.slices.map((s) => s.label)).toEqual(['Big', 'Other'])
    expect(p.legend.map((l) => l.text)).toEqual(['Big', 'Tiny', 'Other'])
    // Drawn slices share the full circle between them...
    close(p.slices[0]!.endAngle, (995 / 1095) * TAU)
    close(p.slices[1]!.endAngle, TAU)
    // ...but percentages are of the whole total, omitted slices included.
    expect(p.slices.map((s) => s.percentText)).toEqual(['90%', '9%'])
  })

  it('keeps a slice of exactly 1%', () => {
    const p = layout('pie\n  "A" : 99\n  "B" : 1')
    expect(p.slices.map((s) => s.label)).toEqual(['A', 'B'])
    expect(p.slices[1]!.percentText).toBe('1%')
  })

  it('does not draw zero-value slices', () => {
    const p = layout('pie\n  "A" : 0\n  "B" : 4\n  "C" : 0')
    expect(p.slices.map((s) => s.label)).toEqual(['B'])
    expect(p.legend).toHaveLength(3)
  })

  it('draws no slices when every value is zero', () => {
    const p = layout('pie\n  "A" : 0\n  "B" : 0')
    expect(p.slices).toEqual([])
    expect(p.legend).toHaveLength(2)
  })

  it('keeps palette slots tied to source position, so an omitted slice still uses one', () => {
    const p = layout('pie\n  "A" : 500\n  "Tiny" : 1\n  "C" : 500')
    expect(p.slices.map((s) => s.colorIndex)).toEqual([0, 2])
    expect(p.legend.map((l) => l.colorIndex)).toEqual([0, 1, 2])
  })

  it('wraps colours after 12 slices', () => {
    const lines = Array.from({ length: 14 }, (_, i) => `  "S${i}" : 10`)
    const p = layout(`pie\n${lines.join('\n')}`)
    expect(p.slices.map((s) => s.colorIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1,
    ])
  })
})

describe('pie layout: legend', () => {
  it('lists every slice to the right of the pie, 22px apart, centred on it', () => {
    const p = layout('pie\n  "A" : 1\n  "B" : 2\n  "C" : 3\n  "D" : 4')
    expect(p.legend.map((l) => l.x)).toEqual([441, 441, 441, 441])
    // translate(216, i * 22 - 22 * 4 / 2) from the centre.
    expect(p.legend.map((l) => l.y)).toEqual([181, 203, 225, 247])
    for (const l of p.legend) {
      expect(l.size).toBe(18)
      expect(l.textX).toBe(l.x + 22)
      expect(l.textY).toBe(l.y + 14)
    }
  })

  it('shows `label [value]` with showData, value printed as-is', () => {
    const p = layout(
      'pie showData\n  "A" : 1234567\n  "B" : 42.50\n  "C" : 0.125',
    )
    expect(p.legend.map((l) => l.text)).toEqual([
      'A [1234567]',
      'B [42.5]',
      'C [0.125]',
    ])
  })

  it('shows the bare label without showData', () => {
    expect(layout('pie\n  "A" : 1').legend[0]!.text).toBe('A')
  })

  it('grows the viewBox for a legend taller than the frame instead of clipping it', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `  "S${i}" : 1`)
    const p = layout(`pie\n${lines.join('\n')}`)
    // Mermaid would start the legend at 225 - 330 = -105, above the frame.
    const first = p.legend[0]!
    const last = p.legend[p.legend.length - 1]!
    expect(first.y).toBe(0)
    expect(last.y + last.size).toBeLessThanOrEqual(p.height)
    // The pie moved down by the same amount and keeps its frame.
    expect(p.cy).toBe(225 + 105)
    expect(p.height).toBe(30 * 22 - 4)
  })
})

describe('pie layout: empty chart', () => {
  it('draws only the circle and title for a bare `pie`', () => {
    const p = layout('pie title Nothing yet')
    expect(p.slices).toEqual([])
    expect(p.legend).toEqual([])
    expect(p.title?.text).toBe('Nothing yet')
    expect(p.height).toBe(450)
    // No legend: the pie and its right margin only, not a cropped half.
    expect(p.width).toBe(PIE.height + PIE.margin)
  })
})

describe('pie layout: accessibility fields', () => {
  it('carries accTitle and accDescr through', () => {
    const p = layout(
      'pie\n  accTitle: Pets\n  accDescr: Dogs vs cats\n  "A" : 1',
    )
    expect(p.accTitle).toBe('Pets')
    expect(p.accDescr).toBe('Dogs vs cats')
  })
})
