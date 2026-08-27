// @ts-check
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    // Files that aren't part of the linted source surface for this repo:
    // build output, the generated static site, generated HTML demos, the
    // plain (non-TS) browser JS bundled into the editor UI, and standalone
    // data/config files that sit alongside the TS source but aren't part of
    // the library itself.
    ignores: [
      'dist/**',
      'node_modules/**',
      'site/**',
      'coverage/**',
      '**/*.html',
      'editor/**',
      'examples/**',
      'public/**',
      'samples-data.ts',
      'xychart-samples-data.ts',
      'tsup.config.ts',
    ],
  },
  {
    files: [
      'src/**/*.ts',
      'src/**/*.tsx',
      // The demo page's own client-side code. It used to be a template
      // literal inside index.ts, which no linter could see.
      'demo/**/*.ts',
      'editor.ts',
      'dev.ts',
      'index.ts',
      'bench.ts',
      'xychart-test.ts',
      'check-diff-coverage.ts',
    ],
    extends: [tseslint.configs.recommended],
    rules: {
      // Allow leading-underscore names to signal an intentionally unused
      // variable/argument (common pattern for destructuring or callback
      // signatures where not every value is needed).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Must be last: disables ESLint rules that conflict with Prettier's
  // formatting so the two tools never fight over the same concern.
  eslintConfigPrettier,
)
