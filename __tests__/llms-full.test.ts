import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  absolutizeLinks,
  generateLlmsFull,
  llmsFullInputs,
  touchesLlmsFullInputs,
  toLf,
} from '../scripts/lib/llms-full'

it('public/llms-full.txt matches scripts/generate-llms-full.ts (run `pnpm run docs:llms` if this fails)', async () => {
  const committed = toLf(
    await readFile(new URL('../public/llms-full.txt', import.meta.url), 'utf8'),
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

it('toLf turns CRLF checkouts into the LF text the generator emits', () => {
  expect(toLf('a\r\n\r\nb\r\n')).toBe('a\n\nb\n')
  expect(toLf('a\nb')).toBe('a\nb')
})

it('verify runs the drift check only when a generator input changed', async () => {
  const inputs = await llmsFullInputs()
  expect(inputs).toEqual(
    expect.arrayContaining([
      'public/llms.txt',
      'public/llms-full.txt',
      'scripts/lib/llms-full.ts',
      'docs/known-differences.md',
    ]),
  )
  expect(touchesLlmsFullInputs(['docs/known-differences.md'], inputs)).toBe(
    true,
  )
  expect(
    touchesLlmsFullInputs(['src/a.ts', 'scripts/lib/llms-full.ts'], inputs),
  ).toBe(true)
  expect(
    touchesLlmsFullInputs(['src/a.ts', 'docs/unlinked-draft.md'], inputs),
  ).toBe(false)
  expect(touchesLlmsFullInputs([], inputs)).toBe(false)
})

describe('scripts/check-llms-full.ts', () => {
  const run = async (argv: string[], stale = false) => {
    vi.resetModules()
    vi.doMock('node:fs/promises', async (orig) => {
      const real = await orig<typeof import('node:fs/promises')>()
      return {
        ...real,
        readFile: async (p: unknown, ...a: unknown[]) => {
          const text = await (
            real.readFile as (...x: unknown[]) => Promise<string>
          )(p, ...a)
          return stale && String(p).endsWith('llms-full.txt')
            ? `${text}drift`
            : text
        },
      }
    })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const argvSpy = vi
      .spyOn(process, 'argv', 'get')
      .mockReturnValue(['n', 's', ...argv])
    process.exitCode = undefined
    await import('../scripts/check-llms-full.ts')
    const result = {
      code: process.exitCode,
      msg: String(err.mock.calls[0]?.[0] ?? ''),
    }
    process.exitCode = undefined
    err.mockRestore()
    argvSpy.mockRestore()
    vi.doUnmock('node:fs/promises')
    return result
  }

  it('skips the comparison when no input changed', async () => {
    expect((await run(['src/a.ts'], true)).code).toBeUndefined()
  })
  it('passes when an input changed and the file is fresh', async () => {
    expect((await run(['docs/known-differences.md'])).code).toBeUndefined()
  })
  it('fails with the fix command when an input changed and the file is stale', async () => {
    const r = await run(['docs/known-differences.md'], true)
    expect(r.code).toBe(1)
    expect(r.msg).toContain('pnpm run docs:llms')
  })
})
