/**
 * Edge cases of #1713/#1714/#1715 not covered by the per-issue test files:
 * ASCII-only glyph sets, nested regions, labeled fork/join bars, and pseudo-state
 * or note targets that are already declared or are composites.
 */
import { describe, it, expect } from 'vitest'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import { parseMermaid, renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const edges = (src: string) =>
  parseMermaid(src).edges.map((e) => `${e.source}>${e.target}`)

describe('state concurrency regions: edge cases', () => {
  const SRC = `stateDiagram-v2
    state Work {
        [*] --> A1
        --
        [*] --> B1
    }`

  it('ASCII-only mode draws regions with . and : borders', () => {
    const out = renderMermaidASCII(SRC, { useAscii: true })
    expect(out).toContain('.')
    expect(out).toContain(':')
    expect(out).not.toContain('┆')
    expect(out).toContain('A1')
    expect(out).toContain('B1')
  })

  it('a composite nested in a region closes back into that region', () => {
    const [work] = parseMermaid(`stateDiagram-v2
  state Work {
    a --> b
    --
    state Inner {
      x --> y
    }
    c --> d
  }
  Work --> after`).subgraphs
    const [r1, r2] = work!.children
    expect(r1!.nodeIds).toEqual(['a', 'b'])
    expect(r2!.nodeIds).toEqual(expect.arrayContaining(['c', 'd']))
    expect(r2!.children.map((c) => c.id)).toEqual(['Inner'])
    expect(r2!.children[0]!.nodeIds).toEqual(['x', 'y'])
  })

  it('a region inside a nested composite closes only its own composite', () => {
    const subs = parseMermaid(`stateDiagram-v2
  state Outer {
    state Inner {
      a --> b
      --
      c --> d
    }
    e --> f
  }`).subgraphs
    const outer = subs[0]!
    expect(outer.nodeIds).toEqual(expect.arrayContaining(['e', 'f']))
    expect(outer.children[0]!.id).toBe('Inner')
    expect(outer.children[0]!.children.map((r) => r.nodeIds)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const svg = renderMermaidSVG(
      'stateDiagram-v2\n state O {\n state I {\n a --> b\n --\n c --> d\n }\n }',
    )
    expect(svg.match(/class="subgraph subgraph-region"/g)).toHaveLength(2)
    // The nested layout path keeps regions untitled and in written order.
    const g = layoutGraphSync(
      parseMermaid(
        'stateDiagram-v2\n state O {\n state I {\n a --> b\n --\n c --> d\n }\n }',
      ),
    )
    const [inner] = g.groups[0]!.children
    const [r1, r2] = inner!.children
    // A composite nested inside a region is drawn inside it.
    const nested = renderMermaidSVG(
      'stateDiagram-v2\n state W {\n a --> b\n --\n state In {\n x --> y\n }\n }',
    )
    expect(nested).toContain('data-id="In"')
    expect(nested.match(/subgraph-region/g)).toHaveLength(2)
    expect(r1!.region && r2!.region).toBe(true)
    expect(r1!.x).toBeLessThan(r2!.x)
  })

  it('a long dash run is still a separator, and a transition with a dashed label is not', () => {
    const src = `stateDiagram-v2
  state W {
    a --> b : go
    -----
    c --> d
  }`
    expect(edges(src)).toEqual(['a>b', 'c>d'])
  })
})

describe('state pseudo-states: edge cases', () => {
  it('turns an already-mentioned state into a pseudo-state and clears its label', () => {
    const g = parseMermaid(
      'stateDiagram-v2\n  [*] --> c\n  c --> A\n  state c <<choice>>',
    )
    expect(g.nodes.get('c')).toMatchObject({ shape: 'diamond', label: '' })
  })

  it('does not create a node for a pseudo-state named like a composite', () => {
    const g = parseMermaid(
      'stateDiagram-v2\n  state Box {\n    a --> b\n  }\n  state Box <<fork>>',
    )
    expect(g.nodes.has('Box')).toBe(false)
  })

  it('draws a labeled flowchart fork bar as a box in both glyph sets', () => {
    const src =
      'flowchart TD\n  A --> F@{ shape: fork, label: "split" }\n  F --> B'
    const uni = renderMermaidASCII(src)
    const asc = renderMermaidASCII(src, { useAscii: true })
    expect(uni).toContain('split')
    expect(asc).toContain('split')
    expect(uni).not.toContain('█')
    expect(asc).not.toContain('#########')
  })
})

describe('state notes: edge cases', () => {
  it('attaches a note to a composite state without creating a plain node', () => {
    const g = parseMermaid(
      'stateDiagram-v2\n  state Box {\n    a --> b\n  }\n  note right of Box : about box',
    )
    expect(g.nodes.has('Box')).toBe(false)
    expect(g.nodes.get('Box----note-1')).toMatchObject({
      shape: 'note',
      label: 'about box',
    })
    expect(g.edges.at(-1)).toMatchObject({
      source: 'Box',
      target: 'Box----note-1',
    })
  })

  it('treats `end note` case-insensitively and ignores text-like lines inside a block', () => {
    const g = parseMermaid(
      'stateDiagram-v2\n  note left of A\n    x --> y\n    state z <<fork>>\n  END NOTE\n  A --> B',
    )
    expect(g.nodes.get('A----note-1')!.label).toBe('x --> y\nstate z <<fork>>')
    expect(g.nodes.has('x')).toBe(false)
    expect(
      edges(
        'stateDiagram-v2\n  note left of A\n    x --> y\n  end note\n  A --> B',
      ),
    ).toEqual(['A>A----note-1', 'A>B'])
  })

  it('renders a note in ASCII-only mode', () => {
    const out = renderMermaidASCII(
      'stateDiagram-v2\n  A --> B\n  note right of A : hello note',
      { useAscii: true },
    )
    expect(out).toContain('hello note')
  })

  it('a multi-line note with <br/> keeps its line break in the SVG', () => {
    const svg = renderMermaidSVG(
      'stateDiagram-v2\n  A --> B\n  note right of A : one<br/>two',
    )
    expect(svg).toContain('one')
    expect(svg).toContain('two')
  })
})
