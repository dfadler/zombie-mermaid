import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    // Two projects, run independently (`pnpm test` vs `pnpm test:visual`):
    //   - unit: the existing node/jsdom suite, unchanged.
    //   - visual: renders every sample from samples-data.ts /
    //     xychart-samples-data.ts in a real Chromium tab (SVG in the
    //     browser, ASCII inside the demo's terminal-panel chrome) and
    //     screenshot-diffs it. Kept separate per Vitest's own guidance —
    //     a flaky/slow render shouldn't block the fast unit loop, and
    //     browser mode needs Chromium installed (`pnpm exec playwright
    //     install chromium`), which most local/CI runs of `pnpm test`
    //     shouldn't be forced to pay for.
    projects: [
      {
        test: {
          name: 'unit',
          include: [
            'src/__tests__/**/*.test.ts',
            'editor/__tests__/**/*.test.ts',
            '__tests__/**/*.test.ts',
          ],
          exclude: ['__tests__/visual/**'],
          environmentMatchGlobs: [['editor/__tests__/**', 'jsdom']],
        },
      },
      {
        test: {
          name: 'visual',
          include: ['__tests__/visual/**/*.visual.test.ts'],
          // Above Vitest's 5000ms default: the first mount in each test
          // file waits (capped at 8s) for the demo stylesheet's Google
          // Fonts @import to finish, so a screenshot isn't taken mid
          // fallback-to-webfont swap. A CI runner with a slow path to that
          // CDN was otherwise hitting the default timeout on every single
          // test (see FONT_WAIT_TIMEOUT_MS in helpers/mount.ts).
          testTimeout: 15000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            expect: {
              toMatchScreenshot: {
                comparatorName: 'pixelmatch',
                // Text-glyph antialiasing varies a pixel or two at edges
                // between otherwise-identical runs; every sample here
                // renders text labels, so some slack is needed to avoid
                // flaking on font rendering rather than an actual
                // regression. A real layout/color regression moves far
                // more than this.
                comparatorOptions: {
                  threshold: 0.4,
                  allowedMismatchedPixelRatio: 0.0005,
                },
              },
            },
          },
        },
      },
    ],
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
