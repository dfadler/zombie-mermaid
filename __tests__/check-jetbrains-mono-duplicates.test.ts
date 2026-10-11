/**
 * Coverage for `scripts/check-jetbrains-mono-duplicates.sh` (issue #849): it
 * must flag a variable and a static install of the SAME JetBrains Mono family,
 * and nothing else. The original version counted any variable file next to any
 * static file, so a machine with the variable `JetBrains Mono` and the static
 * `JetBrains Mono NL` weights (a different family, no variable counterpart)
 * exited 1 although nothing clashed.
 *
 * Hermetic: the script scans the directories in `FONT_DIRS`, and
 * `UNAME_S_OVERRIDE` stands in for `uname -s`, so these tests build scratch
 * font directories of empty files and never look at the real font install.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(REPO_ROOT, 'scripts/check-jetbrains-mono-duplicates.sh')

const EXIT_OK = 0
const EXIT_FAILURE = 1
const EXIT_USAGE = 2

interface Result {
  code: number
  stdout: string
  stderr: string
}

async function run(
  args: string[],
  env: Record<string, string>,
): Promise<Result> {
  try {
    // /bin/bash, not whatever `bash` is first on PATH: on macOS that is bash
    // 3.2, the version the script has to survive (empty arrays are an error
    // under `set -u` there), and it exists on Linux CI too.
    const { stdout, stderr } = await execFileAsync(
      '/bin/bash',
      [SCRIPT, ...args],
      {
        env: { PATH: process.env['PATH'] ?? '', HOME: '/nonexistent', ...env },
      },
    )
    return { code: 0, stdout, stderr }
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string }
    return {
      code: e.code ?? -1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    }
  }
}

let fontDir: string

beforeEach(async () => {
  fontDir = await mkdtemp(join(tmpdir(), 'jbm-fonts-'))
})

afterEach(async () => {
  await rm(fontDir, { recursive: true, force: true })
})

async function install(...names: string[]): Promise<void> {
  for (const name of names) await writeFile(join(fontDir, name), '')
}

const check = (): Promise<Result> =>
  run([], { FONT_DIRS: fontDir, UNAME_S_OVERRIDE: 'Darwin' })

describe('check-jetbrains-mono-duplicates.sh', () => {
  it('flags a variable and a static install of the same family', async () => {
    await install('JetBrainsMono[wght].ttf', 'JetBrainsMono-Regular.ttf')
    const r = await check()
    expect(r.code).toBe(EXIT_FAILURE)
    expect(r.stderr).toContain('JetBrainsMono[wght].ttf')
    expect(r.stderr).toContain('JetBrainsMono-Regular.ttf')
  })

  it('does not flag a variable family next to a static install of a different family', async () => {
    // The real-world false positive: variable "JetBrains Mono" plus static
    // "JetBrains Mono NL" (no variable NL installed).
    await install(
      'JetBrainsMono[wght].ttf',
      'JetBrainsMono-Italic[wght].ttf',
      'JetBrainsMonoNL-Regular.ttf',
      'JetBrainsMonoNL-Bold.ttf',
    )
    const r = await check()
    expect(r.code).toBe(EXIT_OK)
  })

  it('counts a plain -Italic static file as a static install of its family', async () => {
    await install('JetBrainsMono[wght].ttf', 'JetBrainsMono-Italic.ttf')
    const r = await check()
    expect(r.code).toBe(EXIT_FAILURE)
    // Check the report, not just the exit code: the first version of this
    // script also exited 1 here, by crashing on an empty array under `set -u`.
    expect(r.stderr).toContain('found both a variable and static')
    expect(r.stderr).toContain('JetBrainsMono-Italic.ttf')
    expect(r.stderr).not.toContain('unbound variable')
  })

  it('warns about a file it cannot classify without failing or crashing', async () => {
    await install('JetBrainsMono[wght].ttf', 'JetBrainsMono-Mystery.ttf')
    const r = await check()
    expect(r.code).toBe(EXIT_OK)
    expect(r.stderr).toContain('could not classify')
    expect(r.stderr).toContain('JetBrainsMono-Mystery.ttf')
    expect(r.stderr).not.toContain('unbound variable')
  })

  it('names only the clashing family when another family is also installed', async () => {
    await install(
      'JetBrainsMono[wght].ttf',
      'JetBrainsMono-Bold.ttf',
      'JetBrainsMonoNL-Regular.ttf',
    )
    const r = await check()
    expect(r.code).toBe(EXIT_FAILURE)
    expect(r.stderr).toContain('JetBrainsMono-Bold.ttf')
    expect(r.stderr).not.toContain('JetBrainsMonoNL-Regular.ttf')
  })

  it('flags each family that clashes', async () => {
    await install('JetBrainsMonoNL[wght].ttf', 'JetBrainsMonoNL-Light.ttf')
    expect((await check()).code).toBe(EXIT_FAILURE)
  })

  it('accepts static fonts alone', async () => {
    await install('JetBrainsMono-Regular.ttf', 'JetBrainsMono-Bold.ttf')
    expect((await check()).code).toBe(EXIT_OK)
  })

  it('accepts a variable font alone', async () => {
    await install('JetBrainsMono[wght].ttf', 'JetBrainsMono-Italic[wght].ttf')
    expect((await check()).code).toBe(EXIT_OK)
  })

  it('accepts a machine with no JetBrains Mono at all', async () => {
    expect((await check()).code).toBe(EXIT_OK)
  })

  it('does nothing off macOS', async () => {
    await install('JetBrainsMono[wght].ttf', 'JetBrainsMono-Regular.ttf')
    const r = await run([], { FONT_DIRS: fontDir, UNAME_S_OVERRIDE: 'Linux' })
    expect(r.code).toBe(EXIT_OK)
    expect(r.stdout).toContain('not on macOS')
  })

  it('prints usage for --help', async () => {
    const r = await run(['--help'], {})
    expect(r.code).toBe(EXIT_OK)
    expect(r.stdout).toContain('Usage:')
  })

  it('rejects an unknown argument', async () => {
    const r = await run(['--bogus'], {})
    expect(r.code).toBe(EXIT_USAGE)
  })
})
