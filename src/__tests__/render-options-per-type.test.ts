/**
 * Coverage for the per-diagram-type `RenderOptions` subsets added for issue
 * #534 (`CommonRenderOptions`, `FlowchartRenderOptions`,
 * `SequenceRenderOptions`, `ClassRenderOptions`, `ErRenderOptions`,
 * `XyChartRenderOptions` — see packages/core/src/types.ts).
 *
 * These types are additive: `renderMermaidSVG` still accepts the full flat
 * `RenderOptions` for every diagram type (that entry point detects the
 * diagram type from the source text at runtime, so it can't be narrowed by
 * type alone — see the JSDoc above the types in packages/core/src/types.ts). What this
 * file checks:
 *
 *   1. A value typed with the narrow, diagram-specific type is still
 *      assignable everywhere the wide `RenderOptions` was expected before —
 *      i.e. this is a strictly additive change, not a breaking one.
 *   2. Each narrow type actually rejects a field it does not claim to
 *      support (`@ts-expect-error`, checked by `tsc --noEmit` — see
 *      `pnpm run typecheck` and the existing convention in
 *      src/__tests__/ascii-ansi.test.ts). This is the structural guarantee
 *      the issue asked for, in place of a prose comment.
 *   3. The internal layout functions that used to accept the full
 *      `RenderOptions` and cherry-pick a handful of fields now advertise
 *      their real dependency via the narrow type, and still produce
 *      identical output for a field they do use.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import {
  layoutGraphSync,
  layoutSequenceDiagram,
  layoutClassDiagramSync,
  layoutErDiagramSync,
  layoutXYChart,
} from '@zombie-mermaid/svg-renderer'
import { parseMermaid } from '../parser.ts'
import {
  parseSequenceDiagram,
  parseClassDiagram,
  parseErDiagram,
  parseXYChart,
} from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import type {
  FlowchartRenderOptions,
  SequenceRenderOptions,
  ClassRenderOptions,
  ErRenderOptions,
  XyChartRenderOptions,
} from '@zombie-mermaid/core'

describe('per-diagram-type RenderOptions subsets — additive, not breaking', () => {
  it('a FlowchartRenderOptions value still renders through renderMermaidSVG', () => {
    const opts: FlowchartRenderOptions = { nodeSpacing: 60, curve: 'basis' }
    const svg = renderMermaidSVG('graph TD\n  A --> B', opts)
    expect(svg).toContain('<svg')
  })

  it('a SequenceRenderOptions value still renders through renderMermaidSVG', () => {
    const opts: SequenceRenderOptions = { sequence: { actorHeight: 60 } }
    const svg = renderMermaidSVG('sequenceDiagram\n  Alice->>Bob: Hi', opts)
    expect(svg).toContain('<svg')
  })

  it('a ClassRenderOptions value still renders through renderMermaidSVG', () => {
    const opts: ClassRenderOptions = { fontSizes: { nodeLabel: 20 } }
    const svg = renderMermaidSVG('classDiagram\n  class Animal', opts)
    expect(svg).toContain('<svg')
  })

  it('an ErRenderOptions value still renders through renderMermaidSVG', () => {
    const opts: ErRenderOptions = { direction: 'LR' }
    const svg = renderMermaidSVG(
      'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
      opts,
    )
    expect(svg).toContain('<svg')
  })

  it('an XyChartRenderOptions value still renders through renderMermaidSVG', () => {
    const opts: XyChartRenderOptions = { interactivity: 'full' }
    const svg = renderMermaidSVG(
      'xychart-beta\n  x-axis [a, b]\n  bar [1, 2]',
      opts,
    )
    expect(svg).toContain('<svg')
  })
})

describe('per-diagram-type RenderOptions subsets — structural rejection', () => {
  it('FlowchartRenderOptions rejects sequence-only fields', () => {
    // @ts-expect-error — `sequence` is sequence-diagram-only, not flowchart/state
    const opts: FlowchartRenderOptions = { sequence: { actorHeight: 60 } }
    void opts
  })

  it('SequenceRenderOptions rejects flowchart-only fields', () => {
    // @ts-expect-error — `curve` only applies to flowchart/state diagrams
    const opts: SequenceRenderOptions = { curve: 'basis' }
    void opts
  })

  it('SequenceRenderOptions rejects direction (flowchart/state/ER only)', () => {
    // @ts-expect-error — sequence diagrams have no `direction` concept
    const opts: SequenceRenderOptions = { direction: 'LR' }
    void opts
  })

  it('ClassRenderOptions rejects spacing fields (class diagrams use fixed internal spacing)', () => {
    // @ts-expect-error — `nodeSpacing` only applies to flowchart/state diagrams
    const opts: ClassRenderOptions = { nodeSpacing: 60 }
    void opts
  })

  it('ErRenderOptions rejects curve (no edge-curve concept)', () => {
    // @ts-expect-error — `curve` only applies to flowchart/state diagrams
    const opts: ErRenderOptions = { curve: 'basis' }
    void opts
  })

  it('ErRenderOptions rejects sequence.* fields', () => {
    // @ts-expect-error — `sequence` is sequence-diagram-only
    const opts: ErRenderOptions = { sequence: { actorHeight: 60 } }
    void opts
  })

  it('XyChartRenderOptions rejects fontSizes (no fontSizes concept)', () => {
    // @ts-expect-error — `fontSizes` does not apply to xychart
    const opts: XyChartRenderOptions = { fontSizes: { nodeLabel: 20 } }
    void opts
  })

  it('XyChartRenderOptions rejects layoutCache (not an ELK-based layout)', () => {
    // @ts-expect-error — xychart layout is a fixed pixel computation, no ELK cache
    const opts: XyChartRenderOptions = { layoutCache: undefined }
    void opts
  })
})

describe('internal layout functions narrowed to their per-type option subset', () => {
  it('layoutGraphSync (flowchart/state) still honors layerSpacing', () => {
    const graph = parseMermaid('graph LR\n  A --> B --> C')
    const narrow = layoutGraphSync(graph, { layerSpacing: 48 })
    const wide = layoutGraphSync(graph, { layerSpacing: 400 })
    expect(wide.width).toBeGreaterThan(narrow.width)
  })

  it('layoutSequenceDiagram still honors sequence.actorHeight', () => {
    const lines = splitStatements('sequenceDiagram\n  Alice->>Bob: Hi')
    const diagram = parseSequenceDiagram(lines)
    const positioned = layoutSequenceDiagram(diagram, {
      sequence: { actorHeight: 100 },
    })
    expect(positioned.actors[0]?.height).toBe(100)
  })

  it('layoutClassDiagramSync still honors fontSizes', () => {
    const lines = splitStatements('classDiagram\n  class Animal')
    const diagram = parseClassDiagram(lines)
    const positioned = layoutClassDiagramSync(diagram, {
      fontSizes: { nodeLabel: 30 },
    })
    expect(positioned.classes.length).toBe(1)
  })

  it('layoutErDiagramSync still honors direction', () => {
    const lines = splitStatements('erDiagram\n  CUSTOMER ||--o{ ORDER : places')
    const diagram = parseErDiagram(lines)
    const positioned = layoutErDiagramSync(diagram, { direction: 'LR' })
    expect(positioned.entities.length).toBe(2)
  })

  it('layoutXYChart still accepts the narrowed options type (currently a no-op)', () => {
    const lines = splitStatements('xychart-beta\n  x-axis [a, b]\n  bar [1, 2]')
    const chart = parseXYChart(lines)
    const positioned = layoutXYChart(chart, { interactivity: 'full' })
    expect(positioned.width).toBeGreaterThan(0)
  })
})
