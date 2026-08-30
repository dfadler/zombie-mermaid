// ============================================================================
// ASCII sequence diagram tests — parity gaps found comparing against
// AlexanderGrooff/mermaid-ascii: autonumber, bidirectional arrows, and
// undeclared multi-word actor names.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII sequence diagrams – autonumber', () => {
  it('renders sequence numbers near each numbered arrow, in order', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      autonumber
      A->>B: First
      A->>B: Second`,
      { useAscii: false },
    )
    const lines = result.split('\n')
    const firstArrowLine = lines.find((l) => l.includes('▶') && l.includes('1'))
    const secondArrowLine = lines
      .slice(lines.indexOf(firstArrowLine ?? ''))
      .find((l) => l.includes('▶') && l.includes('2'))
    expect(firstArrowLine).toBeDefined()
    expect(secondArrowLine).toBeDefined()
  })

  it('does not number messages before autonumber', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      A->>B: Unnumbered
      autonumber
      A->>B: Numbered`,
      { useAscii: false },
    )
    const lines = result.split('\n')
    const unnumberedArrowLine = lines.find(
      (l) => l.includes('▶') && !/[0-9]/.test(l),
    )
    const numberedArrowLine = lines.find(
      (l) => l.includes('▶') && /[0-9]/.test(l),
    )
    expect(unnumberedArrowLine).toBeDefined()
    expect(numberedArrowLine).toBeDefined()
  })

  it('renders without autonumber unchanged (no stray digits near arrows)', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      A->>B: Hello`,
      { useAscii: false },
    )
    expect(result).toContain('Hello')
    expect(result).not.toMatch(/[0-9]/)
  })
})

describe('ASCII sequence diagrams – bidirectional arrows', () => {
  it('draws arrowheads on both ends for a solid bidirectional arrow', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      A<<->>B: Sync call`,
      { useAscii: false },
    )
    expect(result).toContain('◀')
    expect(result).toContain('▶')
  })

  it('draws a dashed bidirectional arrow with arrowheads on both ends', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      A<<-->>B: Async call`,
      { useAscii: false },
    )
    expect(result).toContain('◀')
    expect(result).toContain('▶')
    expect(result).toContain('╌')
  })

  it('a regular one-way arrow only gets one arrowhead', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      A->>B: Hello`,
      { useAscii: false },
    )
    const arrowLine = result
      .split('\n')
      .find((l) => l.includes('▶'))
    expect(arrowLine).toBeDefined()
    expect(arrowLine).not.toContain('◀')
  })

  it('renders bidirectional arrows in ASCII-only mode without special glyphs', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      A<<->>B: Sync call`,
      { useAscii: true },
    )
    expect(result).toContain('<')
    expect(result).toContain('>')
  })
})

describe('ASCII sequence diagrams – multi-word inline actor names', () => {
  it('renders an undeclared actor name with a space and a hyphenated name', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      cron job->>customer-notifier: hi`,
      { useAscii: false },
    )
    expect(result).toContain('cron job')
    expect(result).toContain('customer-notifier')
    expect(result).toContain('hi')
  })

  it('still renders plain single-word actor names correctly', () => {
    const result = renderMermaidASCII(
      `sequenceDiagram
      Alice->>Bob: Hello`,
      { useAscii: false },
    )
    expect(result).toContain('Alice')
    expect(result).toContain('Bob')
  })
})
