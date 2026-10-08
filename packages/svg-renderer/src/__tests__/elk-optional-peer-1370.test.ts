/**
 * `elkjs` is an optional peer dependency (#1370). These tests pin the
 * contract: graph diagrams (flowchart, state, class, ER, architecture) need a
 * registered or auto-loadable ELK; sequence, pie, xychart, C4 and ASCII do
 * not. Each test imports a FRESH copy of the module graph so state from other
 * tests (or the Node auto-load) does not leak in. The rest of the suite
 * renders graph diagrams through the Node auto-load; config/vitest.setup.ts
 * deliberately imports no renderer (it would defeat per-file `vi.mock`s).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import ELK from 'elkjs/lib/elk.bundled.js'

type Api = typeof import('../index.ts')

const GRAPH_DIAGRAMS: [string, string][] = [
  ['flowchart', 'graph TD\n  A --> B'],
  ['state', 'stateDiagram-v2\n  [*] --> A'],
  ['class', 'classDiagram\n  Animal <|-- Dog'],
  ['er', 'erDiagram\n  A ||--o{ B : has'],
  [
    'architecture',
    'architecture-beta\n  service a(server)[A]\n  service b(server)[B]\n  a:R -- L:b',
  ],
]

const ELK_FREE_DIAGRAMS: [string, string][] = [
  ['sequence', 'sequenceDiagram\n  A->>B: hi'],
  ['pie', 'pie\n  "A" : 1\n  "B" : 2'],
  ['xychart', 'xychart-beta\n  line [1, 2, 3]'],
  [
    'c4',
    'C4Context\n  Person(u, "User")\n  System(s, "System")\n  Rel(u, s, "uses")',
  ],
]

/** A fresh module graph with Node auto-load disabled, i.e. "elkjs not installed". */
async function freshWithoutElk(): Promise<Api> {
  vi.resetModules()
  vi.spyOn(process, 'getBuiltinModule').mockImplementation(() => undefined)
  return import('../index.ts')
}

describe('elkjs optional peer (#1370)', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('elk unavailable', () => {
    it.each(GRAPH_DIAGRAMS)(
      'throws a clear ElkNotRegisteredError for a %s diagram',
      async (_label, source) => {
        const api = await freshWithoutElk()
        expect(() => api.renderMermaidSVG(source)).toThrow(
          api.ElkNotRegisteredError,
        )
        expect(() => api.renderMermaidSVG(source)).toThrow(
          /optional peer dependency "elkjs".*registerElk\(ELK\)/s,
        )
      },
    )

    it.each(ELK_FREE_DIAGRAMS)(
      'still renders a %s diagram',
      async (_label, source) => {
        const api = await freshWithoutElk()
        const svg = api.renderMermaidSVG(source)
        expect(svg).toContain('<svg')
        expect(svg).toContain('</svg>')
      },
    )

    it('still renders ASCII for graph diagrams', async () => {
      await freshWithoutElk()
      const { renderMermaidASCII } =
        await import('@zombie-mermaid/ascii-renderer')
      expect(renderMermaidASCII('graph TD\n  A --> B')).toContain('A')
    })
  })

  describe('registerElk', () => {
    it.each(GRAPH_DIAGRAMS)(
      'makes a %s diagram render',
      async (_label, source) => {
        const api = await freshWithoutElk()
        api.registerElk(ELK)
        expect(api.renderMermaidSVG(source)).toContain('<svg')
      },
    )

    it('rejects a constructor without the synchronous worker and restores globals', async () => {
      const api = await freshWithoutElk()
      const setTimeoutBefore = globalThis.setTimeout
      api.registerElk(class NotElk {} as never)
      expect(() => api.renderMermaidSVG('graph TD\n  A --> B')).toThrow(
        /registerElk\(\) needs the ELK class/,
      )
      expect(globalThis.setTimeout).toBe(setTimeoutBefore)
    })
  })

  describe('Node auto-load', () => {
    it('renders a flowchart with no registration when elkjs is installed', async () => {
      const api = await import('../index.ts')
      expect(api.renderMermaidSVG('graph TD\n  A --> B')).toContain('<svg')
    })
  })

  describe('Node auto-load edge cases', () => {
    const src = 'graph TD\n  A --> B'
    /** Fresh module graph whose `node:module` builtin is `createRequire`-stubbed. */
    async function withCreateRequire(load: () => unknown): Promise<Api> {
      vi.resetModules()
      vi.spyOn(process, 'getBuiltinModule').mockImplementation(
        () => ({ createRequire: () => load }) as never,
      )
      return import('../index.ts')
    }

    it('unwraps a { default } module export', async () => {
      const api = await withCreateRequire(() => ({ default: ELK }))
      expect(api.renderMermaidSVG(src)).toContain('<svg')
    })

    it.each([
      [
        'resolution throws',
        () => {
          throw new Error('nope')
        },
      ],
      ['export has no constructor', () => ({})],
    ])('reports ElkNotRegisteredError when %s', async (_l, load) => {
      const api = await withCreateRequire(load)
      expect(() => api.renderMermaidSVG(src)).toThrow(api.ElkNotRegisteredError)
    })

    it('skips auto-load when getBuiltinModule is unavailable', async () => {
      vi.resetModules()
      vi.spyOn(process, 'getBuiltinModule', 'get' as never).mockReturnValue(
        undefined as never,
      )
      const api = await import('../index.ts')
      expect(() => api.renderMermaidSVG(src)).toThrow(api.ElkNotRegisteredError)
    })

    it('falls back to "/" when process.cwd is missing', async () => {
      const seen: string[] = []
      vi.resetModules()
      vi.spyOn(process, 'getBuiltinModule').mockImplementation(
        () =>
          ({
            createRequire: (from: string) => {
              seen.push(from)
              return () => {
                throw new Error('nope')
              }
            },
          }) as never,
      )
      vi.spyOn(process, 'cwd', 'get' as never).mockReturnValue(
        undefined as never,
      )
      const api = await import('../index.ts')
      expect(() => api.renderMermaidSVG(src)).toThrow(api.ElkNotRegisteredError)
      expect(seen[1]).toMatch(/^file:\/\/\/+$/)
    })

    it('hides a worker-style `self` during construction and restores it', async () => {
      const g = globalThis as { self?: unknown; document?: unknown }
      const hadSelf = 'self' in g
      const before = g.self
      g.self = globalThis
      try {
        const api = await freshWithoutElk()
        api.registerElk(ELK)
        expect(api.renderMermaidSVG(src)).toContain('<svg')
        expect(g.self).toBe(globalThis)
      } finally {
        if (hadSelf) g.self = before
        else delete g.self
      }
    })
  })
})
