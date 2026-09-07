/**
 * Regression coverage for `scripts/ascii-terminal-capture.sh`'s
 * `ASCII_AGG_RUNTIME` option (issue #552): rasterizing the recorded `.cast`
 * through agg's own maintainer-published Docker image
 * (`ghcr.io/asciinema/agg`, which bundles JetBrains Mono directly - see
 * that image's Dockerfile - instead of relying on a local `agg` binary and
 * a correctly-installed host font) rather than the local `agg` binary.
 *
 * This suite only exercises the script's argument/dependency validation,
 * which runs before any real recording or rasterization - it doesn't spawn
 * `asciinema`, `agg`, or `docker` for real. That keeps it hermetic (no PTY,
 * no network, no Docker daemon required) per this repo's shell-test
 * conventions: external commands the script probes for with `command -v`
 * are shimmed via a scratch PATH entry rather than relying on the real
 * tools being installed in whatever environment runs `vitest`.
 *
 * The actual end-to-end rasterization - confirming a docker-mode render is
 * byte-identical to a correctly-configured local-agg render, and that a
 * deliberately font-incomplete render reproduces the documented notch
 * artifact - was verified manually against the real `ghcr.io/asciinema/agg`
 * image while implementing this (see the issue #552 write-up); that
 * verification needs a real Docker daemon and isn't something CI can
 * reasonably re-run on every commit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, chmod, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const SCRIPT = join(REPO_ROOT, 'scripts/ascii-terminal-capture.sh')

const EXIT_USAGE = 2
const EXIT_DEPENDENCY = 4

/** A minimal PATH entry providing no-op shims for the given command names,
 * so `command -v <name>` succeeds without needing the real tool installed.
 * Chained ahead of a plain system PATH (for coreutils/shell builtins the
 * script also needs: cd, dirname, basename, grep, cat). */
async function makeShimDir(names: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'agg-runtime-shims-'))
  for (const name of names) {
    const shimPath = join(dir, name)
    await writeFile(shimPath, '#!/bin/sh\nexit 0\n')
    await chmod(shimPath, 0o755)
  }
  return dir
}

/** Commands `scripts/ascii-terminal-capture.sh` needs just to *start
 * running*, independent of whichever dependency the current test means to
 * simulate as absent: `bash` itself (the script's `#!/usr/bin/env bash`
 * shebang means `env` has to resolve `bash` via PATH — without it the
 * script never even begins executing, failing with a generic "bash: No
 * such file or directory" rather than the script's own error handling),
 * plus the coreutils it shells out to directly (not just probes with
 * `command -v`): cat, grep, rm, dirname, basename, mkdir. A test that
 * needs to simulate a command being genuinely absent (see
 * `makeIsolatedPath` below) can't just append the real `/usr/bin:/bin` to
 * PATH for these, because GitHub Actions' hosted runners ship Docker
 * pre-installed with a running daemon — appending real system directories
 * would make a real `docker` resolve too, defeating the simulation. */
const REQUIRED_COREUTILS = [
  'bash',
  'cat',
  'grep',
  'rm',
  'dirname',
  'basename',
  'mkdir',
]

/** Builds a PATH entry containing no-op shims for `shimNames` (so
 * `command -v` succeeds for them without the real tool installed) plus
 * real symlinks to this machine's actual coreutils binaries (resolved via
 * `command -v` against the *ambient* PATH, not hardcoded to /usr/bin) —
 * and nothing else. Unlike `makeShimDir`, this is deliberately NOT chained
 * ahead of a plain system PATH: the whole point is that a command absent
 * from `shimNames` (e.g. `docker`) must be genuinely unresolvable, which a
 * fallback to real `/usr/bin:/bin` would silently undermine on any runner
 * that happens to have that command installed. */
async function makeIsolatedPath(shimNames: string[]): Promise<string> {
  const dir = await makeShimDir(shimNames)
  for (const name of REQUIRED_COREUTILS) {
    const { stdout } = await execFileAsync('command', ['-v', name], {
      shell: '/bin/sh',
    })
    const realPath = stdout.trim()
    if (realPath) {
      await symlink(realPath, join(dir, name))
    }
  }
  return dir
}

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

async function runScript(
  args: string[],
  env: Record<string, string | undefined>,
): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(SCRIPT, args, {
      env: { ...process.env, ...env },
    })
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

let shimDir: string
let isolatedDir: string

beforeAll(async () => {
  shimDir = await makeShimDir(['asciinema', 'python3'])
  isolatedDir = await makeIsolatedPath(['asciinema', 'python3'])
}, 30_000)

afterAll(async () => {
  await rm(shimDir, { recursive: true, force: true })
  await rm(isolatedDir, { recursive: true, force: true })
})

describe('ascii-terminal-capture.sh ASCII_AGG_RUNTIME', () => {
  it('--help documents ASCII_AGG_RUNTIME and the docker image it uses', async () => {
    const result = await runScript(['--help'], {})
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('ASCII_AGG_RUNTIME')
    expect(result.stdout).toContain('ghcr.io/asciinema/agg')
  })

  it('rejects an unrecognized ASCII_AGG_RUNTIME value before checking any dependency', async () => {
    // No PATH shims at all - if this validation ran after (or not before) a
    // dependency check, a bare "missing dependency" error would appear
    // instead of this usage message.
    const result = await runScript(
      ['./src/index.ts', '12', '/tmp/does-not-matter'],
      { ASCII_AGG_RUNTIME: 'podman', PATH: '/usr/bin:/bin' },
    )
    expect(result.code).toBe(EXIT_USAGE)
    expect(result.stderr).toContain("invalid ASCII_AGG_RUNTIME 'podman'")
  })

  it('ASCII_AGG_RUNTIME=docker requires docker, not a local agg binary', async () => {
    // Deliberately uses the fully isolated PATH, not `${shimDir}:/usr/bin:/bin`
    // like the other tests in this file: GitHub Actions' hosted runners ship
    // Docker pre-installed with a running daemon, so appending real
    // system directories here would make a real `docker` resolve and this
    // test would pass for the wrong reason — or rather, fail differently,
    // by falling through to the (also-real) `docker info` check, then into
    // the always-local asciinema-version probe, which errors on the fake
    // asciinema shim instead of ever reaching the "missing dependency:
    // docker" branch this test means to exercise.
    const result = await runScript(
      ['./src/index.ts', '12', '/tmp/does-not-matter'],
      {
        ASCII_AGG_RUNTIME: 'docker',
        PATH: isolatedDir,
      },
    )
    expect(result.code).toBe(EXIT_DEPENDENCY)
    expect(result.stderr).toContain('missing dependency: docker')
  })

  it('the default (local) runtime still requires a local agg binary, not docker', async () => {
    const result = await runScript(
      ['./src/index.ts', '12', '/tmp/does-not-matter'],
      {
        ASCII_AGG_RUNTIME: undefined,
        PATH: `${shimDir}:/usr/bin:/bin`,
      },
    )
    expect(result.code).toBe(EXIT_DEPENDENCY)
    expect(result.stderr).toContain('missing dependency: agg')
  })
})
