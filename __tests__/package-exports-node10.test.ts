import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// #1986: legacy `moduleResolution: node` ignores `exports`, so every subpath
// export needs a matching `typesVersions` entry or its types don't resolve.
const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)

describe('node10 type resolution for subpath exports', () => {
  const subpaths = Object.keys(pkg.exports).filter((k) => k !== '.')
  it.each(subpaths)(
    '%s has a typesVersions entry matching its exports types',
    (key) => {
      const name = key.slice(2)
      const expected = pkg.exports[key].import.types.replace('./', '')
      expect(pkg.typesVersions['*'][name]).toEqual([expected])
    },
  )
})
