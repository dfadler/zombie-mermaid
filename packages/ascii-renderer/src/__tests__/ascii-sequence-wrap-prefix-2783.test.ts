// Per-message `wrap:` / `nowrap:` prefixes (#2783) and mid-word splitting of
// over-long block label words (#2773), checked on mermaid@12.3.0.
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const L = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'

describe('sequence wrap:/nowrap: prefixes (#2783)', () => {
  it('wrap: wraps that message and note and is not drawn', () => {
    const out = renderMermaidASCII(
      `sequenceDiagram\n A->>B: wrap: ${L}\n B->>A: ${L}\n Note over A: wrap: ${L}`,
    )
    expect(out).not.toContain('wrap:')
    expect(out).toContain('alpha beta gamma delta')
    // The unprefixed message stays on one row
    expect(out.split('\n').some((r) => r.includes(L))).toBe(true)
  })

  it('nowrap: overrides init wrap:true', () => {
    const out = renderMermaidASCII(
      `%%{init: {"sequence": {"wrap": true}}}%%\nsequenceDiagram\n A->>B: nowrap: ${L}\n B->>A: ${L}`,
    )
    expect(out).not.toContain('nowrap')
    const rows = out.split('\n')
    expect(rows.filter((r) => r.includes(L))).toHaveLength(1)
  })
})

describe('note wrap prefixes (#2783)', () => {
  it('nowrap: keeps one note whole under init wrap, wrap: wraps one without it', () => {
    const rows = (src: string) => renderMermaidASCII(src).split('\n')
    const init = '%%{init: {"sequence": {"wrap": true}}}%%\n'
    const a = rows(
      `${init}sequenceDiagram\n A->>B: x\n Note over A: nowrap: ${L}\n Note over B: ${L}`,
    )
    expect(a.filter((r) => r.includes(L))).toHaveLength(1)
    const b = rows(
      `sequenceDiagram\n A->>B: x\n Note over A: ${L}\n Note over B: wrap: ${L}`,
    )
    expect(b.filter((r) => r.includes(L))).toHaveLength(1)
  })
})

describe('block label words wider than the frame split mid-word (#2773)', () => {
  it('breaks with a trailing hyphen like mermaid breakString', () => {
    const out = renderMermaidASCII(
      'sequenceDiagram\n participant A\n participant B\n alt Supercalifragilisticexpialidocious_and_pneumonoultramicroscopicsilicovolcanoconiosis\n A->>B: hi\n else Antidisestablishmentarianism_pneumonoultramicroscopicsilicovolcano\n B->>A: yo\n end',
    )
    expect(out).toContain('[Supercalifragilisticex-')
    expect(out).toContain('Antidisestablishmentar-')
    expect(out).toContain('ovolcanoconiosis]')
  })
})
