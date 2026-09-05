/**
 * Tests for the opt-in ELK layout cache (issue #291).
 *
 * `elkLayoutSync()` mutates/derives its returned ElkNode from whatever
 * ElkNode object was actually dispatched to ELK, so two calls that hit the
 * *same* cache entry return the identical object reference, while two
 * calls that each ran layout for real return two distinct references (ELK
 * builds/returns a graph tied to its own input object each time). Object
 * identity of the returned ElkNode is therefore a direct, reliable signal
 * for "did this call actually recompute, or did it hit the cache" —
 * stronger than comparing computed values, which could coincidentally
 * match even if recomputed.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { parseClassDiagram } from '../class/parser.ts'
import { parseErDiagram } from '../er/parser.ts'
import { splitStatements } from '../statements.ts'
import { convertToElkFormat, layoutGraphSync } from '../layout-engine.ts'
import { layoutClassDiagramSync } from '../class/layout.ts'
import { layoutErDiagramSync } from '../er/layout.ts'
import { elkLayoutSync, createLayoutCache } from '../elk-instance.ts'
import { renderMermaidSVG } from '../index.ts'

describe('elkLayoutSync layout cache', () => {
  it('is opt-in: with no cache passed, every call recomputes independently', () => {
    const graph = parseMermaid('graph TD\n  A --> B')
    const elkGraph1 = convertToElkFormat(graph)
    const elkGraph2 = convertToElkFormat(graph)
    expect(elkGraph1).not.toBe(elkGraph2) // distinct objects, same content

    const result1 = elkLayoutSync(elkGraph1)
    const result2 = elkLayoutSync(elkGraph2)

    // No cache -> each call ran layout for real -> distinct result objects.
    expect(result1).not.toBe(result2)
    // ...but structurally the same, confirming this is a fair baseline for
    // the cache-enabled test below (a real recompute of equal input).
    expect(result1.width).toBe(result2.width)
    expect(result1.height).toBe(result2.height)
  })

  it('a cache hit returns the exact prior result object, skipping recomputation', () => {
    const cache = createLayoutCache()
    const graph = parseMermaid('graph TD\n  A --> B')
    const elkGraph1 = convertToElkFormat(graph)
    const elkGraph2 = convertToElkFormat(graph)
    expect(elkGraph1).not.toBe(elkGraph2)

    const result1 = elkLayoutSync(elkGraph1, cache)
    const result2 = elkLayoutSync(elkGraph2, cache)

    // Same key -> hit -> the literal object from the first call, not a
    // freshly-recomputed (even if equal-looking) one.
    expect(result2).toBe(result1)
    expect(cache.map.size).toBe(1)
  })

  it('returns genuinely different results for different inputs sharing one cache (correctness of the key)', () => {
    const cache = createLayoutCache()
    const small = parseMermaid('graph TD\n  A --> B')
    const big = parseMermaid('graph TD\n  A --> B --> C --> D --> E')

    const resultSmall = elkLayoutSync(convertToElkFormat(small), cache)
    const resultBig = elkLayoutSync(convertToElkFormat(big), cache)

    expect(resultSmall).not.toBe(resultBig)
    expect(resultBig.height ?? 0).toBeGreaterThan(resultSmall.height ?? 0)
    expect(cache.map.size).toBe(2)
  })

  it('a render-option difference (not just diagram text) produces a different cache entry', () => {
    const cache = createLayoutCache()
    const graph = parseMermaid('graph LR\n  A --> B')

    // Sanity check: nodeSpacing is a real input to the ELK graph, not a
    // no-op — otherwise this test wouldn't actually exercise the cache key.
    expect(convertToElkFormat(graph, { nodeSpacing: 400 })).not.toEqual(
      convertToElkFormat(graph),
    )

    const resultDefault = elkLayoutSync(convertToElkFormat(graph), cache)
    const resultWideSpacing = elkLayoutSync(
      convertToElkFormat(graph, { nodeSpacing: 400 }),
      cache,
    )

    expect(resultWideSpacing).not.toBe(resultDefault)
    expect(cache.map.size).toBe(2)
  })

  it('evicts the least-recently-used entry once maxSize is exceeded', () => {
    const cache = createLayoutCache(1)
    const graphA = parseMermaid('graph TD\n  A --> B')
    const graphB = parseMermaid('graph TD\n  X --> Y --> Z')

    const resultA1 = elkLayoutSync(convertToElkFormat(graphA), cache)
    // maxSize is 1, so caching B evicts A's entry.
    elkLayoutSync(convertToElkFormat(graphB), cache)
    expect(cache.map.size).toBe(1)

    // A was evicted -> this recomputes -> a new object, not resultA1.
    const resultA2 = elkLayoutSync(convertToElkFormat(graphA), cache)
    expect(resultA2).not.toBe(resultA1)
  })

  it('keeps a recently-touched entry alive over a colder one on eviction', () => {
    const cache = createLayoutCache(2)
    const graphA = parseMermaid('graph TD\n  A --> B')
    const graphB = parseMermaid('graph TD\n  X --> Y --> Z')
    const graphC = parseMermaid('graph TD\n  P --> Q --> R --> S')

    const resultA1 = elkLayoutSync(convertToElkFormat(graphA), cache)
    elkLayoutSync(convertToElkFormat(graphB), cache)
    // Touch A again -> A becomes the most-recently-used entry, B becomes
    // the least-recently-used one.
    const resultA2 = elkLayoutSync(convertToElkFormat(graphA), cache)
    expect(resultA2).toBe(resultA1) // still cached, still a hit

    // maxSize is 2, and B is now the LRU entry -> caching C evicts B, not A.
    elkLayoutSync(convertToElkFormat(graphC), cache)

    const resultA3 = elkLayoutSync(convertToElkFormat(graphA), cache)
    expect(resultA3).toBe(resultA1) // A survived the eviction
  })

  it('rejects a non-positive-integer maxSize', () => {
    expect(() => createLayoutCache(0)).toThrow()
    expect(() => createLayoutCache(-1)).toThrow()
    expect(() => createLayoutCache(1.5)).toThrow()
  })
})

describe('RenderOptions.layoutCache wiring', () => {
  it('layoutGraphSync (flowchart/state): unset by default, no shared state between calls', () => {
    const graph = parseMermaid('graph TD\n  A --> B')
    // No layoutCache passed — must behave exactly as before.
    const result = layoutGraphSync(graph)
    expect(result.width).toBeGreaterThan(0)
  })

  it('layoutGraphSync (flowchart/state): repeated identical calls reuse one cache entry', () => {
    const cache = createLayoutCache()
    const graph = parseMermaid('graph TD\n  A --> B')

    layoutGraphSync(graph, { layoutCache: cache })
    expect(cache.map.size).toBe(1)

    layoutGraphSync(graph, { layoutCache: cache })
    expect(cache.map.size).toBe(1) // hit, no new entry

    layoutGraphSync(parseMermaid('graph TD\n  A --> B --> C'), {
      layoutCache: cache,
    })
    expect(cache.map.size).toBe(2) // genuinely different graph, new entry
  })

  it('layoutClassDiagramSync: repeated identical calls reuse one cache entry', () => {
    const cache = createLayoutCache()
    const lines = splitStatements(
      'classDiagram\n  class Animal\n  Animal : +makeSound()',
    )
    const diagram = parseClassDiagram(lines)

    layoutClassDiagramSync(diagram, { layoutCache: cache })
    expect(cache.map.size).toBe(1)

    layoutClassDiagramSync(diagram, { layoutCache: cache })
    expect(cache.map.size).toBe(1)
  })

  it('layoutErDiagramSync: repeated identical calls reuse one cache entry', () => {
    const cache = createLayoutCache()
    const lines = splitStatements('erDiagram\n  CUSTOMER ||--o{ ORDER : places')
    const diagram = parseErDiagram(lines)

    layoutErDiagramSync(diagram, { layoutCache: cache })
    expect(cache.map.size).toBe(1)

    layoutErDiagramSync(diagram, { layoutCache: cache })
    expect(cache.map.size).toBe(1)
  })

  it('renderMermaidSVG: default (no layoutCache) output is unchanged', () => {
    const svg = renderMermaidSVG('graph TD\n  A[Hello] --> B[World]')
    expect(svg).toContain('<svg')
    expect(svg).toContain('Hello')
    expect(svg).toContain('World')
  })

  it('renderMermaidSVG: same source + options + cache produces identical SVG on repeat calls', () => {
    const cache = createLayoutCache()
    const text = 'graph TD\n  A[Hello] --> B[World]'

    const first = renderMermaidSVG(text, { layoutCache: cache })
    const second = renderMermaidSVG(text, { layoutCache: cache })

    expect(second).toBe(first)
    expect(cache.map.size).toBe(1)
  })

  it('renderMermaidSVG: different diagrams sharing one cache still render correctly (no cross-contamination)', () => {
    const cache = createLayoutCache()

    const svgAB = renderMermaidSVG('graph TD\n  A[Hello] --> B[World]', {
      layoutCache: cache,
    })
    const svgXYZ = renderMermaidSVG('graph TD\n  X --> Y --> Z', {
      layoutCache: cache,
    })

    expect(svgAB).toContain('Hello')
    expect(svgAB).not.toContain('>X<')
    expect(svgXYZ).not.toContain('Hello')
    expect(cache.map.size).toBe(2)
  })
})
