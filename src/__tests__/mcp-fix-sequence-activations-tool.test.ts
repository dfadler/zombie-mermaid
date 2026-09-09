import { describe, it, expect } from 'vitest'
import { fixSequenceActivationsHandler } from '../mcp/tools/fix-sequence-activations.ts'

interface FixReport {
  ok: boolean
  fixedDiagram: string
  fixesApplied: string[]
  remainingIssues: unknown[]
}

function parseReport(text: string): FixReport {
  return JSON.parse(text) as FixReport
}

describe('fixSequenceActivationsHandler', () => {
  it('reports ok: true with no fixes for an already-balanced diagram', () => {
    const result = fixSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  A->>+B: hello\n  B-->>-A: world',
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    const report = parseReport(content.text)
    expect(report.ok).toBe(true)
    expect(report.fixesApplied).toEqual([])
    expect(report.remainingIssues).toEqual([])
    expect(report.fixedDiagram).toBe(
      'sequenceDiagram\n  A->>+B: hello\n  B-->>-A: world',
    )
  })

  it('appends a matching deactivate for a dangling activation', () => {
    const result = fixSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  activate A\n  A->>B: hello',
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    const report = parseReport(content.text)
    expect(report.ok).toBe(true)
    expect(report.fixesApplied).toHaveLength(1)
    expect(report.remainingIssues).toEqual([])
    expect(report.fixedDiagram.trim().endsWith('deactivate A')).toBe(true)
  })

  it('fixes multiple dangling activations across different actors', () => {
    const result = fixSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  activate A\n  activate B\n  A->>B: hello',
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    const report = parseReport(content.text)
    expect(report.ok).toBe(true)
    expect(report.fixesApplied).toHaveLength(2)
    expect(report.fixedDiagram).toContain('deactivate A')
    expect(report.fixedDiagram).toContain('deactivate B')
  })

  it('does not auto-fix an unmatched deactivation, reporting it instead', () => {
    const result = fixSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  A->>B: hello\n  deactivate A',
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    const report = parseReport(content.text)
    expect(report.ok).toBe(false)
    expect(report.fixesApplied).toEqual([])
    expect(report.fixedDiagram).toBe(
      'sequenceDiagram\n  A->>B: hello\n  deactivate A',
    )
    expect(report.remainingIssues).toEqual([
      expect.objectContaining({
        code: 'UNMATCHED_DEACTIVATION',
        actorId: 'A',
      }),
    ])
  })

  it('fixes the dangling activation while still reporting an unmatched one', () => {
    const result = fixSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  activate A\n  A->>B: hello\n  deactivate B',
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    const report = parseReport(content.text)
    expect(report.ok).toBe(false)
    expect(report.fixesApplied).toHaveLength(1)
    expect(report.fixedDiagram).toContain('deactivate A')
    expect(report.remainingIssues).toEqual([
      expect.objectContaining({
        code: 'UNMATCHED_DEACTIVATION',
        actorId: 'B',
      }),
    ])
  })

  it('rejects a non-sequence diagram with a clear error instead of a false report', () => {
    const result = fixSequenceActivationsHandler({
      diagram: 'graph LR\n  A --> B',
    })
    expect(result.isError).toBe(true)
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toContain('only fixes sequence diagrams')
    expect(content.text).toContain('"flowchart"')
  })

  it('returns an MCP tool error instead of throwing on invalid sequence syntax', () => {
    const result = fixSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  box\n  box',
    })
    expect(result.isError).toBe(true)
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toContain('Failed to fix diagram activations')
  })
})
