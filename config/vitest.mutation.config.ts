import base from './vitest.config.ts'

// Stryker's test config (#1862): only the suites that exercise the mutated
// files, so each mutant re-runs a handful of tests instead of the whole repo.
// Keep in step with `mutate` in stryker.config.json.
export default {
  ...base,
  test: {
    ...base.test,
    include: [
      'packages/mermaid-parser/src/__tests__/**/*.test.ts',
      'packages/ascii-renderer/src/__tests__/*pathfinder*.test.ts',
    ],
  },
}
