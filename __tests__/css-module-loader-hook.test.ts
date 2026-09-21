/**
 * Guards `scripts/css-module-register.mjs`/`css-module-hooks.mjs`
 * (zombie-mermaid#1103) — the Node module customization hooks that let a
 * plain `import styles from './x.module.css'` resolve under `tsx`, without
 * changing how the site generators execute. See css-module-hooks.mjs's
 * header comment and #965's revised-plan comment for the full "why not a
 * runner swap" reasoning.
 *
 * A real child process, not an in-process import: the hooks are registered
 * via `node --import`/`NODE_OPTIONS`, which only takes effect for a
 * process's own module graph from startup — Vitest's own transform
 * pipeline runs this test file itself, so there's no way to exercise "does
 * a `.module.css` import resolve under a `tsx`-run script" without actually
 * spawning one. Exercises both invocation shapes this repo actually uses:
 * `package.json`'s scripts (`NODE_OPTIONS=... tsx <file>`, via the `tsx`
 * CLI bin) and vite.config.ts's dev-server re-exec (`node <tsx/cli path>
 * <file>`, with `NODE_OPTIONS` set on the spawn's `env` rather than passed
 * as an argv flag) — confirmed empirically while building the hook that
 * tsx's CLI re-execs a fresh child process to actually run the file, so an
 * `--import` argv flag given to the *outer* process doesn't survive that
 * re-exec the way an env var does.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const ENTRY = fileURLToPath(
  new URL('./fixtures/css-module-hook-entry.ts', import.meta.url),
)
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'))
// Not `import.meta.resolve('tsx')` — that resolves the package's `.` export
// (`dist/loader.mjs`), not the CLI binary `package.json` scripts actually
// invoke by name.
const TSX_BIN = join(REPO_ROOT, 'node_modules/.bin/tsx')
const NODE_OPTIONS = '--import ./scripts/css-module-register.mjs'

interface FixtureOutput {
  classes: Record<string, string>
  cssLength: number
  cardRuleIncluded: boolean
  tokensColorCount: number
}

function assertFixtureOutput(stdout: string): void {
  const lastLine = stdout.trim().split('\n').at(-1) ?? ''
  const parsed = JSON.parse(lastLine) as FixtureOutput

  // Unhashed: primitives.module.css is the one file this test's fixture
  // resolves through the hook, and while it's in `load-css-module.ts`'s
  // HASHED_MODULE_CSS_BASENAMES (zombie-mermaid#969), this hook applies its
  // own independent hashed/unhashed decision (see css-module-hooks.mjs's
  // header comment on why the two lists aren't shared) — its
  // HASHED_MODULE_CSS_BASENAMES also includes this file, so the assertion
  // below matches Lightning CSS's own `[local]_[hash]` pattern shape
  // instead of the old bridge's `<name>_<6 hex>` shape.
  for (const [name, output] of Object.entries(parsed.classes)) {
    expect(output.startsWith(`${name}_`)).toBe(true)
  }
  expect(parsed.cardRuleIncluded).toBe(true)
  expect(parsed.cssLength).toBeGreaterThan(0)
  // tokens.tsx (a plain .tsx import) resolving confirms tsx's own
  // TS-stripping still runs — the hook is chained in front of, not instead
  // of, tsx's own hook.
  expect(parsed.tokensColorCount).toBeGreaterThan(0)
}

describe('css-module loader hook', () => {
  it('resolves a .module.css import via the tsx CLI bin (package.json scripts’ invocation shape)', () => {
    const stdout = execFileSync(TSX_BIN, [ENTRY], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS },
    })
    assertFixtureOutput(stdout)
  })

  it('resolves a .module.css import via a direct tsx/cli spawn (vite.config.ts’s re-exec shape)', () => {
    const stdout = execFileSync(process.execPath, [TSX_CLI, ENTRY], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS },
    })
    assertFixtureOutput(stdout)
  })

  it('fails with ERR_UNKNOWN_FILE_EXTENSION without the hook registered (sanity check on the fixture itself)', () => {
    expect(() =>
      execFileSync(TSX_BIN, [ENTRY], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ).toThrowError(/ERR_UNKNOWN_FILE_EXTENSION/)
  })
})
