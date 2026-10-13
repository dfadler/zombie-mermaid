/**
 * End-to-end golden test for `scripts/ascii-terminal-capture.sh` (#1608):
 * the real asciinema -> agg -> PNG path (and the ASCII_RASTERISER=chromium
 * path from #1286) on a tiny diagram. Headless - asciinema allocates its own
 * PTY, agg/Chromium draw no window - so it steals no focus.
 *
 * The .txt export is the golden (exact text the PTY showed); the PNG is only
 * checked as a non-trivial PNG, since pixels vary by font/host.
 *
 * Needs asciinema, agg, python3 + pillow (and Playwright Chromium for the
 * chromium case). Each case skips when its tools are absent, so the suite
 * stays green on runners without them; CI does not install them today, so
 * this currently runs locally only (no Docker needed: local agg is used).
 */
import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { chromium } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(REPO_ROOT, 'scripts/ascii-terminal-capture.sh')

const have = (cmd: string, args: string[] = ['--version']) =>
  spawnSync(cmd, args, { stdio: 'ignore' }).status === 0

const hasAgg =
  have('asciinema') && have('agg') && have('python3', ['-c', 'import PIL'])

const hasChromium = (() => {
  try {
    return spawnSync('test', ['-e', chromium.executablePath()]).status === 0
  } catch {
    return false
  }
})()

const GOLDEN = `┌───┐     ┌───┐
│   │     │   │
│ A ├────►│ B │
│   │     │   │
└───┘     └───┘`

const work = mkdtempSync(join(tmpdir(), 'ascii-capture-golden-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))
const sample = join(work, 'tiny.mmd')
writeFileSync(sample, 'graph LR\n  A --> B\n')

function capture(prefix: string, env: Record<string, string> = {}) {
  const out = join(work, prefix)
  const r = spawnSync(SCRIPT, ['./src/index.ts', sample, out], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 120_000,
  })
  expect(r.status, r.stderr).toBe(0)
  const png = readFileSync(`${out}.png`)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.length).toBeGreaterThan(500)
  return readFileSync(`${out}.txt`, 'utf8').trimEnd()
}

// A stand-in "base ref" whose renderer throws, laid out like a
// `git archive <ref> src packages tsconfig.json` extraction (src/index.ts plus
// its own tsconfig.json).
const throwingTree = join(work, 'throwing-ref')
mkdirSync(join(throwingTree, 'src'), { recursive: true })
// Extends the repo's own tsconfig so the runner's working-tree imports (display
// width, in --size mode) resolve their @zombie-mermaid/* paths as they would in
// a real extraction.
writeFileSync(
  join(throwingTree, 'tsconfig.json'),
  JSON.stringify({ extends: join(REPO_ROOT, 'tsconfig.json') }),
)
writeFileSync(
  join(throwingTree, 'src/index.ts'),
  "export function renderMermaidASCII(): string { throw new Error('boom: segment did not reach its endpoint') }\n",
)

function captureWith(
  indexModule: string,
  prefix: string,
  env: Record<string, string>,
) {
  return spawnSync(SCRIPT, [indexModule, sample, join(work, prefix)], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 120_000,
  })
}

describe('ascii-terminal-capture.sh throwing render', () => {
  const throwingIndex = join(throwingTree, 'src/index.ts')

  it.skipIf(!hasAgg)(
    'fails by default when the render throws',
    { timeout: 120_000 },
    () => {
      expect(captureWith(throwingIndex, 'throws-default', {}).status).toBe(1)
    },
  )

  it.skipIf(!hasAgg)(
    'ASCII_CAPTURE_EXPECT_THROW records the error line, without a stack trace',
    { timeout: 120_000 },
    () => {
      const r = captureWith(throwingIndex, 'throws-expected', {
        ASCII_CAPTURE_EXPECT_THROW: '1',
      })
      expect(r.status, r.stderr).toBe(0)
      const txt = readFileSync(join(work, 'throws-expected.txt'), 'utf8')
      expect(txt).toContain('Error: boom: segment did not reach its endpoint')
      expect(txt).not.toContain('    at ')
      const png = readFileSync(join(work, 'throws-expected.png'))
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    },
  )

  it.skipIf(!hasAgg)(
    'ASCII_CAPTURE_EXPECT_THROW refuses a render that does not throw',
    { timeout: 120_000 },
    () => {
      const r = captureWith('./src/index.ts', 'no-throw', {
        ASCII_CAPTURE_EXPECT_THROW: '1',
      })
      expect(r.status).toBe(1)
      expect(r.stderr).toContain('rendered fine')
    },
  )
})

describe('ascii-terminal-capture.sh golden', () => {
  it.skipIf(!hasAgg)('asciinema -> agg -> PNG', { timeout: 120_000 }, () => {
    expect(capture('agg')).toBe(GOLDEN)
  })

  it.skipIf(!hasAgg || !hasChromium)(
    'asciinema -> chromium -> PNG (ASCII_RASTERISER=chromium)',
    { timeout: 120_000 },
    () => {
      expect(capture('chr', { ASCII_RASTERISER: 'chromium' })).toBe(GOLDEN)
    },
  )
})
