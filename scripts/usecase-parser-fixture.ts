/**
 * Writes __tests__/fixtures/usecase-parser-official-12.3.0.json (#2819): for each
 * source in scripts/lib/usecase-parser-sources.ts, what mermaid's own `usecase-beta`
 * parser and database make of it, so __tests__/usecase-parser-agreement.test.ts can
 * check `parseUsecase` against it. The database is read from real mermaid.js in
 * headless Chromium (the repo's pinned mermaid, or `MERMAID_DIST`).
 *
 * Usage: tsx scripts/usecase-parser-fixture.ts <output.json>
 * Needs Chromium (`pnpm exec playwright install chromium`).
 */
import { writeFileSync } from 'node:fs'
import { startRealMermaid } from './lib/real-mermaid.ts'
import { USECASE_PARSER_SOURCES } from './lib/usecase-parser-sources.ts'

const out = process.argv[2]
if (!out) {
  console.error('usage: tsx scripts/usecase-parser-fixture.ts <output.json>')
  process.exit(2)
}

// Runs in the page: mermaid's database, reduced to the fields our model keeps.
const READ = (source: string): string => `(async () => {
  try {
    const db = (await window.mermaid.mermaidAPI.getDiagramFromText(${JSON.stringify(source)})).db
    const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]))
    const arrows = ['forward', 'backward', 'none']
    return {
      direction: db.getDirection() === 'TD' ? 'TB' : db.getDirection(),
      actors: [...db.getActors().values()].map((a) => pick(a, ['id', 'label', 'parentId'])),
      useCases: [...db.getUseCases().values()].map((u) => pick(u, ['id', 'label', 'shape', 'parentId'])),
      boundaries: [...db.getSystemBoundaries().values()].map((b) => pick(b, ['id', 'label', 'members'])),
      relationships: db.getRelationships().map((r) => ({
        source: r.source, target: r.target, type: r.type,
        arrow: r.type === 'association' ? arrows[r.arrowType] ?? 'other' + r.arrowType : 'forward',
        ...(r.type === 'association' && r.label !== undefined ? { label: r.label } : {}),
      })),
      notes: [...db.getNotes().values()].map((x) => pick(x, ['target', 'label'])),
    }
  } catch (e) { return { error: true } }
})()`

const session = await startRealMermaid(process.env.MERMAID_DIST)
const fixture: Record<
  string,
  { source: string; usecase?: unknown; error?: true }
> = {}
try {
  for (const [name, source] of Object.entries(USECASE_PARSER_SOURCES)) {
    const r = (await session.page.evaluate(READ(source))) as {
      error?: true
    }
    fixture[name] = r.error ? { source, error: true } : { source, usecase: r }
  }
} finally {
  await session.close()
}
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n')
console.log(`wrote ${Object.keys(fixture).length} cases to ${out}`)
