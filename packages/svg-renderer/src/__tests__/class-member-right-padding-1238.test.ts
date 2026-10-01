import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../../../../src/index.ts'

// Mono glyphs advance 0.6em (6.6px at the 11px member size). Chromium without
// subpixel glyph positioning (headless Linux) rounds each advance to a whole
// pixel, so the worst-case drawn width is chars * ceil(6.6) = chars * 7. A box
// sized from the unrounded estimate let a long member run into the right
// border in the Linux baselines (#1238).
const WORST_CASE_ADVANCE = 7
const MIN_RIGHT_PADDING = 8

const SRC = `classDiagram
  class Controller {
    -model Model
    +handleInput(event) void
    +updateModel(data) void
  }`

const attr = (tag: string, name: string) => {
  const start = tag.indexOf(`${name}="`) + name.length + 2
  return Number(tag.slice(start, tag.indexOf('"', start)))
}

describe('class member right padding (#1238)', () => {
  const svg = renderMermaidSVG(SRC)
  const box =
    (svg.split('<g class="class-node"')[1] ?? '').split('<rect')[1] ?? ''
  const text = svg
    .split('<text')
    .find((t) => t.includes('handleInput(event)')) as string
  const drawnChars = '+ handleInput(event): void'.length

  it('finds the box and the member text', () => {
    expect(box).not.toBe('')
    expect(text).toBeDefined()
  })

  it('keeps the minimum right padding even with whole-pixel glyph advances', () => {
    const boxRight = attr(box, 'x') + attr(box, 'width')
    const textRight = attr(text, 'x') + drawnChars * WORST_CASE_ADVANCE
    expect(boxRight - textRight).toBeGreaterThanOrEqual(MIN_RIGHT_PADDING)
  })
})
