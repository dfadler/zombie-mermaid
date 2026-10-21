/**
 * Guards `compileModuleCss` (scripts/css-module-hooks.mjs, zombie-mermaid#1103)
 * failing loudly on CSS Modules surface it does not implement, instead of
 * silently producing an incomplete stylesheet or classes map.
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compileModuleCss } from '../scripts/css-module-hooks.mjs'

const fixture = (name: string) =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

describe('compileModuleCss', () => {
  it('compiles primitives.module.css to a classes map and stylesheet', async () => {
    const { css, classes } = await compileModuleCss(
      fileURLToPath(
        new URL('../demo/components/primitives.module.css', import.meta.url),
      ),
    )
    for (const [name, output] of Object.entries(classes)) {
      expect(output.startsWith(`${name}_`)).toBe(true)
    }
    expect(css).toContain(`.${classes.card} {`)
  })

  it('fails loudly on a file with an @import rule, instead of silently bundling nothing', async () => {
    await expect(
      compileModuleCss(fixture('css-module-import-fixture.module.css')),
    ).rejects.toThrowError(/'@import' is not supported/)
  })

  it('fails loudly on a file using composes:, instead of silently dropping the composed class', async () => {
    await expect(
      compileModuleCss(fixture('css-module-composes-fixture.module.css')),
    ).rejects.toThrowError(/'composes:' is not supported/)
  })
})
