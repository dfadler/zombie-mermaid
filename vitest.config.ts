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
        statements: 75,
        branches: 62,
        functions: 81,
        lines: 77,
      },
    },
  },
})
