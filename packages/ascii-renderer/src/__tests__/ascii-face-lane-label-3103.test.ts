/**
 * #3103: a labelled edge into a decision that routes on a face lane (a lane
 * sibling whose `buildFaceLaneRoute` path sets no label line) threw in
 * `centredLabelPlacement` and, once guarded, lost its label. Both labels must
 * now be drawn, in ASCII and Unicode.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

const source = `flowchart LR
  n0("SmYV")
  n1{"3L886B"}
  n2(["5"])
  n3("n")
  n0 -->|a| n1
  n3 --> n2
  n0 --> n3
  n2 --> n1
  n3 -->|0| n1
  n1 --> n0`

describe('#3103 labelled face-lane edge into a decision', () => {
  for (const useAscii of [false, true]) {
    it(`renders and keeps both labels (useAscii: ${useAscii})`, () => {
      const out = renderMermaidASCII(source, { useAscii, colorMode: 'none' })
      expect(out).toMatch(/─0─|-0-/)
      expect(out).toMatch(/\ba\b/)
    })
  }
})
