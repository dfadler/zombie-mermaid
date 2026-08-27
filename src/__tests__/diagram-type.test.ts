import { describe, it, expect } from 'vitest'
import { detectDiagramType } from '../diagram-type.ts'

describe('detectDiagramType', () => {
  it('detects each diagram type from its header keyword', () => {
    expect(detectDiagramType('flowchart TD\nA-->B')).toBe('flowchart')
    expect(detectDiagramType('sequenceDiagram\nA->>B: Hi')).toBe('sequence')
    expect(detectDiagramType('classDiagram\nclass Foo')).toBe('class')
    expect(detectDiagramType('erDiagram\nFOO ||--o{ BAR : has')).toBe('er')
    expect(detectDiagramType('xychart-beta\nx-axis [a, b]')).toBe('xychart')
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
