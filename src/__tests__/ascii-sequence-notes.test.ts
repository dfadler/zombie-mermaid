// ============================================================================
// ASCII sequence diagram note tests
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidAscii } from '../ascii/index.ts'

describe('ASCII sequence diagrams – pre-message notes', () => {
  it('renders a note placed before the first message (regression)', () => {
    const result = renderMermaidAscii(`sequenceDiagram
      participant A as Alice
      participant B as Bob
      Note over A: note 1
      A->>B: Hello`)
    expect(result).toContain('note 1')
    expect(result).toContain('Hello')
  })

  it('renders a notes-only diagram (0 messages) without crashing', () => {
    const result = renderMermaidAscii(`sequenceDiagram
      participant A
      Note over A: lonely note`)
    expect(result).toContain('lonely note')
  })
})
