import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import {
  archimateToGraph,
  parseArchimate,
  archimateTypeName,
} from '../index.ts'

const parse = (src: string) => parseArchimate(splitStatements(src))
const lower = (src: string, bands?: boolean) =>
  archimateToGraph(parse(src), { bands })

describe('parseArchimate: errors', () => {
  it('rejects a wrong header', () => {
    expect(() => parse('archimate\nbusiness:\n  actor A')).toThrow(
      /expected a header of "archimate-layered"/,
    )
  })

  it('accepts the header case-insensitively', () => {
    expect(parse('ArchiMate-Layered\nbusiness:\n  actor A').elements.size).toBe(
      1,
    )
  })

  it('rejects an unknown layer with its line number', () => {
    expect(() => parse('archimate-layered\nweather:\n  actor A')).toThrow(
      /line 2: unknown layer "weather"/,
    )
  })

  it('rejects an unknown element type', () => {
    expect(() =>
      parse('archimate-layered\nbusiness:\n  wizard Gandalf'),
    ).toThrow(/line 3: unknown element type "wizard"/)
  })

  it('rejects an element declared before any layer block', () => {
    expect(() => parse('archimate-layered\nactor A')).toThrow(
      /line 2: element declared outside a layer block/,
    )
  })

  it('rejects a duplicate element id', () => {
    expect(() =>
      parse('archimate-layered\nbusiness:\n  actor A\n  role A'),
    ).toThrow(/line 4: duplicate element id "A"/)
  })

  it('rejects a relationship to an undeclared element', () => {
    expect(() =>
      parse('archimate-layered\nbusiness:\n  actor A\nA -->|serving| Ghost'),
    ).toThrow(/line 4: relationship refers to undeclared element "Ghost"/)
  })

  it('accepts a relationship declared before its elements', () => {
    const d = parse(
      'archimate-layered\nA --> B\nbusiness:\n  actor A\n  actor B',
    )
    expect(d.relationships).toHaveLength(1)
  })

  it('rejects an unrecognized statement', () => {
    expect(() => parse('archimate-layered\nbusiness:\n  actor')).toThrow(
      /line 3: unrecognized statement/,
    )
  })

  it('names the accepted relationship types in the error', () => {
    expect(() =>
      parse(
        'archimate-layered\nbusiness:\n  actor A\n  actor B\nA -->|serves| B',
      ),
    ).toThrow(/composition, aggregation, assignment/)
  })
})

describe('parseArchimate: syntax', () => {
  it('accepts a known element type under any layer block', () => {
    const d = parse('archimate-layered\ntechnology:\n  service Svc')
    expect(d.elements.get('Svc')?.layer).toBe('technology')
  })

  it('accepts semicolon-separated statements', () => {
    const d = parse('archimate-layered;business:;actor A;actor B;A --> B')
    expect(d.elements.size).toBe(2)
    expect(d.relationships).toHaveLength(1)
  })

  it('accepts compact relationship spacing', () => {
    const d = parse(
      'archimate-layered\nbusiness:\n  actor A\n  actor B\nA-->|flow|B',
    )
    expect(d.relationships[0]).toMatchObject({ type: 'flow' })
  })

  it('normalizes <br> in quoted labels', () => {
    const d = parse(
      'archimate-layered\nbusiness:\n  actor "Two<br/>Lines" as A',
    )
    expect(d.elements.get('A')?.label).toBe('Two\nLines')
  })

  it('keeps layers empty when a block has no elements', () => {
    expect(
      parse('archimate-layered\nbusiness:').layers.get('business'),
    ).toEqual([])
  })
})

describe('archimateToGraph', () => {
  const SRC = `archimate-layered
business:
  service "Banking" as B
application:
  component App
technology:
  node Srv
  service Net
App -->|realization| B
Srv -->|serving| App
B --> App`

  it('creates one subgraph per non-empty layer in canonical order', () => {
    const g = lower(
      'archimate-layered\ntechnology:\n  node T\nbusiness:\n  actor A\nmotivation:\n',
    )
    expect(g.subgraphs.map((s) => s.label)).toEqual(['Business', 'Technology'])
  })

  it('omits subgraphs when bands are off', () => {
    expect(lower(SRC, false).subgraphs).toEqual([])
    expect(lower(SRC).subgraphs).toHaveLength(3)
  })

  it('labels nodes with a stereotype and qualifies ambiguous types', () => {
    const g = lower(SRC)
    expect(g.nodes.get('B')?.label).toBe('Banking\n«Business Service»')
    expect(g.nodes.get('App')?.label).toBe('App\n«Component»')
    expect(g.nodes.get('Net')?.label).toBe('Net\n«Technology Service»')
    expect(archimateTypeName('dataObject')).toBe('Data Object')
    expect(archimateTypeName('service')).toBe('Service')
  })

  it('reverses an upward relationship, putting the arrowhead on the source end', () => {
    const e = lower(SRC).edges.find((x) => x.label === 'realization')!
    // App (application) -> B (business) is upward, so it is reversed.
    expect([e.source, e.target]).toEqual(['B', 'App'])
    expect([e.hasArrowStart, e.hasArrowEnd]).toEqual([true, false])
    expect(e.style).toBe('dotted')
  })

  it('does not reverse downward or same-layer relationships', () => {
    const e = lower(SRC).edges.find((x) => x.source === 'B' && !x.label)!
    expect([e.source, e.target]).toEqual(['B', 'App'])
    expect([e.hasArrowStart, e.hasArrowEnd]).toEqual([false, false])
  })

  it('adds an invisible ordering edge between consecutive layers', () => {
    const inv = lower(SRC).edges.filter((e) => e.style === 'invisible')
    expect(inv.map((e) => [e.source, e.target])).toEqual([
      ['B', 'App'],
      ['App', 'Srv'],
    ])
  })

  it('leaves association unlabeled and names every other type', () => {
    const g = lower(
      'archimate-layered\nbusiness:\n  actor A\n  actor B\nA --> B\nA -->|composition| B',
    )
    const real = g.edges.filter((e) => e.style !== 'invisible')
    expect(real.map((e) => e.label)).toEqual([undefined, 'composition'])
  })

  it('gives each layer a colored class and dark text', () => {
    const g = lower(SRC)
    expect(g.classAssignments.get('B')).toBe('archimate_business')
    expect(g.classDefs.get('archimate_business')).toMatchObject({
      fill: '#ffffb5',
      color: '#1a1a1a',
    })
  })

  it('avoids a layer subgraph id that collides with an element id', () => {
    const g = lower('archimate-layered\nbusiness:\n  actor __layer_business')
    expect(g.subgraphs[0]!.id).not.toBe('__layer_business')
  })
})
