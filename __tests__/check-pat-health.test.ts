import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/check-pat-health.sh (#2448) against stubbed curl/gh: no live tokens.
const SECRET = 'ghp_SUPERSECRETVALUE'

function run(
  code: number,
  header: string | null,
  extra: Record<string, string> = {},
) {
  const dir = mkdtempSync(join(tmpdir(), 'pat-health-'))
  const log = join(dir, 'gh.log')
  const stub = (n: string, body: string) => {
    writeFileSync(join(dir, n), `#!/usr/bin/env bash\n${body}\n`)
    chmodSync(join(dir, n), 0o755)
  }
  // Curl stub: write the header file named after -D, print the status code.
  stub(
    'curl',
    `while [ $# -gt 0 ]; do [ "$1" = -D ] && h="$2"; shift; done
printf 'HTTP/2 ${code}\\r\\n${header ? `GitHub-Authentication-Token-Expiration: ${header}\\r\\n` : ''}' > "$h"
printf ${code}`,
  )
  stub(
    'gh',
    `echo "$@" >> "${log}"\n[ "$2" = list ] && echo "\${GH_LIST:-}"; exit 0`,
  )
  const r = spawnSync('bash', ['scripts/check-pat-health.sh', 'FAKE_PAT'], {
    encoding: 'utf8',
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      PAT: SECRET,
      GH_TOKEN: 'x',
      GITHUB_REPOSITORY: 'o/r',
      ...extra,
    },
  })
  let calls = ''
  try {
    calls = readFileSync(log, 'utf8')
  } catch {
    // No gh call made
  }
  return { r, calls, out: r.stdout + r.stderr }
}

const fmt = (days: number) =>
  new Date(Date.now() + days * 86400_000 + 3600_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19) + ' UTC'

describe('scripts/check-pat-health.sh', () => {
  it('stays quiet for a PAT far from expiry', () => {
    const { r, calls, out } = run(200, fmt(60))
    expect(r.status).toBe(0)
    expect(calls).toBe('')
    expect(out).not.toContain(SECRET)
  })
  it('stays quiet for a non-expiring PAT (no header)', () => {
    const { r, calls } = run(200, null)
    expect(r.status).toBe(0)
    expect(calls).toBe('')
  })
  it('opens an issue within the warning window', () => {
    const { r, calls } = run(200, fmt(5))
    expect(r.status).toBe(0)
    expect(calls).toContain('issue create')
    expect(calls).toContain('FAKE_PAT needs attention')
  })
  it('comments on the existing issue instead of duplicating', () => {
    const { calls } = run(200, fmt(5), { GH_LIST: '42' })
    expect(calls).toContain('issue comment 42')
    expect(calls).not.toContain('issue create')
  })
  it('alerts on a rejected PAT without leaking it', () => {
    const { calls, out } = run(401, null)
    expect(calls).toContain('issue create')
    expect(out).toContain('rejected')
    expect(out).not.toContain(SECRET)
  })
  it('skips when the secret is unset', () => {
    const { r, calls } = run(200, fmt(1), { PAT: '' })
    expect(r.status).toBe(0)
    expect(calls).toBe('')
  })
})
