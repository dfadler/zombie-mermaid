import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseRadar } from '@zombie-mermaid/mermaid-parser'

// What mermaid 12.3.0's own radar parser and database make of each source in
// scripts/lib/radar-parser-sources.ts (scripts/radar-parser-fixture.ts).
const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/radar-parser-official-12.3.0.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { source: string; radar?: unknown; error?: true }>

describe('radar parser agreement with mermaid 12.3.0', () => {
  for (const [name, { source, radar, error }] of Object.entries(FIXTURE)) {
    it(name, () => {
      if (error) expect(() => parseRadar(source)).toThrow()
      else expect(parseRadar(source)).toEqual(radar)
    })
  }

  it('has accepted and rejected cases', () => {
    const cases = Object.values(FIXTURE)
    expect(cases.some((c) => c.error)).toBe(true)
    expect(cases.some((c) => !c.error)).toBe(true)
  })
})
