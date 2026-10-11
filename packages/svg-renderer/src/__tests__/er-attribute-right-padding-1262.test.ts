import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../../../../src/index.ts'

// Mono glyphs advance 0.6em (6.6px at the 11px attribute size). Chromium
// without subpixel glyph positioning (headless Linux) rounds each advance to a
// whole pixel, so the worst-case drawn width is chars * ceil(6.6) = chars * 7.
// A box sized from the unrounded estimate let the type run into the
// right-aligned name (#1262, same cause as #1238).
const WORST_CASE_ADVANCE = 7
// The row text puts two spaces between type and name, so at worst-case
// advances the gap must not shrink below two whole-pixel glyphs.
const MIN_GAP_BETWEEN_TYPE_AND_NAME = 2 * WORST_CASE_ADVANCE

const SRC = `erDiagram
  CUSTOMER {
    varchar(255) emailAddressPrimary
    string name
  }`

const attr = (tag: string, name: string) => {
  const start = tag.indexOf(`${name}="`) + name.length + 2
  return Number(tag.slice(start, tag.indexOf('"', start)))
}

describe('ER attribute row padding (#1262)', () => {
  const svg = renderMermaidSVG(SRC)
  const texts = svg.split('<text')
  const typeText = texts.find((t) => t.includes('varchar(255)')) as string
  const nameText = texts.find((t) =>
    t.includes('emailAddressPrimary'),
  ) as string

  it('finds the type and name text', () => {
    expect(typeText).toBeDefined()
    expect(nameText).toBeDefined()
  })

  it('leaves a gap between type and name even with whole-pixel glyph advances', () => {
    const typeRight =
      attr(typeText, 'x') + 'varchar(255)'.length * WORST_CASE_ADVANCE
    const nameLeft =
      attr(nameText, 'x') - 'emailAddressPrimary'.length * WORST_CASE_ADVANCE
    expect(nameLeft - typeRight).toBeGreaterThanOrEqual(
      MIN_GAP_BETWEEN_TYPE_AND_NAME,
    )
  })
})
