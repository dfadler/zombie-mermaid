import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '__tests__/visual',
  testMatch: '**/*.visual.test.ts',
  fullyParallel: true,
  // Capped rather than left at Playwright's CPU-count default: running many
  // Chromium instances concurrently measurably increases screenshot noise
  // (CPU contention affecting font rasterization timing) — a 6-worker local
  // run spiked to 1042px of mismatch on an unchanged render, vs a 130px max
  // with a single worker. A small, fixed number keeps behavior consistent
  // between a many-core dev machine and a CI runner instead of scaling
  // (and re-introducing that noise) with whatever hardware happens to run it.
  workers: 2,
  retries: process.env.CI ? 2 : 0,
  // Mirrors the directory layout the suite used under Vitest's browser mode
  // (__screenshots__/<test file>/<name>-<project>-<platform>.png), so the
  // existing baseline tree just needs regenerating in place, not moving.
  snapshotDir: '__tests__/visual/__screenshots__',
  snapshotPathTemplate:
    '{snapshotDir}/{testFileName}/{arg}-{projectName}-{platform}{ext}',
  expect: {
    toHaveScreenshot: {
      // Font rasterization has genuine run-to-run jitter concentrated on
      // repeated text glyphs (confirmed by inspecting diff images: same
      // font/weight/color, a handful to a few hundred pixels of
      // antialiasing variance on text-dense samples). No single global
      // value cleanly separates that from every real regression — a full
      // color swap on a small, sparse diagram can produce *fewer* mismatched
      // pixels than ordinary noise on a large, text-dense one — so this is
      // tuned to pass reliably across repeated local runs (5 consecutive
      // clean runs at these values) while a sabotage test (swapping the
      // default text color) still failed 38 of the affected samples.
      // Structural/layout regressions, which move far more pixels than
      // either of those, are caught easily; retries (see above) cover the
      // residual tail of flakes this doesn't.
      threshold: 0.4,
      maxDiffPixelRatio: 0.002,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        headless: true,
        launchOptions: {
          // CI-only: a GitHub Actions Linux runner has no real GPU (headless
          // Chromium there falls back to SwiftShare software rendering
          // either way — confirmed via its own "drmGetDevices2() has not
          // found any devices" warning), so this only avoids GPU-sandbox-
          // related crashes/hangs several Playwright issues report on
          // GitHub-hosted Linux runners. On a dev machine with a real GPU,
          // forcing the same software path measurably increases screenshot
          // noise (~3-6x more mismatched pixels observed locally) since it
          // trades a consistent hardware-accelerated text rasterizer for a
          // less consistent software one — so it's CI-only, not blanket.
          args: process.env.CI ? ['--disable-gpu'] : [],
        },
      },
    },
  ],
})
