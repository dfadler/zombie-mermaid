import { describe, expect, it } from 'vitest'
import { defaultPort } from '../scripts/dev-port'

// Per-worktree dev port (#1589, #1662).
const WT = '/r/zombie-mermaid/.claude/worktrees/agent-a1'

describe('defaultPort', () => {
  it('uses 3456 for the main checkout', () => {
    expect(defaultPort('/r/zombie-mermaid', undefined)).toBe(3456)
  })

  it('gives a worktree a stable port in 3500-3999', () => {
    const p = defaultPort(WT, undefined)
    expect(p).toBeGreaterThanOrEqual(3500)
    expect(p).toBeLessThanOrEqual(3999)
    expect(p).toBe(3767) // Pins the hash so a formula change is deliberate
  })

  it('spreads different worktrees across ports', () => {
    const ports = new Set(
      Array.from({ length: 30 }, (_, i) =>
        defaultPort(`/r/z/.claude/worktrees/agent-${i}`, undefined),
      ),
    )
    expect(ports.size).toBeGreaterThan(20)
  })

  it('lets PORT win, even in a worktree', () => {
    expect(defaultPort(WT, '4000')).toBe(4000)
    expect(defaultPort('/r/zombie-mermaid', '4001')).toBe(4001)
  })

  it('falls back to 3456 for a non-numeric PORT', () => {
    expect(defaultPort(WT, 'abc')).toBe(3456)
  })
})
