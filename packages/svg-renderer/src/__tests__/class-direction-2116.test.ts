/**
 * Class `direction` in SVG (#2116). mermaid.js (12.1.0 and 12.2.0 agree) lays
 * the diagram out left to right for LR, mirrors that for RL and flips the
 * stack for BT; notes, namespace frames and lollipop names follow the axis.
 */
import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutClassDiagramSync } from '../class/layout.ts'
import { renderMermaidSVG } from '../index.ts'

const layout = (src: string, direction?: 'LR' | 'RL' | 'BT' | 'TB') =>
  layoutClassDiagramSync(
    {
      ...parseClassDiagram(splitStatements(src)),
      ...(direction ? { direction } : {}),
    },
    {},
  )
const box = (p: ReturnType<typeof layout>, id: string) =>
  p.classes.find((c) => c.id === id)!
const DIRS = ['TB', 'LR', 'RL', 'BT'] as const
const src = (d: string, body: string) =>
  `classDiagram\n  direction ${d}\n${body}`
const chain = '  A <|-- B\n  B <|-- C'

describe('class direction: level axis', () => {
  it('TB stacks A, B, C downwards in one column', () => {
    const p = layout(src('TB', chain))
    const [a, b, c] = ['A', 'B', 'C'].map((id) => box(p, id))
    expect(a!.y).toBeLessThan(b!.y)
    expect(b!.y).toBeLessThan(c!.y)
    expect(a!.x).toBe(c!.x)
  })
  it('LR puts A, B, C in one row, left to right', () => {
    const p = layout(src('LR', chain))
    const [a, b, c] = ['A', 'B', 'C'].map((id) => box(p, id))
    expect(a!.x).toBeLessThan(b!.x)
    expect(b!.x).toBeLessThan(c!.x)
    expect(a!.y).toBe(c!.y)
  })
  it('RL mirrors LR', () => {
    const p = layout(src('RL', chain))
    const [a, b, c] = ['A', 'B', 'C'].map((id) => box(p, id))
    expect(a!.x).toBeGreaterThan(b!.x)
    expect(b!.x).toBeGreaterThan(c!.x)
    expect(a!.y).toBe(c!.y)
  })
  it('BT flips the stack: the parent is at the bottom', () => {
    const p = layout(src('BT', chain))
    const [a, b, c] = ['A', 'B', 'C'].map((id) => box(p, id))
    expect(a!.y).toBeGreaterThan(b!.y)
    expect(b!.y).toBeGreaterThan(c!.y)
    expect(a!.x).toBe(c!.x)
  })
  it('no direction line is top-down, identical to `direction TB`', () => {
    expect(renderMermaidSVG(`classDiagram\n${chain}`)).toBe(
      renderMermaidSVG(src('TB', chain)),
    )
  })
  it('RenderOptions.direction still does not apply to class diagrams', () => {
    expect(renderMermaidSVG(src('TB', chain), { direction: 'LR' })).toBe(
      renderMermaidSVG(src('TB', chain)),
    )
  })
})

describe('class direction: edges and markers end on the boxes', () => {
  const near = (v: number, t: number) => Math.abs(v - t) <= 1
  const onBorder = (
    b: { x: number; y: number; width: number; height: number },
    pt: { x: number; y: number },
  ) =>
    ((near(pt.x, b.x) || near(pt.x, b.x + b.width)) &&
      pt.y >= b.y - 1 &&
      pt.y <= b.y + b.height + 1) ||
    ((near(pt.y, b.y) || near(pt.y, b.y + b.height)) &&
      pt.x >= b.x - 1 &&
      pt.x <= b.x + b.width + 1)
  for (const d of DIRS) {
    it(`${d}: every relationship starts and ends on its boxes`, () => {
      const p = layout(
        src(
          d,
          '  A <|-- B\n  A "1" --> "*" C : owns\n  B ..> C\n  Shape ()-- A',
        ),
      )
      for (const r of p.relationships) {
        const from = p.classes.find((c) => c.id === r.from)
        const to = p.classes.find((c) => c.id === r.to)
        const label = r.interfaceLabel
        const a = r.points[0]!
        const z = r.points.at(-1)!
        if (from) expect(onBorder(from, a)).toBe(true)
        if (to) expect(onBorder(to, z)).toBe(true)
        // The lollipop pseudo-node sits at the interface end.
        if (label) expect(onBorder(label, a) || onBorder(label, z)).toBe(true)
      }
    })
  }
  it('keeps the marker end on the relationship, whatever the direction', () => {
    for (const d of DIRS) {
      const svg = renderMermaidSVG(src(d, '  A <|-- B'))
      expect(svg).toMatch(/data-marker-at="from"/)
      expect(svg).toMatch(/marker-start="url\(#[^)]*inherit/)
    }
  })
})

describe('class direction: namespaces, notes and lollipops follow the axis', () => {
  for (const d of DIRS) {
    it(`${d}: a namespace frame encloses its classes`, () => {
      const p = layout(
        src(
          d,
          '  namespace Core {\n    class A\n    class B\n  }\n  class C\n  A <|-- B\n  B --> C',
        ),
      )
      const ns = p.namespaces[0]!
      expect(ns.classIds).toEqual(['A', 'B'])
      for (const id of ns.classIds) {
        const c = box(p, id)
        expect(c.x).toBeGreaterThanOrEqual(ns.x)
        expect(c.y).toBeGreaterThanOrEqual(ns.y)
        expect(c.x + c.width).toBeLessThanOrEqual(ns.x + ns.width)
        expect(c.y + c.height).toBeLessThanOrEqual(ns.y + ns.height)
      }
      expect(p.width).toBeGreaterThanOrEqual(ns.x + ns.width)
      expect(p.height).toBeGreaterThanOrEqual(ns.y + ns.height)
    })
  }

  it('a `note for` note sits before its class on the flow axis', () => {
    const body = '  A <|-- B\n  note for A "hi"'
    const lr = layout(src('LR', body))
    expect(lr.notes[0]!.x + lr.notes[0]!.width).toBeLessThanOrEqual(
      box(lr, 'A').x,
    )
    const rl = layout(src('RL', body))
    expect(rl.notes[0]!.x).toBeGreaterThanOrEqual(
      box(rl, 'A').x + box(rl, 'A').width,
    )
    const tb = layout(src('TB', body))
    expect(tb.notes[0]!.y + tb.notes[0]!.height).toBeLessThanOrEqual(
      box(tb, 'A').y,
    )
    const bt = layout(src('BT', body))
    expect(bt.notes[0]!.y).toBeGreaterThanOrEqual(
      box(bt, 'A').y + box(bt, 'A').height,
    )
  })

  it('a lollipop name hangs off its host on the opposite side of the flow', () => {
    const at = (d: string) => {
      const p = layout(src(d, '  Shape ()-- Host'))
      return {
        host: box(p, 'Host'),
        label: p.relationships[0]!.interfaceLabel!,
      }
    }
    const tb = at('TB')
    expect(tb.label.y + tb.label.height).toBeLessThanOrEqual(tb.host.y)
    const bt = at('BT')
    expect(bt.label.y).toBeGreaterThanOrEqual(bt.host.y + bt.host.height)
    const lr = at('LR')
    expect(lr.label.x + lr.label.width).toBeLessThanOrEqual(lr.host.x)
    const rl = at('RL')
    expect(rl.label.x).toBeGreaterThanOrEqual(rl.host.x + rl.host.width)
  })
})
