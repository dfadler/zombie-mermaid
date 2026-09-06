/**
 * Regression coverage for `scripts/ascii-render-runner.mjs --size`.
 *
 * The runner is a standalone `.mjs` script run in a real PTY by
 * `scripts/ascii-terminal-capture.sh` (see that script and the runner's own
 * header comment) — not a module of importable functions, so unlike
 * `check-diff-coverage.test.ts` / `generate-dashboard-data.test.ts` this
 * suite spawns it as a subprocess with `tsx`, the same way
 * `src/__tests__/cli-e2e.test.ts` spawns the built CLI. That's the only way
 * to exercise the actual `--size` code path the capture script relies on.
 *
 * Regression: `ASCII_RENDER_OPTIONS='{"hyperlinks":true}'` used to make
 * `--size` count the emitted OSC 8 escape bytes as visible graphemes,
 * overestimating `cols` (see PR #498 / CodeRabbit finding on this file).
 * The fix strips OSC 8 (and any stray SGR codes) before measuring, so a
 * hyperlink-enabled render must report the *same* size as the equivalent
 * plain render of the same diagram.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const TSX = join(REPO_ROOT, 'node_modules/.bin/tsx')
const RUNNER = join(REPO_ROOT, 'scripts/ascii-render-runner.mjs')
const INDEX_MODULE = join(REPO_ROOT, 'src/index.ts')

// A node with a `click` href so `hyperlinks: true` actually emits OSC 8
// sequences — an unlinked diagram would pass vacuously regardless of
// whether the strip fix is in place.
const LINKED_FLOWCHART = `graph LR
  A[Docs] --> B[Other]
  click A "https://example.com" "Docs"`

let fixturePath: string
let tmpDir: string

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'ascii-render-runner-size-'))
  fixturePath = join(tmpDir, 'linked.mmd')
  await writeFile(fixturePath, LINKED_FLOWCHART)
}, 30_000)

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

/** Runs `ascii-render-runner.mjs --size` and returns the parsed `cols rows`. */
async function measureSize(
  envOverrides: Record<string, string | undefined> = {},
): Promise<{ cols: number; rows: number }> {
  const { stdout } = await execFileAsync(
    TSX,
    [RUNNER, '--size', INDEX_MODULE, fixturePath],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...envOverrides },
    },
  )
  const [cols, rows] = stdout.trim().split(/\s+/).map(Number)
  if (cols === undefined || rows === undefined || Number.isNaN(cols)) {
    throw new Error(`unexpected --size output: ${JSON.stringify(stdout)}`)
  }
  return { cols, rows }
}

describe('ascii-render-runner.mjs --size', () => {
  it('reports the same size for a hyperlink-enabled render as the plain render', async () => {
    const plain = await measureSize({ ASCII_RENDER_OPTIONS: undefined })
    const linked = await measureSize({
      ASCII_RENDER_OPTIONS: '{"hyperlinks":true}',
    })

    // Same diagram, same layout — hyperlinks are zero-width on screen, so
    // the measured terminal footprint must be identical. Before the fix,
    // `linked.cols` was inflated by the raw OSC 8 escape byte count.
    expect(linked).toEqual(plain)
  }, 30_000)
})
