import { describe, it, expect } from 'vitest'
import { checkSequenceActivationsHandler } from '../../packages/mcp/src/tools/check-sequence-activations.ts'

function parseReport(text: string): { ok: boolean; issues: unknown[] } {
  return JSON.parse(text) as { ok: boolean; issues: unknown[] }
}

describe('checkSequenceActivationsHandler', () => {
  it('reports ok: true for a diagram with balanced activation', () => {
    const result = checkSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  A->>+B: hello\n  B-->>-A: world',
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    const report = parseReport(content.text)
    expect(report.ok).toBe(true)
    expect(report.issues).toEqual([])
  })

  it('flags a dangling activate with no matching deactivate', () => {
    const result = checkSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  activate A\n  A->>B: hello',
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    const report = parseReport(content.text)
    expect(report.ok).toBe(false)
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: 'DANGLING_ACTIVATION',
        actorId: 'A',
      }),
    ])
  })

  it('flags a mismatched deactivate with nothing open', () => {
    const result = checkSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  A->>B: hello\n  deactivate A',
    })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    const report = parseReport(content.text)
    expect(report.ok).toBe(false)
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: 'UNMATCHED_DEACTIVATION',
        actorId: 'A',
      }),
    ])
  })

  it('rejects a non-sequence diagram with a clear error instead of a false report', () => {
    const result = checkSequenceActivationsHandler({
      diagram: 'graph LR\n  A --> B',
    })
    expect(result.isError).toBe(true)
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toContain('only checks sequence diagrams')
    expect(content.text).toContain('"flowchart"')
  })

  it('returns an MCP tool error instead of throwing on invalid sequence syntax', () => {
    const result = checkSequenceActivationsHandler({
      diagram: 'sequenceDiagram\n  box\n  box',
    })
    expect(result.isError).toBe(true)
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toContain('Failed to check diagram activations')
  })
})
