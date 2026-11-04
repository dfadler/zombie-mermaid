// Fail when packages/<pkg>/src/** changed without a changeset naming that package (#2593).
// Thin CLI; logic and tests: scripts/lib/changeset-coverage.ts. Needs origin/main fetched.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { coverageErrors } from './lib/changeset-coverage.ts'

const git = ['diff', '--name-only', 'origin/main...HEAD']
const changed = execFileSync('git', git, { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
const read = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8') : undefined
const errors = coverageErrors(changed, readdirSync('packages'), read)
for (const e of errors) console.error(`error: ${e}`)
process.exit(errors.length > 0 ? 1 : 0)
