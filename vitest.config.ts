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
    environmentMatchGlobs: [['editor/__tests__/**', 'jsdom']],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
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
