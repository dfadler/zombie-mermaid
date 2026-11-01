// Regenerate plugins/claude/skills/zombie-mermaid/SKILL.md from skills/ (#2206).
// `--check` exits 1 if the committed copy is stale. Run: pnpm run sync:plugin-skill
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { toPluginSkill } from './lib/plugin-skill.ts'

const SRC = 'skills/zombie-mermaid/SKILL.md'
const DEST = 'plugins/claude/skills/zombie-mermaid/SKILL.md'
const want = toPluginSkill(readFileSync(SRC, 'utf8'))

if (process.argv.includes('--check')) {
  let have = ''
  try {
    have = readFileSync(DEST, 'utf8')
  } catch {}
  if (have !== want) {
    console.error(
      `error: ${DEST} is out of date; run: pnpm run sync:plugin-skill`,
    )
    process.exit(1)
  }
} else {
  mkdirSync(dirname(DEST), { recursive: true })
  writeFileSync(DEST, want)
}
