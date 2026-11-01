import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PLUGIN_CLI, toPluginSkill } from '../scripts/lib/plugin-skill'

const SRC = readFileSync('skills/zombie-mermaid/SKILL.md', 'utf8')

describe('plugin skill copy (#2206)', () => {
  it('committed plugin copy is up to date (run: pnpm run sync:plugin-skill)', () => {
    expect(
      readFileSync('plugins/claude/skills/zombie-mermaid/SKILL.md', 'utf8'),
    ).toBe(toPluginSkill(SRC))
  })
  it('uses the pinned CLI and never npx', () => {
    const out = toPluginSkill(SRC)
    expect(out).toContain(`${PLUGIN_CLI} render diagram.mmd --ascii`)
    expect(out).not.toContain('npx')
  })
  it('fails loudly when the source drifts from the rewrite rules', () => {
    expect(() => toPluginSkill('npx -y zombie-mermaid render')).toThrow(
      /Prerequisites/,
    )
    expect(() =>
      toPluginSkill(SRC.replace('## Rendering over MCP', '## MCP')),
    ).toThrow(/MCP config/)
    expect(() => toPluginSkill(SRC + '\nnpx other-tool\n')).toThrow(/leftover/)
  })
})
