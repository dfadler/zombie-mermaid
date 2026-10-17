import { defineConfig } from '@playwright/test'

// Separate from playwright.config.ts on purpose: the visual suite pins a
// Docker image and screenshot baselines; the axe scan needs neither, so it
// runs in its own CI job (`axe` in .github/workflows/ci.yml) and `pnpm test:visual`
// never picks it up (that config's testMatch is *.visual.test.ts).
export default defineConfig({
  testDir: '__tests__/a11y',
  testMatch: '**/*.a11y.test.ts',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { headless: true } }],
})
