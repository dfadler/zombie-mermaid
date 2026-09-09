/**
 * Tests for the sequence diagram activation/deactivation balance check
 * (packages/mermaid-parser/src/sequence/activation-check.ts).
 *
 * Covers: balanced diagrams (both the standalone activate/deactivate form
 * and the +/- arrow shorthand, including nesting), a dangling activation
 * (never closed), an unmatched deactivation (nothing open), and diagrams
 * that mix both issue types or both syntactic forms together.
 */
import { describe, it, expect } from 'vitest'
import {
  parseSequenceDiagram,
  checkActivationBalance,
} from '@zombie-mermaid/mermaid-parser'

/** Helper to parse — preprocesses text the same way index.ts does. */
function parse(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))
  return parseSequenceDiagram(lines)
}

describe('checkActivationBalance — balanced diagrams', () => {
  it('passes a diagram with no activations at all', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      A->>B: hello`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('passes balanced standalone activate/deactivate', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      activate A
      A->>B: hello
      deactivate A`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('passes balanced +/- arrow shorthand', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      A->>+B: hello
      B-->>-A: world`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('passes nested activations on the same actor, closed innermost-first', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      A->>+B: outer
      B->>+B: inner
      B-->>-B: inner done
      B-->>-A: outer done`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('passes a diagram mixing standalone and shorthand forms for different actors', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      participant C
      activate A
      A->>+B: hello
      B-->>-A: world
      deactivate A`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })
})

describe('checkActivationBalance — dangling activation', () => {
  it('flags an activate that is never deactivated (standalone form)', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      activate A
      A->>B: hello`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      {
        code: 'DANGLING_ACTIVATION',
        actorId: 'A',
        message: expect.stringContaining('"activate A"'),
      },
    ])
    expect(result.issues[0]?.message).toContain('never closed')
  })

  it('flags an activate that is never deactivated (+/- shorthand form)', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      A->>+B: hello`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      code: 'DANGLING_ACTIVATION',
      actorId: 'B',
    })
  })

  it('flags each dangling activation separately when nested', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      activate B
      A->>B: outer
      activate B
      A->>B: inner`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(false)
    expect(result.issues).toHaveLength(2)
    expect(result.issues.every((i) => i.code === 'DANGLING_ACTIVATION')).toBe(
      true,
    )
  })
})

describe('checkActivationBalance — unmatched deactivation', () => {
  it('flags a deactivate with nothing open (standalone form)', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      A->>B: hello
      deactivate A`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      {
        code: 'UNMATCHED_DEACTIVATION',
        actorId: 'A',
        message: expect.stringContaining('"deactivate A"'),
      },
    ])
    expect(result.issues[0]?.message).toContain('no matching')
  })

  it('flags a deactivate with nothing open (-shorthand form)', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      A-->>-B: hello`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      code: 'UNMATCHED_DEACTIVATION',
      actorId: 'A',
    })
  })

  it('flags an extra deactivate beyond the number of opens', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      activate A
      A->>B: hello
      deactivate A
      deactivate A`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      {
        code: 'UNMATCHED_DEACTIVATION',
        actorId: 'A',
        message: expect.any(String),
      },
    ])
  })
})

describe('checkActivationBalance — mixed issues and message context', () => {
  it('reports both a dangling activation and an unmatched deactivation together', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      activate A
      A->>B: hello
      deactivate B`)
    const result = checkActivationBalance(diagram)
    expect(result.ok).toBe(false)
    const codes = result.issues.map((i) => i.code).sort()
    expect(codes).toEqual(['DANGLING_ACTIVATION', 'UNMATCHED_DEACTIVATION'])
  })

  it("includes the anchoring message's text in the issue message", () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      A->>+B: do the thing`)
    const result = checkActivationBalance(diagram)
    expect(result.issues[0]?.message).toContain('do the thing')
  })

  it('describes an activation opened before the first message', () => {
    const diagram = parse(`sequenceDiagram
      participant A
      participant B
      activate A
      A->>B: hello`)
    const result = checkActivationBalance(diagram)
    expect(result.issues[0]?.message).toContain('before the first message')
  })
})
