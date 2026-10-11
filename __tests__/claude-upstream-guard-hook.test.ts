/**
 * Behavior test for the PreToolUse Bash hook in `.claude/settings.json` that
 * blocks PRs and pushes aimed at the upstream fork-parent repo
 * (lukilabs/beautiful-mermaid) (#1608). The hook is inline jq/grep, so the
 * only way to test it is to run the very command string from the settings
 * file with a sample tool call on stdin - not a copy of it, which would rot.
 * Also pins the three static deny rules that sit beside it.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const settings = JSON.parse(
  readFileSync(join(REPO_ROOT, '.claude/settings.json'), 'utf8'),
)

const hook = settings.hooks.PreToolUse.find(
  (h: { matcher: string }) => h.matcher === 'Bash',
).hooks[0].command as string

const hasJq = spawnSync('jq', ['--version']).status === 0

/** Runs the real hook command; returns the permissionDecision ('allow' when it printed nothing). */
function decide(command: string): string {
  const out = execFileSync('sh', ['-c', hook], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
  })
  return out ? JSON.parse(out).hookSpecificOutput.permissionDecision : 'allow'
}

describe.skipIf(!hasJq)('upstream-guard PreToolUse hook', () => {
  it.each([
    'gh pr create --repo lukilabs/beautiful-mermaid --title x',
    'gh pr create --repo=lukilabs/beautiful-mermaid',
    'gh pr merge 5 --repo lukilabs/beautiful-mermaid',
    'gh pr ready 5 -R lukilabs/beautiful-mermaid',
    'gh api repos/lukilabs/beautiful-mermaid/pulls -f title=x',
    'GH PR CREATE --repo LukiLabs/Beautiful-Mermaid',
    'git push upstream main',
    'git push --force upstream main',
  ])('denies: %s', (cmd) => {
    expect(decide(cmd)).toBe('deny')
  })

  it.each([
    'gh pr create --repo dfadler/zombie-mermaid --title x',
    'gh pr create --fill',
    'gh pr view 5 --repo lukilabs/beautiful-mermaid',
    'gh issue list --repo lukilabs/beautiful-mermaid',
    'git fetch upstream',
    'git push origin main',
    'git push -u origin upstream-sync',
    'echo upstream',
    'ls',
  ])('allows: %s', (cmd) => {
    expect(decide(cmd)).toBe('allow')
  })

  it('allows an empty/missing command', () => {
    expect(decide('')).toBe('allow')
  })

  it('keeps the static deny rules for upstream PRs and pushes', () => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([
        'Bash(gh pr create --repo lukilabs/beautiful-mermaid*)',
        'Bash(gh pr create --repo=lukilabs/beautiful-mermaid*)',
        'Bash(git push upstream*)',
      ]),
    )
  })
})
