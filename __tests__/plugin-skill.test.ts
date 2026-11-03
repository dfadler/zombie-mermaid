import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  PLUGIN_CLI,
  syncPluginSkill,
  toPluginSkill,
} from '../scripts/lib/plugin-skill'

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
  it('qualifies "No install step" with the local-checkout npm ci caveat', () => {
    const out = toPluginSkill(SRC)
    expect(out).toContain('No install step when installed from the marketplace')
    expect(out).toContain('run `npm ci` in `plugins/claude`')
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

describe('syncPluginSkill', () => {
  const SRC_PATH = 'skills/zombie-mermaid/SKILL.md'
  const withDir = (fn: (dest: string) => void) => {
    const dir = mkdtempSync(join(tmpdir(), 'plugin-skill-'))
    try {
      fn(join(dir, 'nested', 'SKILL.md'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  it('write mode creates the dest; check then passes', () => {
    withDir((dest) => {
      expect(syncPluginSkill(SRC_PATH, dest, false)).toBe(0)
      expect(readFileSync(dest, 'utf8')).toBe(toPluginSkill(SRC))
      expect(syncPluginSkill(SRC_PATH, dest, true)).toBe(0)
    })
  })
  it('check fails when the dest is stale or missing', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      withDir((dest) => {
        expect(syncPluginSkill(SRC_PATH, dest, true)).toBe(1)
        syncPluginSkill(SRC_PATH, dest, false)
        writeFileSync(dest, 'stale')
        expect(syncPluginSkill(SRC_PATH, dest, true)).toBe(1)
        expect(err).toHaveBeenCalledWith(expect.stringContaining('out of date'))
      })
    } finally {
      err.mockRestore()
    }
  })
})
