/**
 * #1794: a class-diagram cycle is broken the way mermaid.js (dagre) breaks it,
 * by a depth-first walk in declaration order, so the first-declared class of a
 * 2-cycle ends up above the other. ELK's own choice was the mirror image in
 * both declaration orders (the MVC sample drew Model and View swapped).
 */
import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutClassDiagramSync } from '@zombie-mermaid/svg-renderer'
import { splitStatements } from '@zombie-mermaid/core'
import { classBackEdges } from '../../packages/svg-renderer/src/class/layout.ts'

const parse = (text: string) => parseClassDiagram(splitStatements(text))

const yOf = (text: string, id: string): number =>
  layoutClassDiagramSync(parse(text)).classes.find((c) => c.id === id)!.y

describe('class cycle breaking follows declaration order', () => {
  it('reverses the edge that closes the cycle on the walk', () => {
    const d = parse('classDiagram\n  class A\n  class B\n  A --> B\n  B --> A')
    expect([...classBackEdges(d)]).toEqual([1])
    const swapped = parse(
      'classDiagram\n  class B\n  class A\n  A --> B\n  B --> A',
    )
    // Walk starts at B: B -> A is followed first, so A -> B is the back edge.
    expect([...classBackEdges(swapped)]).toEqual([0])
  })

  it('puts the first-declared class of a 2-cycle on top, either order', () => {
    const ab = 'classDiagram\n  class A\n  class B\n  A --> B\n  B --> A'
    expect(yOf(ab, 'A')).toBeLessThan(yOf(ab, 'B'))
    const ba = 'classDiagram\n  class B\n  class A\n  A --> B\n  B --> A'
    expect(yOf(ba, 'B')).toBeLessThan(yOf(ba, 'A'))
  })

  it('keeps edge points running from -> to when the edge was reversed', () => {
    const p = layoutClassDiagramSync(
      parse('classDiagram\n  class A\n  class B\n  A --> B\n  B --> A'),
    )
    const [ab, ba] = p.relationships
    expect(ab!.points[0]!.y).toBeLessThan(ab!.points.at(-1)!.y)
    expect(ba!.points[0]!.y).toBeGreaterThan(ba!.points.at(-1)!.y)
  })
})
