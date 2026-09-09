/**
 * Tests for the sequence diagram activation/deactivation auto-fix
 * (packages/mermaid-parser/src/sequence/activation-fix.ts). Operates on raw
 * Mermaid source text (unlike checkActivationBalance, which takes an
 * already-parsed diagram), since the fix needs to append to the original
 * source rather than just report against the parsed model.
 *
 * Covers: an already-balanced diagram (no-op), a single dangling
 * activation (auto-fixed), multiple dangling activations across actors, an
 * unmatched deactivation (deliberately NOT auto-fixed — see module header),
 * and a mix of both issue types together.
 */
import { describe, it, expect } from 'vitest'
import { fixActivationBalance } from '@zombie-mermaid/mermaid-parser'

describe('fixActivationBalance', () => {
  it('returns the diagram unchanged when already balanced', () => {
    const source = 'sequenceDiagram\n  A->>+B: hello\n  B-->>-A: world'
    const result = fixActivationBalance(source)
    expect(result.ok).toBe(true)
    expect(result.fixedDiagram).toBe(source)
    expect(result.fixesApplied).toEqual([])
    expect(result.remainingIssues).toEqual([])
  })

  it('appends a deactivate statement for a single dangling activation', () => {
    const source = 'sequenceDiagram\n  activate A\n  A->>B: hello'
    const result = fixActivationBalance(source)
    expect(result.ok).toBe(true)
    expect(result.originalDiagram).toBe(source)
    expect(result.fixedDiagram).toBe(`${source}\n  deactivate A`)
    expect(result.fixesApplied).toEqual([
      expect.stringContaining('Appended "deactivate A"'),
    ])
    expect(result.remainingIssues).toEqual([])
  })

  it('makes the fixed diagram re-check as balanced', () => {
    const source = 'sequenceDiagram\n  activate A\n  A->>B: hello'
    const { fixedDiagram } = fixActivationBalance(source)
    const reChecked = fixActivationBalance(fixedDiagram)
    expect(reChecked.ok).toBe(true)
    expect(reChecked.fixesApplied).toEqual([])
  })

  it('closes multiple dangling activations for different actors', () => {
    const source =
      'sequenceDiagram\n  activate A\n  activate B\n  A->>B: hello'
    const result = fixActivationBalance(source)
    expect(result.ok).toBe(true)
    expect(result.fixesApplied).toHaveLength(2)
    expect(result.fixedDiagram).toContain('  deactivate A')
    expect(result.fixedDiagram).toContain('  deactivate B')
  })

  it('does not fix an unmatched deactivation and reports it back', () => {
    const source = 'sequenceDiagram\n  A->>B: hello\n  deactivate A'
    const result = fixActivationBalance(source)
    expect(result.ok).toBe(false)
    expect(result.fixedDiagram).toBe(source)
    expect(result.fixesApplied).toEqual([])
    expect(result.remainingIssues).toEqual([
      expect.objectContaining({
        code: 'UNMATCHED_DEACTIVATION',
        actorId: 'A',
      }),
    ])
  })

  it('fixes the dangling half of a mixed-issue diagram, leaving the unmatched half reported', () => {
    const source =
      'sequenceDiagram\n  activate A\n  A->>B: hello\n  deactivate B'
    const result = fixActivationBalance(source)
    expect(result.ok).toBe(false)
    expect(result.fixesApplied).toEqual([
      expect.stringContaining('Appended "deactivate A"'),
    ])
    expect(result.fixedDiagram).toContain('  deactivate A')
    expect(result.remainingIssues).toEqual([
      expect.objectContaining({
        code: 'UNMATCHED_DEACTIVATION',
        actorId: 'B',
      }),
    ])
  })

  it('throws a clear error for a non-sequence diagram', () => {
    expect(() => fixActivationBalance('graph LR\n  A --> B')).toThrow(
      /only supports sequence diagrams/,
    )
  })
})
