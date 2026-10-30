import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { mobileMenuScript } from '../demo/components/mobile-menu-script-plugin.ts'

// This file lives in config/, one level below the repo root (#997) —
// REPO_ROOT points at the actual root. `setupFiles` below is a separate case: Vitest
// resolves that path against the *run's* root (repo root, since scripts
// invoke `vitest -c config/vitest.config.ts` from there), not against this
// config file's own directory — so it's spelled `./config/vitest.setup.ts`
// rather than a `REPO_ROOT`-relative sibling reference.
const REPO_ROOT = resolve(import.meta.dirname, '..')

export default defineConfig({
  plugins: [mobileMenuScript()],
  // As of #769, the five `@zombie-mermaid/*` packages' package.json
  // `exports`/`types` point at their own *built* `dist/index.js`/
  // `.d.ts` — correct for a real published consumer, but Vite's default
  // resolver would then need every package built before a single test file
  // could even load (unlike `tsc`, which honors tsconfig.json's `paths`
  // override for the same specifiers regardless of package.json — see that
  // file's comment). `resolve.tsconfigPaths` keeps the test suite running straight
  // against live source, no build step required, reading tsconfig.json's
  // `paths` directly (one source of truth). Files outside the root tsconfig's
  // `include` get the mapping from the nested tsconfig.json files (#1836).
  resolve: { tsconfigPaths: true },
  test: {
    include: [
      'src/__tests__/**/*.test.ts',
      'editor/__tests__/**/*.test.ts',
      '__tests__/**/*.test.ts',
      'packages/*/src/__tests__/**/*.test.ts',
      'packages/*/__tests__/**/*.test.ts',
    ],
    // The visual regression suite (__tests__/visual/) runs under
    // Playwright Test (`pnpm test:visual`, see playwright.config.ts), not
    // Vitest. It used to run in Vitest's browser mode, but that mode's
    // Node<->browser RPC layer has an unfixed bug (vitest-dev/vitest#10791,
    // still open even on the 5.0.0-rc line) that hangs CI runs forever with
    // no timeout — see #299. Playwright Test drives the browser entirely
    // from Node with no such bridge, so this class of hang can't occur.
    // __tests__/a11y/ is the axe scan, also Playwright (`pnpm test:a11y`).
    exclude: ['__tests__/visual/**', '__tests__/a11y/**'],
    // Per-file `// @vitest-environment jsdom` docblocks (see
    // __tests__/dom/rtl-example.test.ts), not a directory glob, scope which
    // tests get a live DOM -- added by zombie-mermaid#798 as the #797
    // hydration epic's testing infra.
    //
    // This config used to declare `environmentMatchGlobs: [['editor/
    // __tests__/**', 'jsdom']]`, but that option does not exist anywhere in
    // vitest@4.1.11's source (verified: zero matches across
    // node_modules/vitest/dist) -- it was silently a no-op. That went
    // unnoticed because editor/__tests__/**'s own tests never actually
    // relied on the *ambient* jsdom environment this option would have
    // provided: editor/__tests__/support/harness.ts constructs its own
    // `new JSDOM(...)` instance per test and reads/writes `env.window`/
    // `env.document` explicitly, entirely independent of whatever
    // environment Vitest itself runs the test file under. React Testing
    // Library's `render()` has no such per-call escape hatch -- it always
    // targets the ambient `document` global -- so RTL tests genuinely need
    // a working mechanism, which is what surfaced this.
    //
    // Per-file docblocks (rather than reinstating an
    // environmentMatchGlobs-shaped directory glob via `test.projects`, the
    // structurally-closest modern replacement) were chosen to keep this a
    // single Vitest project: `projects` splits coverage/threshold
    // accounting across projects in ways that would need re-validating
    // against this file's existing thresholds below, for a repo that (as of
    // this issue) has exactly one directory's worth of jsdom-dependent
    // tests. The *global* default test environment stays 'node' either
    // way -- most of `__tests__/**` are plain Node unit tests (string/
    // attribute assertions against `renderToStaticMarkup` output, data-shape
    // checks, etc.) with no reason to pay jsdom's setup cost. New
    // hydrated-component tests live under `__tests__/dom/` by convention
    // (for discoverability -- grep-ability, not enforcement) and each such
    // file must open with `// @vitest-environment jsdom` as its first line;
    // omitting it fails loudly (`document is not defined`) rather than
    // silently passing under the wrong environment.
    setupFiles: ['./config/vitest.setup.ts'],
    // 20 s instead of the 5 s default (#1825). Under a full run (~12 workers,
    // `pnpm run verify --full`) sub-second tests such as ascii-html-mockup-parity
    // and ascii-label-attribution stretch past 5 s, and a different 2-4 tests
    // time out each run. Per-test timeouts would be whack-a-mole; a test that
    // genuinely hangs still fails, just 15 s later. Slow tests keep their own.
    testTimeout: 20_000,
    // CI-only (#1838); local runs keep the default reporter and no retry.
    // - `github-actions`: annotations plus the job summary written to
    //   $GITHUB_STEP_SUMMARY, which lists every test that passed only after
    //   a retry under "Flaky Tests". A custom `reporters` list drops the
    //   reporter Vitest otherwise auto-adds, so it is named explicitly.
    //   https://vitest.dev/guide/reporters#github-actions-reporter
    // - `junit`: machine-readable report, uploaded as an artifact by ci.yml.
    //   https://vitest.dev/guide/reporters#junit-reporter
    // - `retry: 1` retries a failing test once. It must not hide flakes: a
    //   test that needed it is surfaced in the summary above and is a bug to
    //   file (CONTRIBUTING.md, "Flaky tests"; #1825).
    //   https://vitest.dev/config/retry
    // `html` is omitted: it needs @vitest/ui, which this repo does not depend on.
    ...(process.env.CI
      ? {
          reporters: [
            'default',
            'github-actions',
            ['junit', { outputFile: 'test-results/junit.xml' }],
          ],
          retry: 1,
        }
      : {}),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // packages/*/src is the same library source, carved out of src/ by
      // zombie-mermaid#625 — it has to stay in the denominator or the
      // thresholds below would measure a strictly smaller file set than
      // they were calibrated against.
      include: ['src/**/*.ts', 'packages/*/src/**/*.ts', 'scripts/**/*.ts'],
      // scripts/ is gated by check-diff-coverage.ts too; run-on-import CLI entry
      // points can't be covered in-process, so they're listed (with a reason)
      // in scripts/coverage-exempt.json and kept out of the denominator.
      exclude: [
        'src/__tests__/**',
        'packages/*/src/__tests__/**',
        ...(
          JSON.parse(
            readFileSync(
              resolve(REPO_ROOT, 'scripts/coverage-exempt.json'),
              'utf8',
            ),
          ) as { file: string }[]
        ).map((e) => e.file),
      ],
      thresholds: {
        statements: 88,
        branches: 77,
        functions: 93,
        lines: 90,
      },
    },
  },
})
