import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const ROOT = import.meta.dirname

export default defineConfig({
  // As of #769, the five `@zombie-mermaid/*` packages' package.json
  // `exports`/`types` point at their own *built* `dist/index.js`/
  // `.d.ts` — correct for a real published consumer, but Vite's default
  // resolver would then need every package built before a single test file
  // could even load (unlike `tsc`, which honors tsconfig.json's `paths`
  // override for the same specifiers regardless of package.json — see that
  // file's comment). These aliases keep the test suite doing what it always
  // did: running straight against live source, no build step required —
  // mirroring tsconfig.json's `paths` so both stay in sync by construction
  // rather than by two people remembering to update two files.
  resolve: {
    alias: {
      '@zombie-mermaid/core': resolve(ROOT, 'packages/core/src/index.ts'),
      '@zombie-mermaid/mermaid-parser': resolve(
        ROOT,
        'packages/mermaid-parser/src/index.ts',
      ),
      '@zombie-mermaid/svg-renderer': resolve(
        ROOT,
        'packages/svg-renderer/src/index.ts',
      ),
      '@zombie-mermaid/ascii-renderer': resolve(
        ROOT,
        'packages/ascii-renderer/src/index.ts',
      ),
      '@zombie-mermaid/mcp': resolve(ROOT, 'packages/mcp/src/index.ts'),
    },
  },
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
    environmentMatchGlobs: [['editor/__tests__/**', 'jsdom']],
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
