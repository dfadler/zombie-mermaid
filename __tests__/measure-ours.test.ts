import { describe, it, expect } from 'vitest'
import { measureOurs } from '../scripts/lib/measure-ours.ts'

describe('measureOurs (layout-oracle, browser-free)', () => {
  it('keys flowchart nodes by id and subgraphs as groups', () => {
    const m = measureOurs(
      'graph TD\n  subgraph S\n    A --> B\n  end',
      'flowchart',
    )
    expect(Object.keys(m.nodes).sort()).toEqual(['A', 'B'])
    expect(Object.keys(m.groups)).toEqual(['S'])
    expect(m.nodes.A!.w).toBeGreaterThan(0)
  })

  it('keys state nodes by id', () => {
    const m = measureOurs(
      'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Done',
      'state',
    )
    expect(Object.keys(m.nodes)).toEqual(
      expect.arrayContaining(['Idle', 'Done']),
    )
  })

  it('keys class nodes by class id and namespaces by name', () => {
    const m = measureOurs(
      'classDiagram\n  namespace Zoo {\n    class Animal\n  }\n  Animal <|-- Dog',
      'class',
    )
    expect(Object.keys(m.nodes).sort()).toEqual(['Animal', 'Dog'])
    expect(Object.keys(m.groups)).toEqual(['Zoo'])
  })

  it('keys ER nodes by entity name', () => {
    const m = measureOurs('erDiagram\n  CUSTOMER ||--o{ ORDER : places', 'er')
    expect(Object.keys(m.nodes).sort()).toEqual(['CUSTOMER', 'ORDER'])
    expect(m.groups).toEqual({})
  })
})
