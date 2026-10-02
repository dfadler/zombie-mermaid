import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutClassDiagramSync } from '../class/layout.ts'
import { renderMermaidSVG } from '../index.ts'

const SRC = `classDiagram
namespace Core {
  class A
  class B
}
namespace Extras {
  class C
}
class D
A --> C
A --> B
D --> B`

const layout = (src: string) =>
  layoutClassDiagramSync(parseClassDiagram(splitStatements(src)))

describe('class diagram namespaces (#1196)', () => {
  const p = layout(SRC)
  const cls = (id: string) => p.classes.find((c) => c.id === id)!
  const ns = (name: string) => p.namespaces.find((n) => n.name === name)!

  it('lays out one frame per namespace', () => {
    expect(p.namespaces.map((n) => n.name)).toEqual(['Core', 'Extras'])
  })

  it('encloses each member class and no outsider', () => {
    const inside = (n: string, id: string) => {
      const f = ns(n)
      const c = cls(id)
      return (
        c.x >= f.x &&
        c.y >= f.y &&
        c.x + c.width <= f.x + f.width &&
        c.y + c.height <= f.y + f.height
      )
    }
    expect(inside('Core', 'A')).toBe(true)
    expect(inside('Core', 'B')).toBe(true)
    expect(inside('Extras', 'C')).toBe(true)
    expect(inside('Core', 'C')).toBe(false)
    expect(inside('Core', 'D')).toBe(false)
    expect(inside('Extras', 'D')).toBe(false)
  })

  it('keeps frames inside the canvas and apart from each other', () => {
    for (const f of p.namespaces) {
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.y).toBeGreaterThanOrEqual(0)
      expect(f.x + f.width).toBeLessThanOrEqual(p.width)
      expect(f.y + f.height).toBeLessThanOrEqual(p.height)
    }
    const a = ns('Core')
    const b = ns('Extras')
    const disjoint =
      a.x + a.width <= b.x ||
      b.x + b.width <= a.x ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y
    expect(disjoint).toBe(true)
  })

  it('leaves room for the title above the classes', () => {
    expect(cls('A').y - ns('Core').y).toBeGreaterThanOrEqual(28)
  })

  it('routes edges to the class boxes, including edges inside a namespace', () => {
    const touches = (pt: { x: number; y: number }, id: string) => {
      const c = cls(id)
      const tol = 1.5
      return (
        pt.x >= c.x - tol &&
        pt.x <= c.x + c.width + tol &&
        pt.y >= c.y - tol &&
        pt.y <= c.y + c.height + tol
      )
    }
    for (const rel of p.relationships) {
      const first = rel.points[0]!
      const last = rel.points[rel.points.length - 1]!
      expect(touches(first, rel.from)).toBe(true)
      expect(touches(last, rel.to)).toBe(true)
    }
  })

  it('draws the namespace names and frames in SVG', () => {
    const svg = renderMermaidSVG(SRC)
    expect(svg).toContain('>Core</text>')
    expect(svg).toContain('>Extras</text>')
    expect(svg.match(/class="class-namespace"/g)).toHaveLength(2)
    // Frames sit behind the class boxes.
    expect(svg.indexOf('class-namespace')).toBeLessThan(
      svg.indexOf('class-node'),
    )
  })

  it('escapes the namespace name', () => {
    const svg = renderMermaidSVG(`classDiagram
namespace a&b {
  class A
}`)
    expect(svg).toContain('>a&amp;b</text>')
  })

  it('ignores a namespace with no classes and a class claimed twice', () => {
    const q = layout(`classDiagram
namespace Empty {
}
namespace One {
  class A
}
namespace Two {
  class A
  class B
}`)
    expect(q.namespaces.map((n) => [n.name, n.classIds])).toEqual([
      ['One', ['A']],
      ['Two', ['B']],
    ])
  })

  it('leaves diagrams without namespaces unframed', () => {
    expect(layout('classDiagram\nA --> B').namespaces).toEqual([])
  })

  it('returns no frames for an empty diagram', () => {
    expect(layout('classDiagram').namespaces).toEqual([])
  })

  it('keeps a note link attached to a class inside a namespace', () => {
    const q = layout(`classDiagram
namespace Core {
  class A
  class B
}
A --> B
note for A "hello"`)
    const a = q.classes.find((c) => c.id === 'A')!
    const note = q.notes[0]!
    expect(note.linkPoints).toBeDefined()
    const pts = note.linkPoints!
    const end = pts[pts.length - 1]!
    const tol = 1.5
    const touchesA =
      end.x >= a.x - tol &&
      end.x <= a.x + a.width + tol &&
      end.y >= a.y - tol &&
      end.y <= a.y + a.height + tol
    expect(touchesA).toBe(true)
  })

  it('lays out a note that has no link', () => {
    const q = layout(`classDiagram
namespace Core {
  class A
}
note "free floating"`)
    expect(q.notes[0]!.linkPoints).toBeUndefined()
  })
})
