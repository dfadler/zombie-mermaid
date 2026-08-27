/**
 * Tests for the expanded node syntax `A@{ shape: ..., label: ... }`
 * (#198 rows 3, 13, 14 — Mermaid v11.3.0+).
 *
 * The syntax did not parse at all before: `A@{ shape: doc }` fell through to
 * the bare-id pattern, registering a node called `A` and stranding the whole
 * metadata block as unparsed text on the line.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'
import {
  parseExpandedMeta,
  matchExpandedBlock,
  resolveShapeName,
  knownShapeNames,
} from '../expanded-shapes.ts'

function parse(statement: string) {
  return parseMermaid(`flowchart TD\n  ${statement}`)
}

describe('metadata block scanning', () => {
  it('finds a simple block and reports its length', () => {
    const match = matchExpandedBlock('@{ shape: rect }')
    expect(match).toEqual({ body: ' shape: rect ', length: 16 })
  })

  it('stops at the closing brace, leaving the rest of the line', () => {
    const match = matchExpandedBlock('@{ shape: rect } --> C')
    expect(match?.length).toBe(16)
  })

  it('is not terminated by a brace inside a quoted value', () => {
    // A naive indexOf('}') would cut the block at the label's brace.
    const match = matchExpandedBlock('@{ label: "a } b" } --> C')
    expect(match?.body).toBe(' label: "a } b" ')
  })

  it('returns undefined for an unterminated block', () => {
    expect(matchExpandedBlock('@{ shape: rect')).toBeUndefined()
  })

  it('returns undefined when the text does not open with @{', () => {
    expect(matchExpandedBlock('[rect]')).toBeUndefined()
  })
})

describe('metadata key/value parsing', () => {
  it('parses a single key', () => {
    expect(parseExpandedMeta(' shape: rounded ')).toEqual({ shape: 'rounded' })
  })

  it('parses several keys and strips quotes', () => {
    expect(parseExpandedMeta(' shape: doc, label: "Report" ')).toEqual({
      shape: 'doc',
      label: 'Report',
    })
  })

  it('does not split on a comma or colon inside a quoted value', () => {
    expect(parseExpandedMeta(' label: "a, b: c", shape: rect ')).toEqual({
      label: 'a, b: c',
      shape: 'rect',
    })
  })

  it('treats a bare value as shorthand for shape', () => {
    expect(parseExpandedMeta(' rounded ')).toEqual({ shape: 'rounded' })
  })

  it('keeps icon/image keys', () => {
    expect(
      parseExpandedMeta(' icon: "fa:bell", form: circle, label: "Alert" '),
    ).toEqual({ icon: 'fa:bell', form: 'circle', label: 'Alert' })
  })

  it('preserves unrecognized keys rather than dropping them', () => {
    expect(parseExpandedMeta(' shape: rect, pos: b ')).toEqual({
      shape: 'rect',
      pos: 'b',
    })
  })
})

describe('shape name resolution', () => {
  it('resolves every documented name', () => {
    const unresolved = knownShapeNames().filter((n) => !resolveShapeName(n))
    expect(unresolved).toEqual([])
  })

  it('is case-insensitive and tolerates surrounding space', () => {
    expect(resolveShapeName('  Rounded ')).toBe('rounded')
    expect(resolveShapeName('LEAN-R')).toBe('parallelogram')
  })

  it('maps aliases of one concept to the same geometry', () => {
    for (const group of [
      ['rect', 'rectangle', 'proc', 'process'],
      ['cyl', 'cylinder', 'db', 'database'],
      ['diam', 'diamond', 'decision', 'question'],
      ['doc', 'document'],
      ['notch-rect', 'card', 'notched-rectangle'],
    ]) {
      const resolved = group.map((n) => resolveShapeName(n))
      expect(new Set(resolved).size, `${group.join('/')} disagree`).toBe(1)
    }
  })

  it('returns undefined for an unknown name', () => {
    expect(resolveShapeName('not-a-real-shape')).toBeUndefined()
  })
})

describe('parsing A@{ ... } nodes', () => {
  it('applies shape and label', () => {
    const graph = parse('A@{ shape: rounded, label: "Start" } --> B')
    expect(graph.nodes.get('A')?.shape).toBe('rounded')
    expect(graph.nodes.get('A')?.label).toBe('Start')
    expect(graph.edges).toHaveLength(1)
  })

  it('falls back to the node id when no label is given', () => {
    expect(parse('A@{ shape: doc } --> B').nodes.get('A')?.label).toBe('A')
  })

  it('supports the expanded form on both ends of an edge', () => {
    const graph = parse('A@{ shape: doc } --> B@{ shape: cyl, label: "DB" }')
    expect(graph.nodes.get('A')?.shape).toBe('document')
    expect(graph.nodes.get('B')?.shape).toBe('cylinder')
    expect(graph.nodes.get('B')?.label).toBe('DB')
  })

  it('keeps a brace inside the label out of the block scan', () => {
    const graph = parse('A@{ shape: diamond, label: "a } b" } --> B')
    expect(graph.nodes.get('A')?.label).toBe('a } b')
    expect([...graph.nodes.keys()].sort()).toEqual(['A', 'B'])
  })

  it('falls back to a rectangle for an unknown shape name', () => {
    // Mermaid adds shape names regularly; rendering a plain box beats
    // failing the whole diagram over one unrecognized name.
    const graph = parse('A@{ shape: nonexistent-shape } --> B')
    expect(graph.nodes.get('A')?.shape).toBe('rectangle')
    expect(graph.edges).toHaveLength(1)
  })

  it('takes an icon node outline from form:, not shape:', () => {
    expect(
      parse(
        'A@{ icon: "fa:bell", form: circle, label: "Alert" } --> B',
      ).nodes.get('A')?.shape,
    ).toBe('circle')
    expect(
      parse('A@{ icon: "fa:bell", form: rounded } --> B').nodes.get('A')?.shape,
    ).toBe('rounded')
    // Mermaid's default form is a square.
    expect(parse('A@{ icon: "fa:bell" } --> B').nodes.get('A')?.shape).toBe(
      'rectangle',
    )
  })

  it('shows the icon or image reference when no label is given', () => {
    // This renderer draws neither FontAwesome glyphs nor remote images, so
    // the reference keeps the node identifiable instead of leaving it blank.
    expect(parse('A@{ icon: "fa:bell" } --> B').nodes.get('A')?.label).toBe(
      'fa:bell',
    )
    expect(
      parse('A@{ img: "https://x/y.png" } --> B').nodes.get('A')?.label,
    ).toBe('https://x/y.png')
  })

  it('works in a chain and with parallel links', () => {
    expect(parse('A@{ shape: doc } --> B --> C').edges).toHaveLength(2)
    expect(parse('A@{ shape: doc } --> B & C').edges).toHaveLength(2)
  })
})

describe('every shape name renders in both backends', () => {
  const names = knownShapeNames()

  it('covers the full documented Mermaid shape list', () => {
    expect(names.length).toBeGreaterThan(100)
  })

  it.each(names)('renders %s without throwing', (name) => {
    const source = `flowchart TD\n  A@{ shape: ${name}, label: "${name}" } --> B`
    expect(() => renderMermaidSVG(source)).not.toThrow()
    expect(() =>
      renderMermaidASCII(source, { colorMode: 'none' }),
    ).not.toThrow()
  })

  it('draws no outline for shape: text', () => {
    const svg = renderMermaidSVG(
      'flowchart TD\n  A@{ shape: text, label: "bare" } --> B',
    )
    // The label is still present...
    expect(svg).toContain('bare')
    // ...and exactly one node rect is emitted (for B), not two.
    const rects = svg.match(/<rect [^>]*class=|<rect /g) ?? []
    expect(rects.length).toBeLessThan(3)
  })
})

describe('classic bracket syntax is unaffected', () => {
  it.each([
    ['A[rect] --> B', 'rectangle'],
    ['A(round) --> B', 'rounded'],
    ['A{diamond} --> B', 'diamond'],
    ['A((circle)) --> B', 'circle'],
    ['A[/lean/] --> B', 'parallelogram'],
  ])('still parses %s', (statement, shape) => {
    expect(parse(statement).nodes.get('A')?.shape).toBe(shape)
  })

  it('still parses a bare id and a no-space arrow', () => {
    const graph = parse('A-->B')
    expect([...graph.nodes.keys()].sort()).toEqual(['A', 'B'])
    expect(graph.edges).toHaveLength(1)
  })

  it('does not treat a lone @ as an expanded block', () => {
    // Only `@{` opens the syntax; a bare `@` must not.
    const graph = parseMermaid('flowchart TD\n  A["a@b"] --> B')
    expect(graph.nodes.get('A')?.label).toBe('a@b')
  })
})
