/**
 * Guards the wide/narrow orientation-swap logic shared by demo/client.ts
 * (the interactive gallery, live in the browser) and pages.ts (the SEO
 * landing pages, at build time).
 *
 * Lives here rather than under src/__tests__ because it imports from
 * demo/, which sits outside tsconfig's `rootDir: "src"`.
 */
import { describe, it, expect } from 'vitest'
import {
  wideDiagramDirectionLine,
  withNarrowDirection,
  withUniqueSvgIds,
} from '../demo/diagram-orientation.ts'

describe('wideDiagramDirectionLine', () => {
  it('finds a wide flowchart header (LR/RL)', () => {
    expect(wideDiagramDirectionLine('graph LR\n  A --> B')).toBe(0)
    expect(wideDiagramDirectionLine('flowchart RL\n  A --> B')).toBe(0)
  })

  it('returns null for an already-narrow flowchart', () => {
    expect(wideDiagramDirectionLine('graph TD\n  A --> B')).toBeNull()
    expect(wideDiagramDirectionLine('graph TB\n  A --> B')).toBeNull()
    expect(wideDiagramDirectionLine('graph BT\n  A --> B')).toBeNull()
  })

  it('finds a top-level wide `direction` statement in a state diagram', () => {
    const source = 'stateDiagram-v2\n  direction LR\n  [*] --> Idle'
    expect(wideDiagramDirectionLine(source)).toBe(1)
  })

  it('ignores a `direction` statement nested inside a composite state', () => {
    const source = [
      'stateDiagram-v2',
      '  state Outer {',
      '    direction LR',
      '  }',
      '  [*] --> Outer',
    ].join('\n')
    expect(wideDiagramDirectionLine(source)).toBeNull()
  })

  it('returns null for diagram types with no orientation concept', () => {
    expect(wideDiagramDirectionLine('sequenceDiagram\n  A->>B: hi')).toBeNull()
    expect(wideDiagramDirectionLine('erDiagram\n  A ||--o{ B : has')).toBeNull()
    expect(wideDiagramDirectionLine('classDiagram\n  class A')).toBeNull()
  })
})

describe('withNarrowDirection', () => {
  it('rewrites the direction word on the given line to TD', () => {
    expect(withNarrowDirection('graph LR\n  A --> B', 0)).toBe(
      'graph TD\n  A --> B',
    )
  })

  it('rewrites RL to TD, not to its literal opposite', () => {
    expect(withNarrowDirection('graph RL\n  A --> B', 0)).toBe(
      'graph TD\n  A --> B',
    )
  })

  it('leaves every other line untouched', () => {
    const source = 'stateDiagram-v2\n  direction LR\n  [*] --> Idle'
    expect(withNarrowDirection(source, 1)).toBe(
      'stateDiagram-v2\n  direction TD\n  [*] --> Idle',
    )
  })
})

describe('withUniqueSvgIds', () => {
  it('prefixes real id attributes and their url(#…) references', () => {
    const svg =
      '<svg><marker id="arrowhead"/><path marker-end="url(#arrowhead)"/></svg>'
    expect(withUniqueSvgIds(svg, 'w-')).toBe(
      '<svg><marker id="w-arrowhead"/><path marker-end="url(#w-arrowhead)"/></svg>',
    )
  })

  it('rewrites href="#…" references alongside url(#…) ones', () => {
    const svg = '<svg><path id="edge1"/><use href="#edge1"/></svg>'
    expect(withUniqueSvgIds(svg, 'n-')).toBe(
      '<svg><path id="n-edge1"/><use href="#n-edge1"/></svg>',
    )
  })

  it('leaves data-id attributes alone', () => {
    const svg = '<g class="node" data-id="A" data-label="Start"></g>'
    expect(withUniqueSvgIds(svg, 'w-')).toBe(svg)
  })

  it('produces no id collisions between two prefixed renders of the same SVG', () => {
    const svg = '<svg><marker id="arrowhead"/><g id="A"/></svg>'
    const wide = withUniqueSvgIds(svg, 'w-')
    const narrow = withUniqueSvgIds(svg, 'n-')
    const wideIds = [...wide.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
    const narrowIds = [...narrow.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
    expect(new Set([...wideIds, ...narrowIds]).size).toBe(
      wideIds.length + narrowIds.length,
    )
  })
})
