import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseUsecase } from '@zombie-mermaid/mermaid-parser'
import { USECASE_PARSER_SOURCES } from '../scripts/lib/usecase-parser-sources.ts'

// What mermaid 12.3.0's own usecase-beta parser and database make of each source in
// scripts/lib/usecase-parser-sources.ts (scripts/usecase-parser-fixture.ts).
const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/usecase-parser-official-12.3.0.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { source: string; usecase?: unknown; error?: true }>

// Syntax mermaid accepts that parseUsecase rejects with a "not supported yet" error.
const UNSUPPORTED = [
  'edge id',
  'circle',
  'cross',
  'stereotype',
  'metadata',
  'class suffix',
  'classdef',
  'json',
  'markdown',
]

describe('usecase parser agreement with mermaid 12.3.0', () => {
  for (const [name, { source, usecase, error }] of Object.entries(FIXTURE)) {
    it(name, () => {
      if (UNSUPPORTED.includes(name)) {
        expect(() => parseUsecase(source)).toThrow(/not supported yet/)
      } else if (error) expect(() => parseUsecase(source)).toThrow()
      else expect(parseUsecase(source)).toEqual(usecase)
    })
  }

  it('records every source in scripts/lib/usecase-parser-sources.ts', () => {
    // Re-run `pnpm run usecase:parser-fixture` after adding a source.
    expect(
      Object.fromEntries(
        Object.entries(FIXTURE).map(([name, c]) => [name, c.source]),
      ),
    ).toEqual(USECASE_PARSER_SOURCES)
  })

  it('has accepted and rejected cases', () => {
    const cases = Object.values(FIXTURE)
    expect(cases.some((c) => c.error)).toBe(true)
    expect(cases.some((c) => !c.error)).toBe(true)
  })
})
