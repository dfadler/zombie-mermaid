/**
 * State-diagram styling: `classDef`, `class A,B name`, and the `S:::name`
 * shorthand (issue #1171). Previously all three were silently dropped, and
 * `S1:::foo --> S2` swallowed S1 into a bogus `::foo --> S2` state.
 *
 * The parser feeds the same `StyleDirectives` cascade flowcharts use
 * (packages/core/src/style-directives.ts); the SVG renderer applies the
 * resolved fill; the ASCII renderer follows its flowchart behavior.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { renderMermaidSVG } from '../index.ts'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const REPRO_1 = `stateDiagram-v2
  classDef foo fill:#f00
  S1 --> S2
  S2:::foo`
const REPRO_2 = `stateDiagram-v2
  classDef foo fill:#f00
  S1 --> S2
  class S2 foo`
const REPRO_3 = `stateDiagram-v2
  classDef foo fill:#f00
  S1:::foo --> S2`
const REPRO_4 = `stateDiagram-v2
  S1 --> S3
  classDef foo fill:#f00
  class S2 foo
  S4:::foo`

describe('state diagram styling (#1171)', () => {
  it('repro 1: `S2:::foo` on its own line assigns the class', () => {
    const g = parseMermaid(REPRO_1)
    expect(g.classAssignments.get('S2')).toBe('foo')
    expect(g.classDefs.get('foo')).toEqual({ fill: '#f00' })
    expect([...g.nodes.keys()]).toEqual(['S1', 'S2'])
    expect(renderMermaidSVG(REPRO_1)).toContain('#f00')
  })

  it('repro 2: `class S2 foo` assigns the class', () => {
    const g = parseMermaid(REPRO_2)
    expect(g.classAssignments.get('S2')).toBe('foo')
    expect([...g.nodes.keys()]).toEqual(['S1', 'S2'])
    expect(renderMermaidSVG(REPRO_2)).toContain('#f00')
  })

  it('repro 3: `S1:::foo --> S2` keeps S1 and styles it', () => {
    const g = parseMermaid(REPRO_3)
    expect([...g.nodes.keys()]).toEqual(['S1', 'S2'])
    expect(g.classAssignments.get('S1')).toBe('foo')
    expect(g.edges).toHaveLength(1)
    const svg = renderMermaidSVG(REPRO_3)
    expect(svg).toContain('#f00')
    expect(svg).not.toContain('::foo')
  })

  it('repro 4: no bogus `::foo` state; `class S2 foo` declares S2', () => {
    const g = parseMermaid(REPRO_4)
    expect([...g.nodes.keys()].sort()).toEqual(['S1', 'S2', 'S3', 'S4'])
    expect(g.classAssignments.get('S4')).toBe('foo')
    expect(g.classAssignments.get('S2')).toBe('foo')
    const svg = renderMermaidSVG(REPRO_4)
    expect(svg).toContain('#f00')
    expect(svg).not.toContain('::foo')
  })

  it('supports comma lists and shorthand on the target side', () => {
    const g = parseMermaid(`stateDiagram-v2
  classDef foo fill:#f00
  A --> B:::foo
  class A,B foo`)
    expect(g.classAssignments.get('A')).toBe('foo')
    expect(g.classAssignments.get('B')).toBe('foo')
  })

  it('does not treat a plain `S1 : description` line as a class', () => {
    const g = parseMermaid(`stateDiagram-v2
  S1 : hello`)
    expect(g.nodes.get('S1')?.label).toBe('hello')
    expect(g.classAssignments.size).toBe(0)
  })

  it('ASCII renders the same states as unstyled (styling parsed, not drawn as text)', () => {
    const styled = renderMermaidASCII(REPRO_3)
    const plain = renderMermaidASCII('stateDiagram-v2\n  S1 --> S2')
    expect(styled).toContain('S1')
    expect(styled).not.toContain('::foo')
    expect(styled).toBe(plain)
  })

  it('accepts spaces around commas: `class A, B foo` (documented form)', () => {
    const g = parseMermaid(`stateDiagram-v2
  A --> B
  class A, B foo`)
    expect(g.classAssignments.get('A')).toBe('foo')
    expect(g.classAssignments.get('B')).toBe('foo')
    expect([...g.nodes.keys()]).toEqual(['A', 'B'])
  })

  it('an explicit description after `S:::foo` replaces the placeholder label', () => {
    const g = parseMermaid(`stateDiagram-v2
  S:::foo
  S : Ready`)
    expect(g.nodes.get('S')?.label).toBe('Ready')
    expect(g.classAssignments.get('S')).toBe('foo')
  })

  it('a `state "Ready" as S` alias after `S:::foo` replaces the placeholder label', () => {
    const g = parseMermaid(`stateDiagram-v2
  S:::foo
  state "Ready" as S`)
    expect(g.nodes.get('S')?.label).toBe('Ready')
  })

  it('a description after a transition still sets the label', () => {
    const g = parseMermaid(`stateDiagram-v2
  A --> B
  A : desc`)
    expect(g.nodes.get('A')?.label).toBe('desc')
  })

  it('shorthand or class on a composite state does not create a node', () => {
    const g = parseMermaid(`stateDiagram-v2
  state Comp {
    X --> Y
  }
  Comp:::foo
  class Comp foo
  A --> Comp`)
    expect(g.nodes.has('Comp')).toBe(false)
    expect(g.subgraphs.map((sg) => sg.id)).toEqual(['Comp'])
  })

  it('bare shorthand inside a composite state registers the node there', () => {
    const g = parseMermaid(`stateDiagram-v2
  state Comp {
    X:::foo
  }`)
    expect(g.subgraphs[0]!.nodeIds).toContain('X')
    expect(g.classAssignments.get('X')).toBe('foo')
  })

  it('a target-side shorthand alone (no source class) is applied', () => {
    const g = parseMermaid(`stateDiagram-v2
  A --> B:::foo`)
    expect(g.classAssignments.has('A')).toBe(false)
    expect(g.classAssignments.get('B')).toBe('foo')
  })
})
