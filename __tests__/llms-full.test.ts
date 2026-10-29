import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { generateLlmsFull } from '../scripts/generate-llms-full'

it('public/llms-full.txt matches scripts/generate-llms-full.ts (run `pnpm run docs:llms` if this fails)', async () => {
  const committed = await readFile(
    new URL('../public/llms-full.txt', import.meta.url),
    'utf8',
  )
  const generated = await generateLlmsFull()
  expect(generated).toContain('/blob/main/docs/theming.md\n')
  expect(committed).toBe(generated)
})
