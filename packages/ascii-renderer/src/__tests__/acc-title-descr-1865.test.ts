/**
 * `accTitle` / `accDescr` have no place in text output (#1865): every
 * diagram type renders byte-identically with and without them.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const BODIES: Record<string, string> = {
  flowchart: 'graph LR\n  A --> B',
  state: 'stateDiagram-v2\n  [*] --> A',
  sequence: 'sequenceDiagram\n  A->>B: hi',
  class: 'classDiagram\n  Animal <|-- Dog',
  er: 'erDiagram\n  A ||--o{ B : has',
  xychart: 'xychart-beta\n  line [1, 2, 3]',
  architecture:
    'architecture-beta\n  service a(server)[A]\n  service b(server)[B]\n  a:R -- L:b',
  c4: 'C4Context\n  Person(u, "User")\n  System(s, "System")\n  Rel(u, s, "uses")',
}

describe.each(Object.entries(BODIES))('%s', (_type, body) => {
  it.each([false, true])('is unchanged by acc statements (ascii=%s)', (a) => {
    const [header, ...rest] = body.split('\n')
    const withAcc = [
      header,
      '  accTitle: A title',
      '  accDescr {',
      '    two',
      '    lines',
      '  }',
      ...rest,
    ].join('\n')
    const opts = { colorMode: 'none', useAscii: a } as const
    const out = renderMermaidASCII(withAcc, opts)
    expect(out).toBe(renderMermaidASCII(body, opts))
    expect(out).not.toContain('A title')
  })
})
