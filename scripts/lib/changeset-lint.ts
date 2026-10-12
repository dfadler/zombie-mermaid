/**
 * Lint for `.changeset/*.md` (#1756), per the versioning policy
 * (docs/decisions/versioning-and-deprecation-policy-1568.md, section 5):
 * a `major` bump needs a summary starting with `**BREAKING:**` that links the
 * upgrade guide. Warnings are advisory; only errors fail `pnpm run check:changesets`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface LintResult {
  file: string
  errors: string[]
  warnings: string[]
}

const BUMP_LINE = /^\s*['"]?[^'":]+['"]?\s*:\s*(major|minor|patch)\s*$/gm

/** Lint one changeset's text. `file` is only used to label the result. */
export function lintChangeset(file: string, text: string): LintResult {
  const result: LintResult = { file, errors: [], warnings: [] }
  const m = /^---\r?\n([\s\S]*?)\r?\n?---\r?\n?([\s\S]*)$/.exec(text)
  if (!m) return result
  const bumps = new Set([...m[1]!.matchAll(BUMP_LINE)].map((b) => b[1]))
  const summary = m[2]!.trim()
  const breaking = summary.startsWith('**BREAKING:**')
  if (bumps.has('major')) {
    if (!breaking)
      result.errors.push(
        'a `major` bump needs a summary starting with `**BREAKING:**`',
      )
    if (!/docs\/guides\/upgrading[^\s)]*/.test(summary))
      result.warnings.push(
        'a major summary should link its upgrade-guide section (docs/guides/upgrading-*.md#...)',
      )
    if (/Output change/i.test(summary))
      result.warnings.push(
        '"Output change" on a major: output changes are minor/patch unless a documented contract changes',
      )
  } else if (
    bumps.has('minor') &&
    !breaking &&
    /\b(engines|peerDependencies)\b/.test(summary)
  ) {
    result.warnings.push(
      'a minor summary mentions engines/peerDependencies: if consumers can break, this is a major',
    )
  }
  return result
}

/** Lint every changeset in `dir` (README.md excluded); results with findings only. */
export function lintChangesetDir(dir: string): LintResult[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => lintChangeset(f, readFileSync(join(dir, f), 'utf8')))
    .filter((r) => r.errors.length > 0 || r.warnings.length > 0)
}
