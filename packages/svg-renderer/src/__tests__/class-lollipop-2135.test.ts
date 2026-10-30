/**
 * Class SVG lollipop interfaces (#2135). mermaid.js (12.1.0 and 12.2.0 agree)
 * draws `A ()-- B` as the name `A` above a circle joined to `B` by a stem: no
 * class box for `A` unless something else gives it one, and no edge to a class
 * `A`. Here the interface end is a label-only layout node.
 */
import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutClassDiagramSync } from '../class/layout.ts'
import { renderMermaidSVG } from '../index.ts'

const layout = (src: string) =>
  layoutClassDiagramSync(parseClassDiagram(splitStatements(src)))
const ids = (src: string) => layout(src).classes.map((c) => c.id)
const unscoped = (svg: string) => svg.replace(/zm[0-9a-z]+-/g, '')

describe('one-ended lollipop is a label node, not a class box', () => {
  it('`I ()-- H` puts the name above the host, joined by a marked stem', () => {
    const p = layout('classDiagram\n  I ()-- H')
    expect(p.classes.map((c) => c.id)).toEqual(['H'])
    const rel = p.relationships[0]!
    const label = rel.interfaceLabel!
    const host = p.classes[0]!
    expect(label.text).toBe('I')
    expect(label.y + label.height).toBeLessThanOrEqual(host.y)
    // The line runs from the interface (marker end) down to the host.
    expect(rel.points[0]!.y).toBeLessThan(rel.points.at(-1)!.y)
    expect(rel.points.at(-1)!.y).toBeCloseTo(host.y)
  })

  it('`H --() I` puts the name below the host', () => {
    const p = layout('classDiagram\n  H --() I')
    expect(p.classes.map((c) => c.id)).toEqual(['H'])
    const label = p.relationships[0]!.interfaceLabel!
    expect(label.y).toBeGreaterThanOrEqual(
      p.classes[0]!.y + p.classes[0]!.height,
    )
  })

  it('renders the name as bare text with the circle on the interface end only', () => {
    const svg = unscoped(renderMermaidSVG('classDiagram\n  I ()-- H'))
    expect(svg).toContain('<g class="class-interface" data-id="I"')
    expect(svg).not.toContain('data-id="I" data-label="I">\n  <rect')
    expect(svg.match(/class="class-node"/g)).toHaveLength(1)
    expect(svg).toMatch(/marker-start="url\(#cls-lollipop\)"/)
    expect(svg).not.toMatch(/marker-end="url\(#cls-lollipop\)"/)
    const svg2 = unscoped(renderMermaidSVG('classDiagram\n  H --() I'))
    expect(svg2).toMatch(/marker-end="url\(#cls-lollipop\)"/)
    expect(svg2).not.toMatch(/marker-start="url\(#cls-lollipop\)"/)
  })

  it('hangs several interfaces off one host, each on its own line', () => {
    const p = layout(
      'classDiagram\n  A ()-- H\n  B ()-- H\n  H --() C\n  H --() D',
    )
    expect(p.classes.map((c) => c.id)).toEqual(['H'])
    expect(p.relationships.map((r) => r.interfaceLabel?.text)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ])
    const host = p.classes[0]!
    const [a, b, c, d] = p.relationships.map((r) => r.interfaceLabel!)
    expect(a!.y).toBeLessThan(host.y)
    expect(b!.y).toBeLessThan(host.y)
    expect(c!.y).toBeGreaterThan(host.y)
    expect(d!.y).toBeGreaterThan(host.y)
    expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x) // Siblings don't overlap
  })

  it('keeps the relationship label and cardinalities on the stem', () => {
    const p = layout('classDiagram\n  A "1" ()-- "n" H : provides')
    const rel = p.relationships[0]!
    expect([rel.label, rel.fromCardinality, rel.toCardinality]).toEqual([
      'provides',
      '1',
      'n',
    ])
    expect(rel.labelPosition).toBeDefined()
  })

  it('uses the class label when the interface was declared with one', () => {
    const p = layout('classDiagram\n  class `Two Words`\n  `Two Words` ()-- H')
    expect(p.relationships[0]!.interfaceLabel!.text).toBe('Two Words')
  })
})

describe('an interface keeps its box when something else gives it one', () => {
  it.each([
    ['an annotation', 'class I {\n    <<interface>>\n  }\n  I ()-- H'],
    ['members', 'class I {\n    +run()\n  }\n  I ()-- H'],
    ['another relationship', 'I ()-- H\n  I --> X'],
    ['a note', 'I ()-- H\n  note for I "hi"'],
    ['a namespace', 'namespace N {\n    class I\n  }\n  I ()-- H'],
  ])('%s', (_what, body) => {
    expect(ids(`classDiagram\n  ${body}`)).toContain('I')
  })

  it('still draws the label node as well as the box', () => {
    const p = layout(
      'classDiagram\n  class I {\n    <<interface>>\n  }\n  I ()-- H',
    )
    expect(p.classes.map((c) => c.id).sort()).toEqual(['H', 'I'])
    expect(p.relationships[0]!.interfaceLabel!.text).toBe('I')
  })
})

describe('()--() has no host and stays an ordinary two-ended line', () => {
  it('keeps both boxes and a circle at both ends', () => {
    const p = layout('classDiagram\n  A ()--() B')
    expect(p.classes.map((c) => c.id)).toEqual(['A', 'B'])
    expect(p.relationships[0]!.interfaceLabel).toBeUndefined()
    const svg = unscoped(renderMermaidSVG('classDiagram\n  A ()--() B'))
    expect(svg).toMatch(/marker-start="url\(#cls-lollipop\)"/)
    expect(svg).toMatch(/marker-end="url\(#cls-lollipop\)"/)
    expect(svg).not.toContain('class-interface')
  })
})

describe('namespaces', () => {
  it("places the interface name inside its host's frame and keeps it out of classIds", () => {
    const p = layout(
      'classDiagram\n  namespace N {\n    class H\n  }\n  I ()-- H',
    )
    const frame = p.namespaces[0]!
    const label = p.relationships[0]!.interfaceLabel!
    expect(frame.classIds).toEqual(['H'])
    expect(label.x).toBeGreaterThanOrEqual(frame.x)
    expect(label.y).toBeGreaterThanOrEqual(frame.y)
    expect(label.x + label.width).toBeLessThanOrEqual(frame.x + frame.width)
  })
})

describe('diagrams without a lollipop are untouched', () => {
  it('emits no interface group and no lollipop marker', () => {
    const svg = renderMermaidSVG('classDiagram\n  A <|-- B')
    expect(svg).not.toContain('class-interface')
    expect(svg).not.toContain('cls-lollipop')
  })
})
