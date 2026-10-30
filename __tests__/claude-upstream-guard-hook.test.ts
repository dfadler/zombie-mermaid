/**
 * Behavior test for the PreToolUse Bash hook in `.claude/settings.json` that
 * blocks PRs and pushes aimed at the upstream fork-parent repo
 * (lukilabs/beautiful-mermaid) (#1608) and warns on non-owned remotes (#1611).
 * Runs the very command string from the settings file (which calls
 * scripts/remote-guard.sh) with a sample tool call on stdin, from a hermetic
 * temp git repo whose remotes are fake URLs (no network). Also pins the three
 * static deny rules that sit beside it.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

const repo = mkdtempSync(join(tmpdir(), 'remote-guard-'))
const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a])
if (hasJq) {
  git('init', '-q')
  git(
    'remote',
    'add',
    'origin',
    'https://github.com/dfadler/zombie-mermaid.git',
  )
  git(
    'remote',
    'add',
    'upstream',
    'https://github.com/lukilabs/beautiful-mermaid.git',
  )
  git('remote', 'add', 'other', 'git@github.com:someone/else.git')
}

function run(command: string, env: Record<string, string> = {}) {
  const out = execFileSync('sh', ['-c', hook], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
    cwd: repo,
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPO_ROOT, ...env },
  })
  return out ? JSON.parse(out).hookSpecificOutput : {}
}

/** The permissionDecision ('allow' when the hook printed no deny). */
function decide(command: string): string {
  return run(command).permissionDecision ?? 'allow'
}

const warning = (command: string, env?: Record<string, string>): string =>
  run(command, env).additionalContext ?? ''

describe.skipIf(!hasJq)('remote-guard PreToolUse hook', () => {
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

  it.each([
    'gh pr create --repo someone/else --title x', // planted: open a PR against a non-owned repo
    'gh pr create -R someone/else',
    'gh issue create --repo=someone/else --title x',
    'git push other main',
    'cd x && git push -u other main',
    'git push https://github.com/someone/else.git main',
    'git push git@github.com:someone/else.git main',
  ])('warns without denying: %s', (cmd) => {
    expect(decide(cmd)).toBe('allow')
    expect(warning(cmd)).toMatch(/remote-guard warning.*someone/s)
  })

  it.each([
    'gh pr create --fill',
    'gh pr create --repo dfadler/zombie-mermaid',
    'gh issue create --title x',
    'git push',
    'git push origin main',
    'git push --force-with-lease -u origin main',
    "gh pr create --repo 'DFadler/zombie-mermaid'",
    'gh pr list --repo someone/else',
    'git push nosuchremote main',
  ])('stays silent: %s', (cmd) => {
    expect(warning(cmd)).toBe('')
  })

  it('honours REMOTE_GUARD_OWNED', () => {
    expect(
      warning('git push other main', { REMOTE_GUARD_OWNED: 'Someone' }),
    ).toBe('')
  })

  it('prints usage for --help', () => {
    const out = execFileSync(
      join(REPO_ROOT, 'scripts/remote-guard.sh'),
      ['--help'],
      {
        encoding: 'utf8',
      },
    )
    expect(out).toContain('REMOTE_GUARD_OWNED')
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
