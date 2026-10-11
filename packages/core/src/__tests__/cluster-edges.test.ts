import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { withoutOwnClusterEdges } from '../cluster-edges.ts'

const pairs = (src: string) =>
  withoutOwnClusterEdges(parseMermaid(src)).edges.map(
    (e) => `${e.source}>${e.target}`,
  )

describe('withoutOwnClusterEdges (#1310)', () => {
  it('drops an edge from a member node to its subgraph', () => {
    expect(
      pairs('flowchart TD; subgraph Sub; B; end; A --> B; B --> Sub'),
    ).toEqual(['A>B'])
  })

  it('drops an edge from a subgraph to one of its members', () => {
    expect(
      pairs('flowchart TD; subgraph Sub; B; end; A --> B; Sub --> B'),
    ).toEqual(['A>B'])
  })

  it('drops edges between a nested member, its enclosing subgraphs, and nested subgraphs', () => {
    expect(
      pairs(
        'flowchart TD; subgraph Outer; subgraph Inner; B; end; end; A --> B; B --> Outer; Inner --> B; Outer --> Inner',
      ),
    ).toEqual(['A>B'])
  })

  it('keeps an edge from an outside node to a subgraph', () => {
    expect(
      pairs('flowchart TD; subgraph Sub; B; end; X --> Sub; A --> B'),
    ).toEqual(['X>Sub', 'A>B'])
  })

  it('keeps an edge between two subgraphs', () => {
    expect(
      pairs('flowchart TD; subgraph P; A; end; subgraph Q; B; end; P --> Q'),
    ).toEqual(['P>Q'])
  })

  it('returns the same graph object when nothing is dropped', () => {
    const g = parseMermaid('flowchart TD; subgraph Sub; B; end; X --> Sub')
    expect(withoutOwnClusterEdges(g)).toBe(g)
  })
})
