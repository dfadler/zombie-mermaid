// ============================================================================
// ASCII sequence diagram note tests
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII sequence diagrams – pre-message notes', () => {
  it('renders a note placed before the first message (regression)', () => {
    const result = renderMermaidASCII(`sequenceDiagram
      participant A as Alice
      participant B as Bob
      Note over A: note 1
      A->>B: Hello`)
    expect(result).toContain('note 1')
    expect(result).toContain('Hello')
  })

  it('renders a notes-only diagram (0 messages) without crashing', () => {
    const result = renderMermaidASCII(`sequenceDiagram
      participant A
      Note over A: lonely note`)
    expect(result).toContain('lonely note')
  })
})

describe('ASCII sequence diagrams – note box vs. lifeline collision (regression)', () => {
  // When a "Note over A,B" box is computed wide enough that its own right
  // padding column lands exactly on B's lifeline x-position, the lifeline
  // (drawn in an earlier pass) must not leak through as a second border
  // character next to the note's real right border. 8-9 'x' characters is
  // the exact width, given these actors' default spacing, that reproduces
  // the collision — shorter or longer text misses the colliding column.
  for (const n of [8, 9]) {
    it(`does not double up border characters for a ${n}-char note spanning two actors`, () => {
      const noteText = 'x'.repeat(n)
      const result = renderMermaidASCII(
        `sequenceDiagram
      participant A
      participant B
      A->>B: hi
      Note over A,B: ${noteText}`,
        { colorMode: 'none' },
      )
      const lines = result.split('\n')
      const contentLine = lines.find((l) => l.includes(noteText))
      expect(contentLine).toBeDefined()

      // No two border/line-drawing characters should sit directly adjacent
      // with no space between them anywhere in the note's rows — that
      // shape (e.g. "││") only occurs when a stale lifeline character
      // leaks through an unblanked padding column next to a real border.
      const noteLineIndex = lines.indexOf(contentLine!)
      const topBorderLine = lines[noteLineIndex - 1]!
      const bottomBorderLine = lines[noteLineIndex + 1]!
      for (const line of [topBorderLine, contentLine!, bottomBorderLine]) {
        expect(line).not.toMatch(/[│|┌┐└┘][│|┌┐└┘]/)
      }
    })
  }
})
