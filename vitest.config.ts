import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'src/__tests__/**/*.test.ts',
      'editor/__tests__/**/*.test.ts',
      '__tests__/**/*.test.ts',
    ],
    // The visual regression suite (__tests__/visual/) runs under
    // Playwright Test (`pnpm test:visual`, see playwright.config.ts), not
    // Vitest. It used to run in Vitest's browser mode, but that mode's
    // Node<->browser RPC layer has an unfixed bug (vitest-dev/vitest#10791,
    // still open even on the 5.0.0-rc line) that hangs CI runs forever with
    // no timeout — see #299. Playwright Test drives the browser entirely
    // from Node with no such bridge, so this class of hang can't occur.
    exclude: ['__tests__/visual/**'],
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
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // packages/*/src is the same library source, carved out of src/ by
      // zombie-mermaid#625 — it has to stay in the denominator or the
      // thresholds below would measure a strictly smaller file set than
      // they were calibrated against.
      include: ['src/**/*.ts', 'packages/*/src/**/*.ts'],
      exclude: ['src/__tests__/**'],
      thresholds: {
        statements: 88,
        branches: 77,
        functions: 93,
        lines: 90,
      },
    },
  },
})
