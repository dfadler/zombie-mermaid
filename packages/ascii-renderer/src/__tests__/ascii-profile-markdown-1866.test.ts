/**
 * Profile: 'markdown' (#1866) — plain, paste-safe ASCII. SVG n/a: the option
 * only affects ASCII output, so there is no SVG snapshot counterpart.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

// Goldens in testdata/markdown/*.txt, like the sibling ascii/ and unicode/ dirs.
const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'testdata',
  'markdown',
)

const FLOW =
  'graph LR\n  A[Start] -->|go| B{Ok?}\n  B --> C((End))\n  click A "https://example.com"'
const SAMPLES: Record<string, string> = {
  flowchart: FLOW,
  nonAscii: 'flowchart TD\n  A[日本語 café] --> B[😀 done]',
  sequence: 'sequenceDiagram\n  Alice->>Bob: hi\n  Bob-->>Alice: yo',
  class: 'classDiagram\n  Animal <|-- Dog\n  Animal : +name',
  er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
}
const NON_ASCII_LABEL = /[日本語é😀]/gu

afterEach(() => vi.unstubAllEnvs())

describe("profile: 'markdown'", () => {
  for (const [name, src] of Object.entries(SAMPLES)) {
    it(`${name}: ASCII-only, no escapes, even when color is forced`, () => {
      vi.stubEnv('FORCE_COLOR', '3')
      const out = renderMermaidASCII(src, { profile: 'markdown' })
      expect(out).not.toContain('\x1b')
      // Only label text may be non-ASCII; every border/arrow glyph is ASCII.
      expect(out.replace(NON_ASCII_LABEL, '')).toMatch(/^[\n\x20-\x7e]*$/)
      expect(out).toBe(readFileSync(join(GOLDEN_DIR, `${name}.txt`), 'utf-8'))
    })
  }

  it('equals the explicit-option spelling', () => {
    for (const src of Object.values(SAMPLES)) {
      expect(renderMermaidASCII(src, { profile: 'markdown' })).toBe(
        renderMermaidASCII(src, { useAscii: true, colorMode: 'none' }),
      )
    }
  })

  it('lets explicit options win', () => {
    expect(
      renderMermaidASCII(FLOW, { profile: 'markdown', useAscii: false }),
    ).toBe(renderMermaidASCII(FLOW, { useAscii: false, colorMode: 'none' }))
  })

  it('is a no-op when unset', () => {
    expect(renderMermaidASCII(FLOW, { colorMode: 'none' })).toBe(
      renderMermaidASCII(FLOW, { colorMode: 'none', profile: undefined }),
    )
  })
})
