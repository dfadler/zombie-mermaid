// Renders layout-oracle's --scorecard-json output (schema 1) as Markdown on stdout:
// the per-type means table plus every sample that fell below its floor (#2037).
// Usage: node scripts/layout-oracle-report.mjs <scorecard.json>
// Exit 0 when the scorecard is readable and has no failing sample, 1 on a breach,
// 2 when it is missing or the schema is unknown.
import { readFileSync } from 'node:fs'

const file = process.argv[2]
let card
try {
  card = JSON.parse(readFileSync(file, 'utf8'))
} catch (err) {
  console.log(`Scorecard unreadable (${file}): ${err.message}`)
  process.exit(2)
}
if (card.schema !== 1) {
  console.log(`Unsupported scorecard schema ${card.schema} (expected 1).`)
  process.exit(2)
}

const pct = (n) => (n === null ? '-' : `${Math.round(n * 100)}%`)
const worst = (s) =>
  Math.min(
    ...[s.vertical, s.horizontal, s.containment].filter((n) => n !== null),
  )
const types = Object.entries(card.types)
const lines = [
  `mermaid ${card.mermaid}, tolerance ${card.tolerance}px, commit \`${String(card.commit).slice(0, 7)}\`, ${card.date}`,
  '',
  '| Type | Samples | Vertical | Horizontal | Containment | Failing | Errored |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...types.map(
    ([t, v]) =>
      `| ${t} | ${v.summary.samples} | ${pct(v.summary.vertical)} | ${pct(v.summary.horizontal)} | ${pct(v.summary.containment)} | ${v.failing} | ${v.errored.length} |`,
  ),
]
const failing = types.flatMap(([t, v]) =>
  v.samples.filter((s) => s.status === 'fail').map((s) => ({ t, ...s })),
)
if (failing.length) {
  lines.push(
    '',
    '### Below floor',
    '',
    '| Type | Sample | Worst | Floor |',
    '| --- | --- | ---: | ---: |',
  )
  for (const s of failing)
    lines.push(`| ${s.t} | ${s.title} | ${pct(worst(s))} | ${pct(s.floor)} |`)
}
const errored = types.flatMap(([t, v]) => v.errored.map((e) => `${t}: ${e}`))
if (errored.length)
  lines.push('', `Not scored (the oracle errored): ${errored.join(', ')}`)
console.log(lines.join('\n'))
process.exit(failing.length ? 1 : 0)
