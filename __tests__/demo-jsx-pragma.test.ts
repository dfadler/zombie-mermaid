/**
 * Guards the `/** @jsxRuntime automatic *\/` pragma every .tsx file under
 * demo/ must open with. The `tsx` CLI the site generators run under only
 * applies the repo-root tsconfig.json, and only to files its `include`
 * matches (src/**), so demo/tsconfig.json's `jsx: react-jsx` never reaches
 * these files at generation time — without the pragma esbuild falls back
 * to the classic runtime and the generator throws `React is not defined`.
 * See the `jsx` comment in demo/tsconfig.json.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const DEMO_DIR = fileURLToPath(new URL('../demo/', import.meta.url))
const PRAGMA = '/** @jsxRuntime automatic */'

describe('demo/**/*.tsx', () => {
  const tsxFiles = readdirSync(DEMO_DIR, {
    recursive: true,
    encoding: 'utf8',
  }).filter((file) => file.endsWith('.tsx'))

  it('finds the React components', () => {
    expect(tsxFiles).toContain(join('components', 'dashboard-page.tsx'))
  })

  it.each(tsxFiles)(
    '%s opens with the @jsxRuntime automatic pragma',
    (file) => {
      const firstLine = readFileSync(join(DEMO_DIR, file), 'utf8').split(
        '\n',
      )[0]
      expect(firstLine).toBe(PRAGMA)
    },
  )
})
