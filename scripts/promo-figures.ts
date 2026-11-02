// Prints the figures promotion drafts quote, so drafts cite this output instead of hand-copying (#2512).
// Run: pnpm exec tsx scripts/promo-figures.ts   (npm latest needs network; skip with --offline)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { forkFixes } from '../demo/fork-fixes-data.ts'

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  version: string
}
const readme =
  readFileSync('README.md', 'utf8').match(/\((\d+) fixes\)/)?.[1] ?? '?'
const upstream = forkFixes.filter((f) => f.upstreamIssues?.length).length
const npm = process.argv.includes('--offline')
  ? 'skipped (--offline)'
  : execFileSync('npm', ['view', 'zombie-mermaid', 'version'], {
      encoding: 'utf8',
    }).trim()

console.log(`package.json version:      ${pkg.version}`)
console.log(`npm latest:                ${npm}`)
console.log(`fixes (fork-fixes-data):   ${forkFixes.length}`)
console.log(`fixes (README):            ${readme}`)
console.log(
  `fixes with upstreamIssues: ${upstream}  <- the only valid "N reported upstream"`,
)
