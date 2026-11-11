/**
 * Class and ER box sizes (#2678): measured on mermaid 12.3.0 (headless
 * Chromium, `scripts/lib/real-mermaid.ts`) for the gallery samples. Heights
 * are exact multiples of mermaid's 24px text line; widths follow its text
 * measurement, within 1px. The ASCII renderer draws boxes in character cells,
 * so it has no analogue of these pixel sizes.
 */
import { describe, it, expect } from 'vitest'
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../index.ts'

/** [gallery id, mermaid width, mermaid height] */
const BOXES: Array<[number, number, number]> = [
  [49, 152.8, 192],
  [50, 213.15, 288],
  [51, 242.87, 174],
  [52, 177.92, 192],
  [53, 143.32, 216],
  [66, 213, 214],
  [67, 265, 299],
  [159, 319.64, 342],
]

const box = (svg: string) => {
  const m =
    /<g class="(?:class-node|entity)[^>]*>\s*<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"/.exec(
      svg,
    )!
  return { w: Number(m[1]), h: Number(m[2]) }
}

describe('class and ER box size matches mermaid 12.3.0', () => {
  it.each(BOXES)('gallery %i', (id, w, h) => {
    const b = box(renderMermaidSVG(samples[id]!.source))
    expect(Math.abs(b.w - w)).toBeLessThanOrEqual(1)
    expect(Math.abs(b.h - h)).toBeLessThanOrEqual(1)
  })

  it('a bare ER entity wider than 100 follows its name, not the minimum', () => {
    const w = box(renderMermaidSVG('erDiagram\n  ABCDEFGH {\n  }')).w
    expect(Math.abs(w - 116.14)).toBeLessThanOrEqual(1)
    expect(box(renderMermaidSVG('erDiagram\n  AB {\n  }')).w).toBe(100)
  })

  it('kerned pairs (AV, AT, TA, AW) narrow a class box as in mermaid', () => {
    const w = box(
      renderMermaidSVG('classDiagram\n  class AVATAR {\n    +TAWAY()\n  }'),
    ).w
    // Mermaid 12.3.0: 116.25. Without kerning the box is about 4px wider.
    expect(Math.abs(w - 116.25)).toBeLessThanOrEqual(0.5)
  })
})
