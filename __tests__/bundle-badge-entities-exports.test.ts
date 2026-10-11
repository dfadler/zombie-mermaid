/**
 * `scripts/generate-bundle-badge.ts` bundles `entities` with a hard-coded
 * export list (SVG_DEPS) instead of gzipping the whole build. If the SVG
 * renderer starts importing another `entities` export, the SVG and umbrella
 * badges silently undercount (issue #1379), so this pins the list to the
 * renderer's real imports.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'packages/svg-renderer/src')

function importedEntitiesExports(): string[] {
  const names = new Set<string>()
  const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  for (const f of files.filter((f) => /\.tsx?$/.test(f))) {
    const src = readFileSync(join(srcDir, f), 'utf8')
    for (const m of src.matchAll(
      /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]entities(?:\/[^'"]*)?['"]/g,
    )) {
      for (const spec of m[1]!.split(',')) {
        const name = spec.trim().split(/\s+as\s+/)[0]!
        if (name) names.add(name)
      }
    }
  }
  return [...names].sort()
}

function badgeScriptExports(): string[] {
  const src = readFileSync(
    join(root, 'scripts/generate-bundle-badge.ts'),
    'utf8',
  )
  const m = /specifier:\s*'entities',\s*exports:\s*\[([^\]]*)\]/.exec(src)
  expect(m, 'entities entry not found in SVG_DEPS').not.toBeNull()
  return [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!).sort()
}

describe('generate-bundle-badge entities export list', () => {
  it('matches the SVG renderer imports from entities', () => {
    const imported = importedEntitiesExports()
    expect(imported.length).toBeGreaterThan(0)
    expect(badgeScriptExports()).toEqual(imported)
  })
})
