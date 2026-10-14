// ============================================================================
// Line-level diagnostics on failed renders (#1174): each supported diagram
// type reports the failing line + source line as structured JSON alongside
// the unchanged error text; errors with no position fall back to the plain
// message; nothing is stripped or partially rendered.
// ============================================================================

import { describe, it, expect } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { MermaidParseError } from '@zombie-mermaid/core'
import { renderSvgHandler } from '../tools/render-svg.ts'
import { renderAsciiHandler } from '../tools/render-ascii.ts'
import { extractParseDiagnostic } from '../tools/parse-diagnostics.ts'

function blocks(result: CallToolResult): string[] {
  return result.content.map((c) => {
    if (c.type !== 'text') throw new Error('Expected text content')
    return c.text
  })
}

const CASES: Array<{
  type: string
  diagram: string
  line: number
  sourceLine: string
}> = [
  {
    type: 'flowchart',
    diagram: 'graph XX\n  A --> B',
    line: 1,
    sourceLine: 'graph XX',
  },
  {
    type: 'sequence',
    diagram:
      'sequenceDiagram\n  participant A\n  A->>B: hi\n  loop forever\n  B-->>A: ok',
    line: 4,
    sourceLine: '  loop forever',
  },
  {
    type: 'class',
    diagram: 'classDiagram\n  class Animal {\n    <<interface\n  }',
    line: 3,
    sourceLine: '    <<interface',
  },
  {
    type: 'er',
    diagram: 'erDiagram\n  A {\n    string id\n  }\n\n  A ||--o{ B',
    line: 6,
    sourceLine: '  A ||--o{ B',
  },
  {
    type: 'xychart',
    diagram: 'xychart-beta\n  title "T"\n  x-axis [a, b]\n  bar [1, oops]',
    line: 4,
    sourceLine: '  bar [1, oops]',
  },
]

describe.each([
  ['render_mermaid_svg', renderSvgHandler, 'Failed to render diagram to SVG'],
  [
    'render_mermaid_ascii',
    renderAsciiHandler,
    'Failed to render diagram to ASCII',
  ],
] as const)('%s parse diagnostics', (_name, handler, prefix) => {
  it.each(CASES)(
    'reports line $line and the source line for a $type diagram',
    ({ diagram, line, sourceLine }) => {
      const result = handler({ diagram })
      expect(result.isError).toBe(true)
      const [message, json, ...rest] = blocks(result)
      expect(rest).toEqual([])
      // Existing message text is untouched.
      expect(message?.startsWith(`${prefix}: Line ${line}: `)).toBe(true)
      const parsed = JSON.parse(json ?? '')
      expect(parsed.diagnostics).toHaveLength(1)
      expect(parsed.diagnostics[0]).toMatchObject({ line, sourceLine })
      expect(parsed.diagnostics[0].message).not.toMatch(/^Line \d+:/)
      // No parser reports a column; it must not be invented.
      expect(parsed.diagnostics[0]).not.toHaveProperty('column')
    },
  )

  it('falls back to the plain message when the error has no line', () => {
    const result = handler({ diagram: '   \n  ' })
    expect(result.isError).toBe(true)
    expect(blocks(result)).toEqual([`${prefix}: Empty mermaid diagram`])
  })
})

describe('extractParseDiagnostic', () => {
  it('handles CRLF sources without leaking the carriage return', () => {
    const err = new MermaidParseError('Line 2: bad')
    expect(extractParseDiagnostic(err, 'a\r\nb\r\nc')).toEqual({
      line: 2,
      sourceLine: 'b',
      message: 'bad',
    })
  })

  it('returns undefined for a line outside the source', () => {
    expect(
      extractParseDiagnostic(new MermaidParseError('x', { line: 9 }), 'a\nb'),
    ).toBeUndefined()
    expect(
      extractParseDiagnostic(new MermaidParseError('x', { line: 0 }), 'a\nb'),
    ).toBeUndefined()
  })

  it('uses the typed line even without a message prefix (#1979)', () => {
    expect(
      extractParseDiagnostic(
        new MermaidParseError('no prefix here', { line: 2 }),
        'a\nb',
      ),
    ).toEqual({ line: 2, sourceLine: 'b', message: 'no prefix here' })
  })

  it('ignores a plain Error even when it has a "Line N:" prefix', () => {
    expect(extractParseDiagnostic(new Error('Line 1: x'), 'a')).toBeUndefined()
  })

  it('returns undefined for a MermaidParseError with no line', () => {
    expect(
      extractParseDiagnostic(new MermaidParseError('x'), 'a'),
    ).toBeUndefined()
  })
})
