import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'src/__tests__/**/*.test.ts',
      'editor/__tests__/**/*.test.ts',
      '__tests__/**/*.test.ts',
    ],
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
