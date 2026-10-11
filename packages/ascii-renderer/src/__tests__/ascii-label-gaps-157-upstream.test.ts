/**
 * Upstream lukilabs/beautiful-mermaid#157 (NahumLitvin): an edge line must stay
 * out of the spaces inside its label, so `push = build` is not drawn as
 * `push─=─build`. #1348 / #1354 fixed this in `labelInteriorSpaces`; this pins
 * upstream's exact scenario across all four directions and with fan-in /
 * fan-out, which ascii-label-spaces-1348.test.ts (TD only, no `=` label) does
 * not cover.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const LABEL = 'push = build'
// Every line / box-drawing glyph, unicode and ASCII mode, plus arrow heads.
const LINE_GLYPHS = /[─│┌┐└┘├┤┬┴┼╭╮╯╰▲▼◄►\-|+]/

const render = (src: string, useAscii = false): string =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

/** The text of every row that carries the label's first glyph, from `p` to `d`. */
function labelSpans(out: string, label: string): string[] {
  const last = label.slice(-1)
  const spans: string[] = []
  for (const row of out.split('\n')) {
    const start = row.indexOf(label.slice(0, 2))
    if (start === -1) continue
    const end = row.indexOf(last, start + label.length - 1)
    if (end !== -1) spans.push(row.slice(start, end + 1))
  }
  return spans
}

function expectLabelIntact(out: string): void {
  expect(out).toContain(LABEL)
  const spans = labelSpans(out, LABEL)
  expect(spans.length).toBeGreaterThan(0)
  for (const span of spans) {
    // Contiguous and nothing drawn inside the span's own width.
    expect(span).toBe(LABEL)
    expect(span).not.toMatch(LINE_GLYPHS)
  }
}

describe('upstream #157: no edge line inside a label (push = build)', () => {
  for (const dir of ['TD', 'LR', 'BT', 'RL']) {
    for (const useAscii of [false, true]) {
      it(`${dir}${useAscii ? ' (ASCII mode)' : ''}`, () => {
        expectLabelIntact(render(`graph ${dir}\nA -->|${LABEL}| B`, useAscii))
      })
    }
  }

  it('fan-out: the label survives next to a sibling edge', () => {
    expectLabelIntact(render(`graph TD\nA -->|${LABEL}| B\nA --> C`))
  })

  it('fan-in: the label survives next to a sibling edge', () => {
    expectLabelIntact(render(`graph LR\nA -->|${LABEL}| C\nB --> C`))
  })
})
