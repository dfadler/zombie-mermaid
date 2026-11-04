// Fail when packages/<pkg>/src/** changed without a changeset naming that package (#2593).
// Logic: scripts/lib/changeset-coverage.ts. Run in CI after fetching origin/main.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { missingPackages } from './lib/changeset-coverage.ts'

const changed = execFileSync(
  'git',
  ['diff', '--name-only', 'origin/main...HEAD'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)

const pkgNames: Record<string, string> = {}
for (const dir of readdirSync('packages')) {
  const file = `packages/${dir}/package.json`
  if (!existsSync(file)) continue // e.g. packages/site is not a package
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  if (!pkg.private) pkgNames[dir] = pkg.name
}

const texts = changed
  .filter((f) => /^\.changeset\/(?!README).*\.md$/.test(f))
  .map((f) => readFileSync(f, 'utf8'))

const missing = missingPackages(changed, texts, pkgNames)
for (const name of missing)
  console.error(
    `error: ${name} source changed but no changeset in this PR names it (its CHANGELOG would omit the change). Add \`'${name}': patch\` to a changeset.`,
  )
process.exit(missing.length > 0 ? 1 : 0)
