/**
 * #2962: mermaid@12.3.0 centres the `[*]` start and the exit target on a
 * composite of concurrent regions, even when the region columns differ in width.
 */
// Provenance (#2679): the centred position is read from mermaid@12.3.0 (headless, scripts/lib/real-mermaid.ts), not this renderer's own output.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setTrebuchetMetrics } from '@zombie-mermaid/core'
import { renderMermaidASCII } from '../index.ts'

const SRC = (dir: string): string =>
  `stateDiagram-v2\n  direction ${dir}\n  [*] --> W\n  W --> Q\n  state W {\n    A: Wait Idle Ready Running Active Failed Paused Done\n    --\n    B\n    --\n    C\n    --\n    D\n  }`

describe('entry and exit over concurrent regions (#2962)', () => {
  beforeAll(() => setTrebuchetMetrics(true))
  afterAll(() => setTrebuchetMetrics(false))

  for (const [dir, exitTee] of [
    ['TB', '┬'],
    ['BT', '┴'],
  ] as const) {
    it(`stands the dot, the exit and the target on the frame's middle (${dir})`, () => {
      const rows = renderMermaidASCII(SRC(dir), { colorMode: 'none' }).split(
        '\n',
      )
      const top = rows.findIndex((r) => r.startsWith('┌'))
      const mid = Math.floor((rows[top]!.trimEnd().length - 1) / 2)
      expect(rows.find((r) => r.includes('●'))!.indexOf('●')).toBe(mid)
      expect(rows.find((r) => r.includes(exitTee))!.indexOf(exitTee)).toBe(mid)
      expect(rows.find((r) => r.includes('Q'))!.indexOf('Q')).toBe(mid)
    })
  }
})
