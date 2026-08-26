/**
 * Regression tests for RenderOptions.fontSizes and RenderOptions.sequence
 * (issue #63) — overridable font-size and sequence-diagram layout constants.
 *
 * Covers:
 *   - fontSizes.nodeLabel/edgeLabel/groupHeader override emitted SVG attrs
 *     for flowchart, class, ER, and sequence diagrams
 *   - Unspecified fontSizes fields fall back to defaults
 *   - sequence.actorHeight/headerGap/messageRowHeight/noteOffsetAfterMessage/
 *     noteStackGap change sequence-diagram layout geometry
 *   - No options specified produces byte-identical output to before this
 *     change (critical non-regression check)
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import { layoutSequenceDiagram } from '../sequence/layout.ts'
import { parseSequenceDiagram } from '../sequence/parser.ts'

describe('RenderOptions.fontSizes – flowchart', () => {
  it('overriding nodeLabel changes the emitted node font-size', () => {
    const svg = renderMermaidSVG('graph TD\n  A[Hello] --> B[World]', {
      fontSizes: { nodeLabel: 24 },
    })
    expect(svg).toContain('font-size="24"')
    expect(svg).not.toContain('font-size="13"')
  })

  it('default render uses font-size 13 for node labels', () => {
    const svg = renderMermaidSVG('graph TD\n  A[Hello] --> B[World]')
    expect(svg).toContain('font-size="13"')
  })

  it('overriding only nodeLabel leaves edgeLabel/groupHeader at their defaults', () => {
    const svg = renderMermaidSVG(
      'graph TD\n  subgraph S\n  A[Hi] -->|label| B[Bye]\n  end',
      { fontSizes: { nodeLabel: 24 } },
    )
    expect(svg).toContain('font-size="24"') // nodeLabel override
    expect(svg).toContain('font-size="11"') // edgeLabel default
    expect(svg).toContain('font-size="12"') // groupHeader default
  })

  it('overriding groupHeader changes the subgraph header font-size', () => {
    const svg = renderMermaidSVG('graph TD\n  subgraph S\n  A --> B\n  end', {
      fontSizes: { groupHeader: 20 },
    })
    expect(svg).toContain('font-size="20"')
  })

  it('overriding edgeLabel changes the edge label font-size', () => {
    const svg = renderMermaidSVG('graph TD\n  A -->|Yes| B', {
      fontSizes: { edgeLabel: 18 },
    })
    expect(svg).toContain('font-size="18"')
  })
})

describe('RenderOptions.fontSizes – class diagram', () => {
  it('overriding nodeLabel changes the class-name font-size', () => {
    const svg = renderMermaidSVG(
      'classDiagram\n  class Animal {\n    +String name\n  }',
      { fontSizes: { nodeLabel: 22 } },
    )
    expect(svg).toContain('font-size="22"')
  })
})

describe('RenderOptions.fontSizes – ER diagram', () => {
  it('overriding nodeLabel changes the entity-name font-size', () => {
    const svg = renderMermaidSVG(
      'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
      { fontSizes: { nodeLabel: 21 } },
    )
    expect(svg).toContain('font-size="21"')
  })
})

describe('RenderOptions.fontSizes – sequence diagram', () => {
  it('overriding nodeLabel changes the actor-label font-size', () => {
    const svg = renderMermaidSVG('sequenceDiagram\n  Alice->>Bob: Hello', {
      fontSizes: { nodeLabel: 26 },
    })
    expect(svg).toContain('font-size="26"')
    expect(svg).not.toContain('font-size="13"')
  })
})

describe('RenderOptions.sequence – layout overrides', () => {
  it('overriding actorHeight changes actor box height and overall diagram height', () => {
    const lines = ['sequenceDiagram', 'Alice->>Bob: Hi'].map((l) => l.trim())
    const diagram = parseSequenceDiagram(lines)

    const withDefault = layoutSequenceDiagram(diagram)
    const withOverride = layoutSequenceDiagram(diagram, {
      sequence: { actorHeight: 100 },
    })

    expect(withOverride.actors[0]!.height).toBe(100)
    expect(withDefault.actors[0]!.height).toBe(40)
    expect(withOverride.height).toBeGreaterThan(withDefault.height)
  })

  it('overriding actorHeight changes the rendered SVG height', () => {
    const svgDefault = renderMermaidSVG('sequenceDiagram\n  Alice->>Bob: Hi')
    const svgOverride = renderMermaidSVG('sequenceDiagram\n  Alice->>Bob: Hi', {
      sequence: { actorHeight: 120 },
    })

    const heightOf = (svg: string): number => {
      const m = svg.match(/height="(\d+(?:\.\d+)?)"/)
      return m ? Number(m[1]) : 0
    }

    expect(heightOf(svgOverride)).toBeGreaterThan(heightOf(svgDefault))
  })

  it('overriding messageRowHeight increases vertical spacing between messages', () => {
    const lines = [
      'sequenceDiagram',
      'Alice->>Bob: One',
      'Bob->>Alice: Two',
    ].map((l) => l.trim())
    const diagram = parseSequenceDiagram(lines)

    const withDefault = layoutSequenceDiagram(diagram)
    const withOverride = layoutSequenceDiagram(diagram, {
      sequence: { messageRowHeight: 200 },
    })

    const gapDefault = withDefault.messages[1]!.y - withDefault.messages[0]!.y
    const gapOverride =
      withOverride.messages[1]!.y - withOverride.messages[0]!.y

    expect(gapOverride).toBeGreaterThan(gapDefault)
  })

  it('overriding headerGap increases the gap between actors and the first message', () => {
    const lines = ['sequenceDiagram', 'Alice->>Bob: Hi'].map((l) => l.trim())
    const diagram = parseSequenceDiagram(lines)

    const withDefault = layoutSequenceDiagram(diagram)
    const withOverride = layoutSequenceDiagram(diagram, {
      sequence: { headerGap: 100 },
    })

    expect(withOverride.messages[0]!.y).toBeGreaterThan(
      withDefault.messages[0]!.y,
    )
  })

  it('overriding noteStackGap changes spacing between consecutively stacked notes', () => {
    const lines = [
      'sequenceDiagram',
      'Alice->>Bob: Hi',
      'Note right of Bob: First note',
      'Note right of Bob: Second note',
    ].map((l) => l.trim())
    const diagram = parseSequenceDiagram(lines)

    const withDefault = layoutSequenceDiagram(diagram)
    const withOverride = layoutSequenceDiagram(diagram, {
      sequence: { noteStackGap: 50 },
    })

    expect(withDefault.notes.length).toBe(2)
    expect(withOverride.notes.length).toBe(2)

    const gapDefault = withDefault.notes[1]!.y - withDefault.notes[0]!.y
    const gapOverride = withOverride.notes[1]!.y - withOverride.notes[0]!.y

    expect(gapOverride).toBeGreaterThan(gapDefault)
  })

  it('overriding noteOffsetAfterMessage changes the gap between a message and the note after it', () => {
    const lines = [
      'sequenceDiagram',
      'Alice->>Bob: Hi',
      'Note right of Bob: A note',
    ].map((l) => l.trim())
    const diagram = parseSequenceDiagram(lines)

    const withDefault = layoutSequenceDiagram(diagram)
    const withOverride = layoutSequenceDiagram(diagram, {
      sequence: { noteOffsetAfterMessage: 60 },
    })

    const msgY = withDefault.messages[0]!.y
    const offsetDefault = withDefault.notes[0]!.y - msgY
    const offsetOverride = withOverride.notes[0]!.y - msgY

    expect(offsetOverride).toBeGreaterThan(offsetDefault)
  })

  it('partial sequence overrides only change the specified field', () => {
    const lines = ['sequenceDiagram', 'Alice->>Bob: Hi'].map((l) => l.trim())
    const diagram = parseSequenceDiagram(lines)

    const withDefault = layoutSequenceDiagram(diagram)
    const withOverride = layoutSequenceDiagram(diagram, {
      sequence: { actorHeight: 60 },
    })

    // actorHeight changed
    expect(withOverride.actors[0]!.height).toBe(60)
    expect(withDefault.actors[0]!.height).toBe(40)

    // headerGap unaffected — messageY should differ only by the actorHeight delta (20px)
    const deltaY = withOverride.messages[0]!.y - withDefault.messages[0]!.y
    expect(deltaY).toBe(20)
  })
})

describe('RenderOptions – no-options-specified non-regression', () => {
  it('flowchart: identical output before and after this change', () => {
    const text =
      'graph TD\n  subgraph S\n  A[Hello] -->|label| B[World]\n  end\n  B --> C{Decision}'
    const svg1 = renderMermaidSVG(text)
    const svg2 = renderMermaidSVG(text, {})
    expect(svg1).toBe(svg2)
    // Explicit defaults produce byte-identical output to omitting the fields
    const svg3 = renderMermaidSVG(text, {
      fontSizes: {},
    })
    expect(svg1).toBe(svg3)
  })

  it('sequence diagram: identical output before and after this change', () => {
    const text =
      'sequenceDiagram\n  Alice->>Bob: Hi\n  Note right of Bob: A note\n  Bob-->>Alice: Hello back'
    const svg1 = renderMermaidSVG(text)
    const svg2 = renderMermaidSVG(text, {})
    expect(svg1).toBe(svg2)
    const svg3 = renderMermaidSVG(text, { sequence: {}, fontSizes: {} })
    expect(svg1).toBe(svg3)
  })

  it('class diagram: identical output before and after this change', () => {
    const text = 'classDiagram\n  class Animal {\n    +String name\n  }'
    const svg1 = renderMermaidSVG(text)
    const svg2 = renderMermaidSVG(text, {})
    expect(svg1).toBe(svg2)
  })

  it('er diagram: identical output before and after this change', () => {
    const text = 'erDiagram\n  CUSTOMER ||--o{ ORDER : places'
    const svg1 = renderMermaidSVG(text)
    const svg2 = renderMermaidSVG(text, {})
    expect(svg1).toBe(svg2)
  })
})
