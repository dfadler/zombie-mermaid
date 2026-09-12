/**
 * Dev-only coverage check for demo/diagram-tags.ts's TAG_RULES (#991):
 * prints how many real samples-data.ts samples each rule matches, and
 * which ones, so a rule's regex can be eyeballed against real matches
 * before trusting it to generate a live page. Not part of the build —
 * pages.ts computes the same matches itself at generation time.
 *
 * Usage: tsx scripts/print-tag-coverage.ts
 */
import { samples } from '../site-src/samples-data.ts'
import { TAG_RULES } from '../demo/diagram-tags.ts'

for (const rule of TAG_RULES) {
  const matches = samples.filter((s) => rule.test(s))
  console.log(`\n${rule.slug} (${matches.length}):`)
  for (const m of matches) console.log(`  - [${m.category}] ${m.title}`)
}

const untagged = samples.filter(
  (s) =>
    s.category !== 'Hero' &&
    s.category !== 'Interactivity' &&
    !TAG_RULES.some((rule) => rule.test(s)),
)
console.log(`\nUntagged real samples (${untagged.length}):`)
for (const s of untagged) console.log(`  - [${s.category}] ${s.title}`)
