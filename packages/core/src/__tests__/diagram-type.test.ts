import { describe, it, expect } from 'vitest'
import { detectDiagramType } from '@zombie-mermaid/core'

describe('detectDiagramType', () => {
  it('detects each diagram type from its header keyword', () => {
    expect(detectDiagramType('flowchart TD\nA-->B')).toBe('flowchart')
    expect(detectDiagramType('sequenceDiagram\nA->>B: Hi')).toBe('sequence')
    expect(detectDiagramType('classDiagram\nclass Foo')).toBe('class')
    expect(detectDiagramType('erDiagram\nFOO ||--o{ BAR : has')).toBe('er')
    expect(detectDiagramType('xychart-beta\nx-axis [a, b]')).toBe('xychart')
  })

  it('detects architecture diagrams under both header spellings', () => {
    expect(detectDiagramType('architecture-beta\nservice a')).toBe(
      'architecture',
    )
    expect(detectDiagramType('architecture\nservice a')).toBe('architecture')
    expect(detectDiagramType('Architecture-Beta\nservice a')).toBe(
      'architecture',
    )
    expect(detectDiagramType('architecture-beta;service a')).toBe(
      'architecture',
    )
  })

  it('does not match an architecture header with an unsupported suffix', () => {
    expect(detectDiagramType('architecture-foo\nservice a')).toBe('flowchart')
    expect(detectDiagramType('architecture-beta TB\nservice a')).toBe(
      'flowchart',
    )
  })

  it('detects every C4 variant header, case-insensitively', () => {
    for (const header of [
      'C4Context',
      'C4Container',
      'C4Component',
      'C4Dynamic',
      'C4Deployment',
      'c4context',
    ]) {
      expect(detectDiagramType(`${header}\nPerson(a, "A")`)).toBe('c4')
    }
    expect(detectDiagramType('C4Context;Person(a, "A")')).toBe('c4')
  })

  it('does not match an unknown C4 variant', () => {
    expect(detectDiagramType('C4Foo\nPerson(a, "A")')).toBe('flowchart')
  })

  it('isolates the header on a semicolon-separated single line', () => {
    expect(detectDiagramType('sequenceDiagram;A->>B: Hi')).toBe('sequence')
    expect(detectDiagramType('classDiagram;class Foo')).toBe('class')
    expect(detectDiagramType('erDiagram;FOO ||--o{ BAR : has')).toBe('er')
    expect(detectDiagramType('flowchart TD;A-->B')).toBe('flowchart')
  })

  it('does not match an xychart header with an unsupported suffix', () => {
    expect(detectDiagramType('xychart-foo\nx-axis [a, b]')).toBe('flowchart')
  })

  it('falls back to flowchart for unrecognized input', () => {
    expect(detectDiagramType('')).toBe('flowchart')
    expect(detectDiagramType('not a real header')).toBe('flowchart')
  })
})
