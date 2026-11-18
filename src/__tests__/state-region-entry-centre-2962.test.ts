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

  const REGIONS = (extra = ''): string =>
    `    A: Wait Idle Ready Running Active Failed Paused Done\n    --\n    B\n    --\n    C\n    --\n    D\n${extra}`
  const draw = (src: string): string[] =>
    renderMermaidASCII(src, { colorMode: 'none' }).split('\n')

  it('still draws the frame and the exit target in LR', () => {
    const out = draw(
      `stateDiagram-v2\n  direction LR\n  [*] --> W\n  W --> Q\n  state W {\n${REGIONS()}  }`,
    ).join('\n')
    expect(out).toContain('┌')
    expect(out).toContain('Q')
  })

  it('leaves equal-width regions alone', () => {
    const rows = draw(
      'stateDiagram-v2\n  [*] --> W\n  W --> Q\n  state W {\n    B\n    --\n    C\n  }',
    )
    expect(rows.some((r) => r.includes('●'))).toBe(true)
  })

  it('centres an entry with no exit, and an exit with no entry', () => {
    for (const edge of ['[*] --> W', 'W --> Q']) {
      const rows = draw(
        `stateDiagram-v2\n  ${edge}\n  state W {\n${REGIONS()}  }`,
      )
      expect(rows.some((r) => r.startsWith('┌'))).toBe(true)
    }
  })

  it('keeps a column another edge crosses where it is', () => {
    const rows = draw(
      `stateDiagram-v2\n  [*] --> W\n  W --> Q\n  [*] --> X\n  X --> Q\n  state W {\n${REGIONS()}  }`,
    )
    expect(rows.some((r) => r.includes('Q'))).toBe(true)
  })

  it('handles two composites of regions in a row', () => {
    const rows = draw(
      `stateDiagram-v2\n  [*] --> W\n  W --> V\n  V --> Q\n  state W {\n${REGIONS()}  }\n  state V {\n    E\n    --\n    F: Wait Idle Ready Running Active Failed Paused Done\n  }`,
    )
    expect(rows.filter((r) => r.includes('┌─')).length).toBeGreaterThanOrEqual(
      2,
    )
  })

  it('slides a lone column in LR too', () => {
    for (const dir of ['LR', 'RL']) {
      const out = draw(
        `stateDiagram-v2\n  direction ${dir}\n  X --> W\n  W --> Q\n  state W {\n${REGIONS()}  }`,
      ).join('\n')
      expect(out).toContain('Q')
    }
  })

  it('keeps an entry column that a longer edge runs through', () => {
    const out = draw(
      `stateDiagram-v2\n  [*] --> W\n  [*] --> Y\n  Y --> Z\n  Z --> Q\n  W --> Q\n  state W {\n${REGIONS()}  }`,
    ).join('\n')
    expect(out).toContain('Q')
  })

  it('keeps an entry that would slide off the canvas', () => {
    const out = draw(
      `stateDiagram-v2\n  [*] --> W\n  state W {\n    A: Wait Idle Ready Running Active Failed Paused Done\n    --\n    B\n  }\n  [*] --> V\n  V --> W`,
    ).join('\n')
    expect(out).toContain('┌')
  })
})
