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

// #1744: an artifact must only replace the baseline in its own spec's directory,
// even when another spec has a same-named baseline.
const SCRIPT = resolve(__dirname, '../scripts/pull-linux-baselines.sh')
const tmps: string[] = []
afterEach(() => {
  while (tmps.length) rmSync(tmps.pop()!, { recursive: true, force: true })
})

function run(testDir: string) {
  const root = mkdtempSync(join(tmpdir(), 'pull-baselines-'))
  tmps.push(root)
  const repo = join(root, 'repo')
  const bin = join(root, 'bin')
  const shots = join(repo, '__tests__/visual/__screenshots__')
  mkdirSync(bin)
  mkdirSync(join(repo, 'scripts'), { recursive: true })
  copyFileSync(SCRIPT, join(repo, 'scripts/pull-linux-baselines.sh'))
  for (const spec of ['ascii', 'svg']) {
    const d = join(shots, `${spec}-samples.visual.test.ts`)
    mkdirSync(d, { recursive: true })
    writeFileSync(join(d, 'xy-chromium-linux.png'), 'old')
  }
  // Fake `gh run download ... -D <dir>`: drop a prepared artifact tree into <dir>.
  const gh = join(bin, 'gh')
  writeFileSync(
    gh,
    `#!/bin/sh
while [ $# -gt 0 ]; do [ "$1" = -D ] && d="$2"; shift; done
mkdir -p "$d/a/test-results/${testDir}"
echo new > "$d/a/test-results/${testDir}/xy-actual.png"
`,
  )
  chmodSync(gh, 0o755)
  spawnSync('git', ['init', '-q'], { cwd: repo })
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` }
  const r = spawnSync('bash', ['scripts/pull-linux-baselines.sh', '1'], {
    cwd: repo,
    env,
    encoding: 'utf8',
  })
  const read = (s: string) =>
    readFileSync(
      join(shots, `${s}-samples.visual.test.ts/xy-chromium-linux.png`),
      'utf8',
    ).trim()
  return { r, ascii: read('ascii'), svg: read('svg') }
}

describe('pull-linux-baselines.sh', () => {
  it('updates only the baseline in the matching spec dir', () => {
    const { r, ascii, svg } = run('ascii-samples.visual-xy-1a2b3-chromium')
    expect(r.status).toBe(0)
    expect({ ascii, svg }).toEqual({ ascii: 'new', svg: 'old' })
  })

  it('skips a test dir it cannot map instead of guessing', () => {
    const { r, ascii, svg } = run('mystery-test-chromium')
    expect(r.stderr).toContain('cannot map')
    expect({ ascii, svg }).toEqual({ ascii: 'old', svg: 'old' })
  })
})
