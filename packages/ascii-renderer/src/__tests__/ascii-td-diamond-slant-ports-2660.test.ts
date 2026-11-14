/**
 * #2660: a TD decision's two branches leave its bottom face from the lower
 * slants, one each side of the vertex (mermaid@12.3.0 draws them there), not as
 * two stems under the vertex.
 */
import { afterEach, describe, it, expect } from 'vitest'
import {
  registerAsciiLayout,
  renderMermaidASCII,
} from '@zombie-mermaid/ascii-renderer'
import { asciiLayoutProvider } from '../../../../src/ascii-layout-provider.ts'

afterEach(() => registerAsciiLayout(undefined))

const SRC =
  'graph TD\n  A[Start] --> B{Ok?}\n  B -->|Yes| C[Go]\n  B -->|No| D[Stop]'

const render = (o: object = {}): string[] => {
  registerAsciiLayout(asciiLayoutProvider)
  return renderMermaidASCII(SRC, { colorMode: 'none', ...o })
    .split('\n')
    .map((r) => r.trimEnd())
}

describe('TD decision branches leave the lower slants (#2660)', () => {
  it('draws each branch outside the vertex row, a stem of its own', () => {
    expect(render().slice(10, 18)).toEqual([
      '         ╱─╲',
      '        ╱   ╲',
      '      <  Ok?  >',
      '        ╲   ╱',
      '        │╲─╱│',
      '        │   │',
      '   ┌────┘   └─────┐',
      '   │              │',
    ])
  })

  it('does the same in the ASCII charset', () => {
    const rows = render({ useAscii: true })
    const i = rows.findIndex((r) => r.includes('\\-/'))
    expect(rows[i]!.indexOf('|')).toBeLessThan(rows[i]!.indexOf('\\'))
    expect(rows[i]!.lastIndexOf('|')).toBeGreaterThan(rows[i]!.indexOf('/'))
  })
})
