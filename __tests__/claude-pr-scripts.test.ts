/**
 * Behavior tests for `scripts/pre-pr-check.sh` and `scripts/pr-snapshot.sh`
 * (#1583). Hermetic: pre-pr-check runs against throwaway git repos (base
 * branch `main`, work on `feat`), and pr-snapshot runs with a stub `gh` first
 * on PATH, so neither touches the network or the real checkout.
 * Both are run under /bin/bash (macOS bash 3.2 is the floor, as in the other
 * shell-script tests). Needs git and jq, like the scripts themselves.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRE_PR = join(REPO_ROOT, 'scripts/pre-pr-check.sh')
const SNAPSHOT = join(REPO_ROOT, 'scripts/pr-snapshot.sh')

const has = (cmd: string) => spawnSync(cmd, ['--version']).status === 0
const available = has('git') && has('jq')

interface Result {
  code: number | null
  stdout: string
  stderr: string
}

function bash(
  script: string,
  args: string[],
  opts: { cwd?: string; input?: string; env?: Record<string, string> } = {},
): Result {
  const r = spawnSync('/bin/bash', [script, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    input: opts.input,
    encoding: 'utf8',
    env: {
      PATH: process.env['PATH'] ?? '',
      HOME: '/nonexistent',
      ...opts.env,
    },
  })
  return { code: r.status, stdout: r.stdout, stderr: r.stderr }
}

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pr-scripts-'))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

// --- pre-pr-check.sh -------------------------------------------------------

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.com',
}

function git(repo: string, ...args: string[]) {
  const r = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: { PATH: process.env['PATH'] ?? '', ...GIT_ENV },
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
}

/** A repo with an empty `main` and a `feat` branch carrying `files` in one commit. */
function makeRepo(files: Record<string, string>, subject = 'chore: x') {
  const repo = join(tmp, 'repo')
  mkdirSync(repo)
  git(repo, 'init', '-q', '-b', 'main')
  writeFileSync(join(repo, 'README'), 'base')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'base')
  git(repo, 'checkout', '-q', '-b', 'feat')
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true })
    writeFileSync(join(repo, path), content)
  }
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '--allow-empty', '-m', subject)
  return repo
}

const check = (repo: string, ...args: string[]) =>
  bash(PRE_PR, ['--base', 'main', ...args], { cwd: repo })

describe.skipIf(!available)('pre-pr-check.sh', () => {
  it('prints usage and exits 0 for --help', () => {
    const r = bash(PRE_PR, ['--help'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Usage: pre-pr-check.sh')
  })

  it('exits 2 on an unknown argument', () => {
    const r = bash(PRE_PR, ['--bogus'])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('unknown argument --bogus')
  })

  it('warns when published code changes without a changeset, and stays exit 0', () => {
    const repo = makeRepo({ 'packages/core/src/a.ts': 'export {}' })
    const r = check(repo)
    expect(r.code).toBe(0)
    expect(r.stderr).toContain('no .changeset/*.md is added')
  })

  it('exits 1 with --strict when there are warnings', () => {
    const repo = makeRepo({ 'src/a.ts': 'export {}' })
    expect(check(repo, '--strict').code).toBe(1)
  })

  it('is silent when code ships with a changeset', () => {
    const repo = makeRepo({
      'src/a.ts': 'export {}',
      '.changeset/x.md': '---\n---\n',
    })
    const r = check(repo, '--strict')
    expect(r.code).toBe(0)
    expect(r.stderr).toBe('')
  })

  it('does not count test files as published code', () => {
    const repo = makeRepo({ 'src/__tests__/a.test.ts': 'export {}' })
    expect(check(repo).stderr).toBe('')
  })

  it('accepts an empty changeset on a docs-only PR', () => {
    const repo = makeRepo({ '.changeset/x.md': '---\n---\n' })
    expect(check(repo).stderr).toBe('')
  })

  it('warns about a releasing changeset with no published code', () => {
    const repo = makeRepo({
      '.changeset/x.md': "---\n'zombie-mermaid': patch\n---\n\nx\n",
    })
    expect(check(repo).stderr).toContain('no published code')
  })

  it('warns when a decision doc changes', () => {
    const repo = makeRepo({ 'docs/decisions/d.md': '# d' })
    expect(check(repo).stderr).toContain('self-review checklist')
  })

  it('asks for a screenshot on ASCII paths, and accepts one in --body-file', () => {
    const repo = makeRepo({
      'packages/ascii-renderer/src/x.ts': 'x',
      '.changeset/x.md': '---\n---\n',
    })
    expect(check(repo).stderr).toContain('no screenshot')

    const body = join(tmp, 'body.md')
    writeFileSync(body, '![after](https://example.com/a.png)')
    expect(check(repo, '--body-file', body).stderr).not.toContain(
      'no screenshot',
    )

    writeFileSync(body, 'no image here')
    expect(check(repo, '--body-file', body).stderr).toContain('no screenshot')
  })

  it('flags a rendered-output fix without a fork-fixes entry', () => {
    const repo = makeRepo(
      {
        'packages/svg-renderer/src/a.ts': 'x',
        '.changeset/x.md': '---\n---\n',
      },
      'fix: edge label',
    )
    expect(check(repo).stderr).toContain('fork-fixes-data.ts is untouched')
  })

  it('does not flag the fork-fixes warning when the entry is present', () => {
    const repo = makeRepo(
      {
        'packages/svg-renderer/src/a.ts': 'x',
        'demo/fork-fixes-data.ts': 'x',
        '.changeset/x.md': '---\n---\n',
      },
      'fix: edge label',
    )
    expect(check(repo).stderr).toBe('')
  })

  it('stays quiet when the base ref does not exist', () => {
    const repo = makeRepo({ 'src/a.ts': 'x' })
    const r = bash(PRE_PR, ['--base', 'nope'], { cwd: repo })
    expect(r.code).toBe(0)
    expect(r.stderr).toBe('')
  })

  it('stays quiet when there is no diff', () => {
    const repo = makeRepo({})
    expect(check(repo).stderr).toBe('')
  })

  describe('--hook', () => {
    const payload = (command: string) =>
      JSON.stringify({ tool_input: { command } })

    it('ignores commands other than gh pr create', () => {
      const repo = makeRepo({ 'src/a.ts': 'x' })
      const r = check(repo, '--hook')
      // no stdin payload at all: still no output and exit 0
      expect(r.code).toBe(0)
      expect(r.stdout).toBe('')
      const r2 = bash(PRE_PR, ['--base', 'main', '--hook'], {
        cwd: repo,
        input: payload('git status'),
      })
      expect(r2.stdout).toBe('')
    })

    it('emits additionalContext JSON for gh pr create', () => {
      const repo = makeRepo({ 'src/a.ts': 'x' })
      const r = bash(PRE_PR, ['--base', 'main', '--hook'], {
        cwd: repo,
        input: payload('cd x && gh pr create --title t'),
      })
      expect(r.code).toBe(0)
      const out = JSON.parse(r.stdout)
      expect(out.hookSpecificOutput.hookEventName).toBe('PreToolUse')
      expect(out.hookSpecificOutput.additionalContext).toContain(
        'no .changeset/*.md',
      )
    })

    it('reads an image from the --body-file named in the command', () => {
      const repo = makeRepo({
        'packages/ascii-renderer/src/x.ts': 'x',
        '.changeset/x.md': '---\n---\n',
      })
      const body = join(tmp, 'pr-body.md')
      writeFileSync(body, '<img src="a.png">')
      const r = bash(PRE_PR, ['--base', 'main', '--hook'], {
        cwd: repo,
        input: payload(`gh pr create --body-file ${body}`),
      })
      expect(r.stdout).toBe('')
    })

    it('counts an inline --body image as a screenshot', () => {
      const repo = makeRepo({
        'packages/ascii-renderer/src/x.ts': 'x',
        '.changeset/x.md': '---\n---\n',
      })
      const r = bash(PRE_PR, ['--base', 'main', '--hook'], {
        cwd: repo,
        input: payload('gh pr create --body "![a](https://x/a.png)"'),
      })
      expect(r.stdout).toBe('')
    })
  })
})

// --- pr-snapshot.sh --------------------------------------------------------

/** A `gh` stub that answers the exact calls pr-snapshot.sh makes. */
function stubGhDir(): string {
  const dir = join(tmp, 'bin')
  mkdirSync(dir)
  const gh = join(dir, 'gh')
  writeFileSync(
    gh,
    `#!/bin/sh
case "$1 $2" in
  "pr view")
    case "$*" in
      *--jq*) echo 7 ;;
      *) echo '{"number":7,"title":"T","url":"u","headRefName":"h","baseRefName":"main","isDraft":false,"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","reviewDecision":"","files":[{"path":"a.ts"},{"path":"b.ts"}]}' ;;
    esac ;;
  "pr list") echo 7 ;;
  "pr checks") [ -n "$GH_STUB_CHECKS_FAIL" ] && exit 1; echo '[{"name":"ci","state":"SUCCESS","bucket":"pass","link":"l"}]' ;;
  "repo view") echo o/r ;;
  "api graphql") echo '{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{"id":"T1","isResolved":false,"path":"a.ts","line":3,"comments":{"nodes":[{"author":{"login":"bot"},"body":"fix"}]}},{"id":"T2","isResolved":true,"path":"b.ts","line":1,"comments":{"nodes":[]}}]},"comments":{"nodes":[{"author":{"login":"u"},"body":"hi"}]}}}}}' ;;
  *) echo "unexpected: $*" >&2; exit 9 ;;
esac
`,
  )
  chmodSync(gh, 0o755)
  return dir
}

describe.skipIf(!available)('pr-snapshot.sh', () => {
  it('prints usage and exits 0 for --help', () => {
    const r = bash(SNAPSHOT, ['--help'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Usage: pr-snapshot.sh')
  })

  it('exits 2 on an unknown flag and on more than one argument', () => {
    expect(bash(SNAPSHOT, ['--bogus']).code).toBe(2)
    const r = bash(SNAPSHOT, ['1', '2'])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('at most one PR argument')
  })

  it('exits 4 when gh is not on PATH', () => {
    const bare = join(tmp, 'bare')
    mkdirSync(bare)
    symlinkSync(
      spawnSync('which', ['basename'], { encoding: 'utf8' }).stdout.trim(),
      join(bare, 'basename'),
    )
    const r = bash(SNAPSHOT, [], { env: { PATH: bare } })
    expect(r.code).toBe(4)
    expect(r.stderr).toContain('gh not on PATH')
  })

  it('emits the snapshot shape for a named PR, keeping only unresolved threads', () => {
    const r = bash(SNAPSHOT, ['7'], {
      env: { PATH: `${stubGhDir()}:${process.env['PATH'] ?? ''}` },
    })
    expect(r.code).toBe(0)
    const [pr, ...rest] = JSON.parse(r.stdout)
    expect(rest).toEqual([])
    expect(pr.number).toBe(7)
    expect(pr.files).toEqual(['a.ts', 'b.ts'])
    expect(pr.checks).toEqual([
      { name: 'ci', state: 'SUCCESS', bucket: 'pass', link: 'l' },
    ])
    expect(pr.unresolvedThreads).toEqual([
      {
        id: 'T1',
        path: 'a.ts',
        line: 3,
        comments: [{ author: 'bot', body: 'fix' }],
      },
    ])
    expect(pr.generalComments).toEqual([{ author: 'u', body: 'hi' }])
  })

  it('lists your open PRs when given no argument, and tolerates failing checks', () => {
    const r = bash(SNAPSHOT, [], {
      env: {
        PATH: `${stubGhDir()}:${process.env['PATH'] ?? ''}`,
        GH_STUB_CHECKS_FAIL: '1',
      },
    })
    expect(r.code).toBe(0)
    const prs = JSON.parse(r.stdout)
    expect(prs).toHaveLength(1)
    expect(prs[0].checks).toEqual([])
  })
})
