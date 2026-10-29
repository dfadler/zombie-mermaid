import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { absolutizeLinks, generateLlmsFull } from '../scripts/lib/llms-full'

it('public/llms-full.txt matches scripts/generate-llms-full.ts (run `pnpm run docs:llms` if this fails)', async () => {
  const committed = await readFile(
    new URL('../public/llms-full.txt', import.meta.url),
    'utf8',
  )
  const generated = await generateLlmsFull()
  expect(generated).toContain('/blob/main/docs/theming.md\n')
  expect(committed).toBe(generated)
})

it('absolutizes relative links against the source doc, leaving absolute and anchor links alone', () => {
  const base = 'https://github.com/dfadler/zombie-mermaid/blob/main/'
  expect(
    absolutizeLinks(
      '[a](development-scripts.md) [b](../README.md#x) [c](https://x.dev/y) [d](#top) [e](mailto:a@b.c)',
      'docs/README.md',
    ),
  ).toBe(
    `[a](${base}docs/development-scripts.md) [b](${base}README.md#x) [c](https://x.dev/y) [d](#top) [e](mailto:a@b.c)`,
  )
})
