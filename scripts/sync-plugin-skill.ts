// Regenerate plugins/claude/skills/zombie-mermaid/SKILL.md from skills/ (#2206).
// `--check` exits 1 if the committed copy is stale. Run: pnpm run sync:plugin-skill
import { syncPluginSkill } from './lib/plugin-skill.ts'

process.exitCode = syncPluginSkill(
  'skills/zombie-mermaid/SKILL.md',
  'plugins/claude/skills/zombie-mermaid/SKILL.md',
  process.argv.includes('--check'),
)
