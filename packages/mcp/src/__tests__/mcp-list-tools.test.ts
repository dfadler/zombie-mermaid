// ============================================================================
// Coverage for the list_themes and list_diagram_types tools. The expected
// values are derived from the library's own registries (THEMES,
// DIAGRAM_TYPES), and each diagram type is round-tripped through
// detectDiagramType so the list can't advertise a type the detector never
// returns.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { THEMES, DIAGRAM_TYPES, detectDiagramType } from '@zombie-mermaid/core'
import { listThemesHandler } from '../tools/list-themes.ts'
import { listDiagramTypesHandler } from '../tools/list-diagram-types.ts'

function json(result: ReturnType<typeof listThemesHandler>): unknown {
  const first = result.content[0]
  if (first?.type !== 'text') throw new Error('Expected text content')
  return JSON.parse(first.text)
}

describe('list_themes', () => {
  it('returns exactly the built-in theme names', () => {
    const value = json(listThemesHandler())
    expect(value).toEqual({ themes: Object.keys(THEMES) })
    expect(Object.keys(THEMES)).toContain('tokyo-night')
  })
})

describe('list_diagram_types', () => {
  it('returns exactly the detectable diagram types', () => {
    const value = json(listDiagramTypesHandler())
    expect(value).toEqual({ diagramTypes: [...DIAGRAM_TYPES] })
  })

  it('advertises only types detectDiagramType can produce', () => {
    const headers: Record<string, string> = {
      flowchart: 'flowchart TD\nA-->B',
      sequence: 'sequenceDiagram\nA->>B: Hi',
      class: 'classDiagram\nclass Foo',
      er: 'erDiagram\nFOO ||--o{ BAR : has',
      xychart: 'xychart-beta\nx-axis [a, b]',
      architecture: 'architecture-beta\nservice a[A]',

      c4: 'C4Context\nPerson(a, "A")',
      pie: 'pie\n"A" : 1',
      quadrant: 'quadrantChart\nA: [0.5, 0.5]',
      mindmap: 'mindmap\n  root',
      gantt: 'gantt\nA :a, 2024-01-01, 1d',
      timeline: 'timeline\n2002 : LinkedIn',
      gitgraph: 'gitGraph\ncommit',
      packet: 'packet\n0-7: "a"',
      radar: 'radar-beta\naxis a, b\ncurve c{1, 2}',
      journey: 'journey\nA: 3: Me',
      kanban: 'kanban\n  A\n    b',
      sankey: 'sankey-beta\nA,B,1',
      requirement: 'requirementDiagram\nrequirement r {\n}',
      eventmodeling: 'eventmodeling\ntf 01 ui A',
      usecase: 'usecase-beta\nactor A\nA --> B',
    }
    expect(Object.keys(headers).sort()).toEqual([...DIAGRAM_TYPES].sort())
    for (const type of DIAGRAM_TYPES) {
      expect(detectDiagramType(headers[type] ?? '')).toBe(type)
    }
  })
})
