// Lint .changeset/*.md for the **BREAKING:** convention (#1756). Logic: scripts/lib/changeset-lint.ts
import { lintChangesetDir } from './lib/changeset-lint.ts'

const results = lintChangesetDir('.changeset')
for (const r of results) {
  for (const e of r.errors) console.error(`error: .changeset/${r.file}: ${e}`)
  for (const w of r.warnings)
    console.warn(`warning: .changeset/${r.file}: ${w}`)
}
process.exit(results.some((r) => r.errors.length > 0) ? 1 : 0)
