/**
 * Unit tests for src/layout-engine.ts's public entry points.
 *
 * layoutGraphSync is covered indirectly by many integration tests elsewhere
 * (see layout-disconnected.test.ts, edge-approach-direction.test.ts, etc).
 * convertToElkFormat is a benchmarking helper that exposes the
 * MermaidGraph -> ELK JSON conversion step without running layout — it had
 * no direct test coverage.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToElkFormat, layoutGraphSync } from '../layout-engine.ts'

describe('convertToElkFormat', () => {
  it('converts a simple graph into ELK JSON without running layout', () => {
    const graph = parseMermaid(`graph TD
      A[Start] --> B[End]`)

    const elkGraph = convertToElkFormat(graph)

    expect(elkGraph.children).toBeDefined()
    const ids = elkGraph.children!.map((n) => n.id)
    expect(ids).toContain('A')
    expect(ids).toContain('B')
    expect(elkGraph.edges).toHaveLength(1)

    // No layout has been run: ELK positions (x/y) are not yet assigned.
    for (const node of elkGraph.children!) {
      expect(node.x).toBeUndefined()
      expect(node.y).toBeUndefined()
    }
  })

  it('applies direction options from RenderOptions', () => {
    const graph = parseMermaid(`graph LR
      A --> B`)

    const elkGraph = convertToElkFormat(graph)

    expect(elkGraph.layoutOptions?.['elk.direction']).toBe('RIGHT')
  })

  it('resolves custom fontSizes into node sizing', () => {
    const graph = parseMermaid(`graph TD
      A[Node] --> B[Node]`)

    const defaultSized = convertToElkFormat(graph)
    const largeFontSized = convertToElkFormat(graph, {
      fontSizes: { nodeLabel: 40 },
    })

    const defaultWidth = defaultSized.children!.find(
      (n) => n.id === 'A',
    )!.width!
    const largeWidth = largeFontSized.children!.find(
      (n) => n.id === 'A',
    )!.width!

    expect(largeWidth).toBeGreaterThan(defaultWidth)
  })

  it('defaults options when none are provided', () => {
    const graph = parseMermaid(`graph TD
      A --> B`)

    const withDefaults = convertToElkFormat(graph)
    const withEmptyOptions = convertToElkFormat(graph, {})

    expect(withDefaults.layoutOptions?.['elk.direction']).toBe(
      withEmptyOptions.layoutOptions?.['elk.direction'],
    )
  })
})

describe('layoutGraphSync', () => {
  it('lays out a simple graph end-to-end', () => {
    const graph = parseMermaid(`graph TD
      A[Start] --> B[End]`)

    const positioned = layoutGraphSync(graph)

    expect(positioned.nodes).toHaveLength(2)
    for (const node of positioned.nodes) {
      expect(typeof node.x).toBe('number')
      expect(typeof node.y).toBe('number')
    }
  })
})
