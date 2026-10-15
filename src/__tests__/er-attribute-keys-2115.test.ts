/**
 * ER attribute key lists (#2115): `PK, FK`, `PK,FK` and `PK, FK, UK` keep every
 * key in order in the model, the SVG and the ASCII output, with or without a
 * comment. A space-only list (`PK FK`), a dangling comma or an unknown word is
 * a parse error, like mermaid.js (12.1.0 and 12.2.0 both reject them).
 */
import { describe, it, expect } from 'vitest'
import { parseErDiagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const src = (attr: string) => `erDiagram\n  T {\n    string a ${attr}\n  }`
const keysOf = (attr: string) =>
  parseErDiagram(splitStatements(src(attr))).entities[0]!.attributes[0]!

describe('ER attribute key lists', () => {
  it.each([
    ['PK', ['PK']],
    ['FK', ['FK']],
    ['UK', ['UK']],
    ['PK, FK', ['PK', 'FK']],
    ['PK,FK', ['PK', 'FK']],
    ['PK , FK', ['PK', 'FK']],
    ['PK, FK, UK', ['PK', 'FK', 'UK']],
    ['FK,PK', ['FK', 'PK']],
    ['PK, FK "c"', ['PK', 'FK']],
    ['PK,FK,UK "c"', ['PK', 'FK', 'UK']],
  ])('parses %s', (attr, keys) => {
    expect(keysOf(attr).keys).toEqual(keys)
  })

  it('keeps the comment next to a multi-key list', () => {
    expect(keysOf('PK, FK "c"').comment).toBe('c')
  })

  it.each(['PK FK', 'PK FK "c"', 'PK,', 'PK,,FK', 'PKX', 'PK, FOO'])(
    'rejects %s',
    (attr) => {
      expect(() => keysOf(attr)).toThrow(/Line 3: Invalid ER attribute keys/)
    },
  )

  it('shows PK,FK in SVG and ASCII for both spellings', () => {
    const source = src('PK, FK "c"').replace('}', '    string b PK,FK\n  }')
    expect(renderMermaidSVG(source).match(/>PK,FK</g)).toHaveLength(2)
    expect(
      renderMermaidASCII(source)
        .split('\n')
        .filter((l) => l.includes('PK,FK')),
    ).toHaveLength(2)
  })
})
