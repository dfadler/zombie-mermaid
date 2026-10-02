import { describe, it, expect, vi } from 'vitest'
import type { ElkNode } from 'elkjs/lib/elk-api'
import { splitStatements } from '@zombie-mermaid/core'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'

// ELK's result type marks every coordinate optional. Strip them (and
// optionally drop a node) so the layout extractor's fallbacks run.
const mode = vi.hoisted(() => ({
  strip: false,
  dropNamespaces: false,
  emptyNamespaces: false,
  noChildren: false,
}))

vi.mock('../elk-instance.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../elk-instance.ts')>()
  const bare = (n: ElkNode): ElkNode => {
    return { id: n.id, edges: n.edges, children: n.children?.map(bare) }
  }
  return {
    ...real,
    elkLayoutSync: (...args: Parameters<typeof real.elkLayoutSync>) => {
      const result = real.elkLayoutSync(...args)
      if (mode.noChildren) return { ...result, children: undefined }
      if (mode.emptyNamespaces) {
        return {
          ...result,
          children: result.children?.map((c) =>
            c.id.startsWith('namespace') ? { ...c, children: undefined } : c,
          ),
        }
      }
      if (mode.dropNamespaces) {
        return {
          ...result,
          children: result.children?.filter(
            (c) => !c.id.startsWith('namespace'),
          ),
        }
      }
      return mode.strip ? bare(result) : result
    },
  }
})

const { layoutClassDiagramSync } = await import('../class/layout.ts')

const SRC = `classDiagram
namespace Core {
  class A
  class B
}
A --> B`

const layout = () =>
  layoutClassDiagramSync(parseClassDiagram(splitStatements(SRC)))

describe('class namespace layout against sparse ELK output (#1196)', () => {
  it('falls back to the origin and measured sizes when ELK omits geometry', () => {
    mode.strip = true
    mode.dropNamespaces = false
    const p = layout()
    expect(p.namespaces).toEqual([
      { name: 'Core', classIds: ['A', 'B'], x: 0, y: 0, width: 0, height: 0 },
    ])
    for (const c of p.classes) {
      expect(c.x).toBe(0)
      expect(c.width).toBeGreaterThan(0)
    }
  })

  it('tolerates a namespace node without children', () => {
    mode.strip = false
    mode.dropNamespaces = false
    mode.emptyNamespaces = true
    expect(layout().namespaces).toHaveLength(1)
  })

  it('tolerates a result without any children', () => {
    mode.strip = false
    mode.dropNamespaces = false
    mode.emptyNamespaces = false
    mode.noChildren = true
    const p = layout()
    expect(p.namespaces).toEqual([])
    expect(p.classes).toEqual([])
  })

  it('skips a namespace ELK did not return', () => {
    mode.strip = false
    mode.noChildren = false
    mode.emptyNamespaces = false
    mode.dropNamespaces = true
    expect(layout().namespaces).toEqual([])
  })
})
