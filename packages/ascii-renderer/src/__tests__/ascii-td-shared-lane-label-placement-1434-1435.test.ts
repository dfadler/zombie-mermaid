/**
 * #1434: `second` sat flush against B-->D's stem (`second│`).
 * #1435: `fifth` sat mid-lane, rows below where B-->D joins the shared lane.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `flowchart TD
  A --> B
  A --> |first| C
  B --> |second| C
  A --> |third| D
  C --> |fourth| D
  B --> |fifth| D`

describe('TD labels on a shared lane (#1434, #1435)', () => {
  for (const useAscii of [false, true]) {
    const mode = useAscii ? 'ascii' : 'unicode'
    const stem = useAscii ? '|' : '│'
    const rows = renderMermaidASCII(SRC, { colorMode: 'none', useAscii }).split(
      '\n',
    )

    it(`leaves a blank cell between "second" and the sibling stem (${mode})`, () => {
      const row = rows.find((r) => r.includes('second'))!
      expect(row).toMatch(new RegExp(`second \\${stem}`))
    })

    it(`puts "fifth" within two rows below the junction row (${mode})`, () => {
      const join = rows.findIndex((r) => r.includes('first'))
      const fifth = rows.findIndex((r) => r.includes('fifth'))
      expect(fifth - join).toBeGreaterThan(0)
      expect(fifth - join).toBeLessThanOrEqual(2)
    })
  }
})
