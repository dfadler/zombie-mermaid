/**
 * Treemap layout and SVG. Geometry expectations are measured from
 * mermaid@12.3.0 rendering the same sources (d3-hierarchy's squarified
 * layout, then `setupViewPortForSVG`); colours are this library's own.
 */
import { describe, it, expect } from 'vitest'
import { parseTreemap } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../index.ts'
import { layoutTreemap } from '../treemap/layout.ts'

const layout = (src: string) => layoutTreemap(parseTreemap(src))
const NESTED = `treemap-beta
"Products"
    "Electronics"
        "Phones": 800
        "Laptops": 600
    "Clothing"
        "Men": 300
        "Women": 400
"Services": 200`

describe('layoutTreemap', () => {
  it('places sections and leaves where d3 does in mermaid', () => {
    const p = layout(NESTED)
    // Mermaid's viewBox is "2 27 996 371": the 8px padding around the rects.
    expect(p.width).toBe(996)
    expect(p.height).toBe(371)
    const box = (s: {
      x: number
      y: number
      width: number
      height: number
    }) => [s.x, s.y, s.width, s.height]
    expect(p.sections.map((s) => [s.name, ...box(s)])).toEqual([
      ['', 0, 0, 1000, 400],
      ['Products', 10, 35, 894, 355],
      ['Electronics', 20, 70, 579, 310],
      ['Clothing', 609, 70, 285, 310],
    ])
    expect(p.leaves.map((l) => [l.name, ...box(l)])).toEqual([
      ['Phones', 30, 105, 315, 265],
      ['Laptops', 355, 105, 234, 265],
      ['Women', 619, 105, 147, 265],
      ['Men', 776, 105, 108, 265],
      ['Services', 914, 35, 76, 355],
    ])
  })

  it('shows totals and fits labels like Mermaid', () => {
    const p = layout(NESTED)
    expect(p.sections[1]!.valueLabel!.text).toBe('2,100')
    expect(p.leaves[0]!.label).toMatchObject({ text: 'Phones', fontSize: 38 })
    expect(p.leaves[0]!.valueLabel).toMatchObject({ text: '800', fontSize: 23 })
    // Shrunk to fit the narrow cell; the value follows at 0.6 of it.
    expect(p.leaves[4]!.label!.fontSize).toBe(18)
    expect(p.leaves[4]!.valueLabel!.fontSize).toBe(11)
  })

  it('numbers colours by first use in breadth-first order, root first', () => {
    const p = layout(NESTED)
    expect(p.sections.map((s) => s.color)).toEqual([0, 1, 2, 3])
    // A leaf takes its section's colour; a top-level leaf has the transparent root's.
    expect(p.leaves.map((l) => l.color)).toEqual([2, 2, 3, 3, 0])
  })

  it('wraps the colour scale after twelve sections', () => {
    const src =
      'treemap-beta\n' +
      Array.from(
        { length: 14 },
        (_, i) => `"S${i}"\n  "L${i}": ${10 + i}\n`,
      ).join('')
    const p = layout(src)
    expect(p.sections.map((s) => s.color)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 1,
    ])
  })

  it('uses smaller labels, and hides the ones that do not fit, with over 20 leaves', () => {
    const src =
      'treemap-beta\n"R"\n' +
      Array.from(
        { length: 24 },
        (_, i) => `  "Leaf ${i}": ${i === 0 ? 1000 : 1}\n`,
      ).join('')
    const p = layout(src)
    expect(p.leaves[0]!.label!.fontSize).toBeLessThanOrEqual(16)
    expect(p.leaves.some((l) => l.label === undefined)).toBe(true)
  })

  it('truncates a section label with an ellipsis and drops the value that would not fit', () => {
    const p = layout(
      'treemap-beta\n"A very long section name that cannot fit"\n  "x": 1\n"Other"\n  "y": 400',
    )
    const s = p.sections.find((x) => x.name.startsWith('A very'))!
    expect(s.label.text.endsWith('...')).toBe(true)
    expect(s.label.text.length).toBeLessThan(s.name.length)
  })

  it('draws an empty treemap as a transparent canvas', () => {
    const p = layout('treemap-beta\n')
    expect(p.leaves).toHaveLength(1)
    expect(p.leaves[0]).toMatchObject({ width: 1000, height: 400, color: 0 })
    expect(p.leaves[0]!.label).toBeUndefined()
  })

  it('spreads a zero-valued treemap without NaN', () => {
    const p = layout('treemap-beta\n"R"\n  "A": 0\n  "B": 0')
    expect(JSON.stringify(p)).not.toContain('null')
    expect(p.leaves).toHaveLength(2)
  })

  it('puts the title above the tree and into the viewBox', () => {
    const p = layout('treemap-beta\ntitle T\n"R"\n  "A": 5')
    expect(p.title).toMatchObject({ text: 'T', x: 500, y: 15 })
    expect(p.treeOffsetY).toBe(30)
    // Mermaid's viewBox is "2 -2.34 996 430.34" for a title and one section.
    expect(p.width).toBe(996)
    expect(p.height).toBeCloseTo(430.34, 1)
  })
})

describe('layoutTreemap config', () => {
  const body =
    '\n"A"\n  "A1": 3000\n  "A2": 1234.5\n"B"\n  "B1": 400\n  "B2": 0.25'
  const withCfg = (cfg: string) =>
    layout(`%%{init: {"treemap": ${cfg}}}%%\ntreemap-beta${body}`)

  it('sizes the canvas from nodeWidth and nodeHeight (x10; 0 falls back to 960 x 500)', () => {
    // Measured in mermaid@12.3.0: viewBox widths 596 and 956, heights 171 and 471.
    expect(withCfg('{"nodeWidth": 60, "nodeHeight": 20}')).toMatchObject({
      width: 596,
      height: 171,
    })
    expect(withCfg('{"nodeWidth": 0, "nodeHeight": 0}')).toMatchObject({
      width: 956,
      height: 471,
    })
  })

  it('reads padding, which sets the gap between siblings', () => {
    // Mermaid@12.3.0 with padding 4: sections at x 10 (895 wide) and 909 (81 wide).
    const p = withCfg('{"padding": 4}')
    expect(p.sections.slice(1).map((s) => [s.x, s.width])).toEqual([
      [10, 895],
      [909, 81],
    ])
  })

  it('reads diagramPadding into the viewBox', () => {
    expect(withCfg('{"diagramPadding": 30}')).toMatchObject({
      width: 1040,
      height: 415,
    })
  })

  it('drops every total with showValues: false and gives the section label the room', () => {
    const on = layout(`treemap-beta${body}`)
    const off = withCfg('{"showValues": false}')
    expect(off.sections.some((s) => s.valueLabel)).toBe(false)
    expect(off.leaves.some((l) => l.valueLabel)).toBe(false)
    expect(on.leaves.some((l) => l.valueLabel)).toBe(true)
    // Boxes do not move; labels still fit (mermaid@12.3.0 hides only the value texts).
    expect(off.leaves.map((l) => l.label?.text)).toEqual(
      on.leaves.map((l) => l.label?.text),
    )
  })

  it.each([
    ['$0,0', '$1,234.5'],
    ['$,.2f', '$1.2e+3'],
    ['$.1f', '$1234.5'],
    ['.1%', '123450.0%'],
    ['.2f', '1234.50'],
    ['s', '1.23450k'],
    ['.3~s', '1.23k'],
    ['zzz', '1,234.5'],
  ])('formats values with valueFormat %s like mermaid@12.3.0', (fmt, a2) => {
    const p = withCfg(`{"valueFormat": "${fmt}"}`)
    expect(p.leaves.find((l) => l.name === 'A2')!.valueLabel!.text).toBe(a2)
  })

  it('ignores a bad value and keys mermaid does not read', () => {
    const base = layout(`treemap-beta${body}`)
    expect(
      withCfg(
        '{"padding": -3, "nodeWidth": "wide", "showValues": "no", "borderWidth": 5, "labelFontSize": 30, "valueFontSize": 30, "useMaxWidth": false}',
      ),
    ).toEqual(base)
  })
})

describe('renderMermaidSVG – treemap', () => {
  it('draws sections, then leaves with their text', () => {
    const svg = renderMermaidSVG(NESTED)
    expect(svg).toContain('viewBox="0 0 996 371"')
    expect(svg.match(/class="treemapSection"/g)).toHaveLength(3)
    expect(svg.match(/class="treemapNode treemapLeafGroup"/g)).toHaveLength(5)
    expect(svg).toMatch(/class="treemapLabel"[^>]*>Phones</)
    expect(svg).toMatch(/class="treemapSectionValue"[^>]*>2,100</)
    expect(svg).toContain('role="img"')
  })

  it('names the diagram from accTitle and escapes names', () => {
    const svg = renderMermaidSVG(
      'treemap-beta\naccTitle: Budget\n"A <b> & c"\n  "x": 5',
    )
    expect(svg).toContain('Budget')
    expect(svg).toContain('A &lt;b&gt; &amp; c')
  })

  it('applies safe classDef styles and ignores unsafe ones', () => {
    const svg = renderMermaidSVG(
      'treemap-beta\n"R"\n  "A": 5:::kk\nclassDef kk fill:#f96,stroke:url(javascript:x),stroke-width:4px,color:red,x:y',
    )
    expect(svg).toContain(
      'style="fill:#f96 !important;stroke-width:4px !important;x:y !important"',
    )
    expect(svg).toContain('style="fill:red !important"')
    expect(svg).not.toContain('javascript')
  })

  it('routes every classDef property like mermaid: label ones to the text, the rest to the box', () => {
    // Measured in mermaid@12.3.0: opacity/dash/rx/filter to the rect, `color` as
    // `fill` and the font and text properties to both texts, all `!important`.
    const svg = renderMermaidSVG(
      'treemap-beta\n"R"\n  "A": 5:::kk\nclassDef kk opacity:0.5,stroke-dasharray:4 2,rx:5,font-weight:700,text-transform:uppercase,color:#080,font-size:9px,fill:red,fill:blue',
    )
    expect(svg).toContain(
      'style="opacity:0.5 !important;stroke-dasharray:4 2 !important;rx:5 !important;fill:blue !important"',
    )
    const text =
      'style="font-weight:700 !important;text-transform:uppercase !important;fill:#080 !important"'
    // The leaf's font size comes from the layout, not the class (the section keeps it).
    expect(svg.split(text).length).toBe(3)
    expect(svg).not.toContain('font-size:9px !important')
  })

  it('drops classDef values that could fetch a resource or break the declaration', () => {
    const svg = renderMermaidSVG(
      [
        'treemap-beta\n"R"\n  "A": 5:::kk',
        'classDef kk filter:url(http://evil/x.svg#f),background:image-set("http://evil/a.png" 1x),cursor:ur\\6c(x),behavior:foo,mask:a/*b,display:none!important,opacity:0.4',
      ].join('\n'),
    )
    expect(svg).toContain('style="opacity:0.4 !important"')
    expect(svg).not.toContain('evil')
    expect(svg).not.toContain('behavior')
  })

  it('applies a classDef font-size to a section header and as the start of a leaf fit', () => {
    const p = layout(
      'treemap-beta\n"R":::big\n  "A": 5:::big\nclassDef big font-size:20px',
    )
    expect(p.sections[1]!.label.fontSize).toBe(20)
    expect(p.sections[1]!.valueLabel?.fontSize).toBe(20)
    // 38px normally; 20px starts the fit, so the value is 12px (0.6 x 20).
    expect(p.leaves[0]!.label?.fontSize).toBe(20)
    expect(p.leaves[0]!.valueLabel?.fontSize).toBe(12)
    // A header taller than 25px grows the viewBox, as in mermaid@12.3.0.
    const tall = layout(
      'treemap-beta\n"R":::big\n  "A": 5\nclassDef big font-size:40px',
    )
    expect(tall.height).toBeGreaterThan(
      layout('treemap-beta\n"R"\n  "A": 5').height,
    )
  })

  it('reads the treemap config from front matter', () => {
    const svg = renderMermaidSVG(
      '---\nconfig:\n  treemap:\n    nodeWidth: 60\n    nodeHeight: 20\n    valueFormat: "$0,0"\n---\ntreemap-beta\n"A": 1500\n"B": 500',
    )
    expect(svg).toContain('viewBox="0 0 596 171"')
    expect(svg).toContain('$1,500')
  })

  it('draws an unnamed section transparent with no label, and no totals with showValues: false', () => {
    const svg = renderMermaidSVG(
      '%%{init: {"treemap": {"showValues": false}}}%%\ntreemap-beta\n""\n  "A": 5:::kk\nclassDef kk color:url(x)',
    )
    expect(svg).toContain('class="treemapSection" width=')
    expect(svg).toContain('fill="transparent"')
    expect(svg).not.toContain('treemapSectionLabel"')
    expect(svg).not.toContain('treemapSectionValue"')
    expect(svg).not.toContain('url(x)')
  })

  it('ignores a classDef font-size it cannot measure', () => {
    const p = layout(
      'treemap-beta\n"R":::big\n  "A": 5:::big\nclassDef big font-size:2em',
    )
    expect(p.sections[1]!.label.fontSize).toBe(12)
    expect(p.leaves[0]!.label?.fontSize).toBe(38)
  })

  it('takes the theme accent on a dark background and Mermaid hues on a light one', () => {
    const light = renderMermaidSVG(NESTED)
    expect(light).toContain('hsl(240, 100%, 76.2745098039%)')
    const dark = renderMermaidSVG(NESTED, { bg: '#111111', fg: '#eeeeee' })
    expect(dark).not.toContain('hsl(240, 100%, 76.2745098039%)')
  })

  it('draws a transparent canvas for an empty treemap', () => {
    const svg = renderMermaidSVG('treemap-beta\n')
    expect(svg).toContain('fill="transparent"')
  })

  it('draws sections with no colour slot and the visible title', () => {
    const svg = renderMermaidSVG(
      'treemap-beta\ntitle Hi\n"A": 1\n"B"\n  "C": 2',
    )
    expect(svg).toMatch(/class="treemapTitle"[^>]*>Hi</)
  })
})
