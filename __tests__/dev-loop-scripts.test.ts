import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPTS = resolve(__dirname, '../scripts')
const tmps: string[] = []
afterEach(() => {
  while (tmps.length) rmSync(tmps.pop()!, { recursive: true, force: true })
})

type Sandbox = { root: string; bin: string; log: string; repo: string }

function stub(dir: string, name: string, body: string) {
  const p = join(dir, name)
  writeFileSync(p, `#!/bin/sh\n${body}\n`)
  chmodSync(p, 0o755)
}

// Sandbox: a temp dir holding a copy of the scripts plus a bin dir of stubs.
function sandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'dev-loop-'))
  tmps.push(root)
  const bin = join(root, 'bin')
  mkdirSync(bin)
  mkdirSync(join(root, 'repo/scripts'), { recursive: true })
  for (const f of ['verify.sh', 'doctor.sh'])
    copyFileSync(join(SCRIPTS, f), join(root, 'repo/scripts', f))
  stub(
    join(root, 'repo/scripts'),
    'check-snapshot-allowlist.sh',
    `echo allowlist >> "${join(root, 'calls.log')}"`,
  )
  return { root, bin, log: join(root, 'calls.log'), repo: join(root, 'repo') }
}

function run(
  script: string,
  args: string[],
  sb: Sandbox,
  env: Record<string, string> = {},
) {
  const r = spawnSync('bash', [join(sb.repo, 'scripts', script), ...args], {
    cwd: sb.repo,
    encoding: 'utf8',
    env: { PATH: `${sb.bin}:/usr/bin:/bin`, HOME: sb.root, ...env },
  })
  let calls: string[] = []
  try {
    calls = readFileSync(sb.log, 'utf8').trim().split('\n').filter(Boolean)
  } catch {
    // No stub was called
  }
  return { code: r.status, out: r.stdout, err: r.stderr, calls }
}

function git(sb: Sandbox, ...a: string[]) {
  const r = spawnSync(
    '/usr/bin/git',
    ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a],
    {
      cwd: sb.repo,
      encoding: 'utf8',
    },
  )
  expect(r.status).toBe(0)
}

function verifySandbox(pnpmBody = '') {
  const sb = sandbox()
  stub(sb.bin, 'pnpm', `echo "$*" >> "${sb.log}"\n${pnpmBody}`)
  stub(sb.bin, 'git', 'exec /usr/bin/git "$@"')
  git(sb, 'init', '-q')
  writeFileSync(join(sb.repo, 'a.ts'), 'export {}\n')
  git(sb, 'add', '.')
  git(sb, 'commit', '-qm', 'base')
  return sb
}

describe('scripts/verify.sh', () => {
  it('prints usage for --help and rejects unknown args', () => {
    const sb = sandbox()
    const h = run('verify.sh', ['--help'], sb)
    expect(h.code).toBe(0)
    expect(h.out).toContain('Usage: pnpm run verify')
    const bad = run('verify.sh', ['--nope'], sb)
    expect(bad.code).toBe(2)
    expect(bad.err).toContain('Usage')
  })

  it('typechecks all three projects, lints only changed code files, then runs changed tests', () => {
    const sb = verifySandbox()
    writeFileSync(join(sb.repo, 'a.ts'), 'export const x = 1\n')
    const r = run('verify.sh', [], sb, { BASE: 'HEAD' })
    expect(r.code).toBe(0)
    for (const p of [
      'tsconfig.json',
      'demo/tsconfig.json',
      'editor/tsconfig.json',
    ])
      expect(
        r.calls.some((c) => c.startsWith(`exec tsc --noEmit -p ${p} `)),
      ).toBe(true)
    expect(r.calls).toContain(
      'exec oxlint --report-unused-disable-directives-severity=error a.ts',
    )
    expect(r.calls).toContain(
      'exec oxfmt --check --no-error-on-unmatched-pattern a.ts',
    )
    expect(r.calls).toContain(
      'exec vitest run -c config/vitest.config.ts --changed HEAD',
    )
  })

  it('skips oxlint and oxfmt when nothing changed', () => {
    const sb = verifySandbox()
    const r = run('verify.sh', [], sb, { BASE: 'HEAD' })
    expect(r.code).toBe(0)
    expect(
      r.calls.some((c) => c.includes('oxlint') || c.includes('oxfmt')),
    ).toBe(false)
    expect(r.calls.at(-1)).toContain('vitest run')
  })

  it('--full runs whole-repo lint, format check and coverage after typecheck', () => {
    const sb = verifySandbox()
    const r = run('verify.sh', ['--full'], sb)
    expect(r.code).toBe(0)
    expect(r.calls.slice(-3)).toEqual([
      'run lint',
      'run format:check',
      'run test:coverage',
    ])
    expect(r.calls.some((c) => c.includes('vitest'))).toBe(false)
  })

  it('runs the snapshot allow-list gate in the default path', () => {
    const r = run('verify.sh', [], verifySandbox(), { BASE: 'HEAD' })
    expect(r.calls).toContain('allowlist')
  })

  it('--ci-gates builds, regenerates API reports and checks bundle size, skipping full lint/coverage', () => {
    const r = run('verify.sh', ['--ci-gates'], verifySandbox(), {
      BASE: 'HEAD',
    })
    expect(r.code).toBe(0)
    const i = (c: string) => r.calls.indexOf(c)
    expect(i('run build')).toBeGreaterThan(-1)
    expect(i('run api:report')).toBeGreaterThan(i('run build'))
    expect(i('run check:bundle-size')).toBeGreaterThan(i('run api:report'))
    expect(r.calls).not.toContain('run test:coverage')
    expect(r.calls.at(-1)).toContain('vitest run')
  })

  it('--ci-gates fails when api:report leaves etc/api different from committed', () => {
    const sb = verifySandbox(
      'case "$*" in "run api:report") mkdir -p etc/api; echo x > etc/api/a.api.md;; esac',
    )
    const r = run('verify.sh', ['--ci-gates'], sb, { BASE: 'HEAD' })
    expect(r.code).toBe(1)
    expect(r.err).toContain('public API surface changed')
    expect(r.calls).not.toContain('run check:bundle-size')
  })

  it('--full includes the CI gates before lint', () => {
    const r = run('verify.sh', ['--full'], verifySandbox())
    expect(r.calls.indexOf('run check:bundle-size')).toBeGreaterThan(-1)
    expect(r.calls.indexOf('run check:bundle-size')).toBeLessThan(
      r.calls.indexOf('run lint'),
    )
  })

  it('warns up front, and again on failure, when Node is below 24', () => {
    const sb = verifySandbox('case "$*" in *demo/tsconfig*) exit 1;; esac')
    stub(sb.bin, 'node', 'case "$1" in -v) echo v22.1.0;; *) echo 22;; esac')
    const r = run('verify.sh', [], sb, { BASE: 'HEAD' })
    expect(r.code).toBe(1)
    const msg = 'Node v22.1.0 detected, repo needs >=24 (see .nvmrc)'
    expect(r.err.split(msg).length - 1).toBe(2)
    expect(r.err).toContain('CLI dispatch test files will fail')
  })

  it('stays quiet about Node on 24+', () => {
    const sb = verifySandbox()
    stub(sb.bin, 'node', 'echo 24')
    expect(run('verify.sh', [], sb, { BASE: 'HEAD' }).err).not.toContain(
      'detected',
    )
  })

  it('stops with exit 1 when any typecheck fails', () => {
    const sb = verifySandbox('case "$*" in *demo/tsconfig*) exit 1;; esac')
    const r = run('verify.sh', ['--full'], sb)
    expect(r.code).toBe(1)
    expect(r.err).toContain('typecheck failed')
    expect(r.calls.some((c) => c.startsWith('run '))).toBe(false)
  })
})

describe('scripts/doctor.sh', () => {
  function doctorSandbox(nodeMajor: string, tools: string[]) {
    const sb = sandbox()
    stub(
      sb.bin,
      'node',
      `case "$1" in -v) echo v${nodeMajor}.0.0;; *) echo ${nodeMajor};; esac`,
    )
    for (const t of tools)
      stub(sb.bin, t, t === 'pnpm' ? 'echo 10.0.0' : 'exit 0')
    return sb
  }

  it('prints usage for --help', () => {
    expect(run('doctor.sh', ['-h'], sandbox()).out).toContain(
      'Usage: pnpm run doctor',
    )
  })

  it('exits 0 when node>=24 and pnpm exist; missing extras are only optional', () => {
    const r = run('doctor.sh', [], doctorSandbox('24', ['pnpm', 'docker']))
    expect(r.code).toBe(0)
    expect(r.out).toContain('ok       node v24.0.0')
    expect(r.out).toContain('ok       pnpm 10.0.0')
    expect(r.out).toContain('ok       docker')
    expect(r.out).toContain('optional asciinema (not found)')
    expect(r.out).toContain('optional agg (not found)')
    expect(r.out).toContain('optional JetBrains Mono font')
    expect(r.out).toContain('optional playwright chromium')
  })

  it('exits 1 with MISSING when node is below 24', () => {
    const r = run('doctor.sh', [], doctorSandbox('22', ['pnpm']))
    expect(r.code).toBe(1)
    expect(r.out).toContain('MISSING  node >=24 (found v22.0.0)')
    expect(r.out).toContain('see .nvmrc')
  })

  it('exits 1 with MISSING when pnpm is absent', () => {
    const r = run('doctor.sh', [], doctorSandbox('24', []))
    expect(r.code).toBe(1)
    expect(r.out).toContain('MISSING  pnpm')
  })

  it('detects playwright chromium and JetBrains Mono when present', () => {
    const sb = doctorSandbox('24', ['pnpm'])
    stub(sb.bin, 'fc-list', 'echo "JetBrains Mono Regular"')
    mkdirSync(join(sb.root, 'pw/chromium-1'), { recursive: true })
    const r = run('doctor.sh', [], sb, {
      PLAYWRIGHT_BROWSERS_PATH: join(sb.root, 'pw'),
    })
    expect(r.out).toContain('ok       playwright chromium')
    expect(r.out).toContain('ok       JetBrains Mono font')
  })
})
