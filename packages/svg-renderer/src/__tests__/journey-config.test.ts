/**
 * `%%{init: {"journey": {...}}}%%` geometry keys (#2957). Expected numbers are
 * measured from mermaid@12.3.0 rendering the same source with
 * `mermaid.initialize({ journey })`.
 */
import { describe, it, expect } from 'vitest'
import { parseJourney } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { layoutJourney } from '../journey/layout.ts'

const BODY = `journey
  title T
  section A
    t1: 5: Me, Cat
    t2: 3: Me
  section B
    t3: 1: Cat
`
const lay = (cfg: string) =>
  layoutJourney(
    parseJourney(cfg ? `%%{init: {"journey": ${cfg}}}%%\n${BODY}` : BODY),
  )
const shape = (cfg: string) => {
  const l = lay(cfg)
  return {
    vb: [l.width, l.height],
    sections: l.sections.map((s) => [s.x, s.y - 25, s.width, s.height]),
    tasks: l.tasks.map((t) => [t.x, t.y - 25, t.width, t.height]),
    line: [l.tasks[0]!.lineEndY - 25, l.axis.y1 - 25, l.axis.x2],
  }
}

describe('journey init config', () => {
  it('defaults match mermaid@12.3.0', () => {
    expect(shape('')).toEqual({
      vb: [900, 540],
      sections: [
        [150, 50, 350, 50],
        [550, 50, 150, 50],
      ],
      tasks: [
        [150, 110, 150, 50],
        [350, 110, 150, 50],
        [550, 110, 150, 50],
      ],
      line: [450, 200, 746],
    })
  })

  it.each([
    ['{"width":200}', [1000, 540], [650, 110, 200, 50], [450, 200, 846]],
    ['{"height":80}', [900, 540], [550, 170, 150, 80], [450, 320, 746]],
    ['{"taskMargin":20}', [810, 540], [490, 110, 150, 50], [450, 200, 656]],
    ['{"diagramMarginX":10}', [780, 540], [550, 110, 150, 50], [450, 200, 626]],
    ['{"diagramMarginY":30}', [900, 580], [550, 130, 150, 50], [450, 200, 746]],
    ['{"leftMargin":300}', [1200, 540], [700, 110, 150, 50], [450, 200, 896]],
  ] as const)(
    '%s moves the geometry like mermaid@12.3.0',
    (cfg, vb, last, line) => {
      const s = shape(cfg)
      expect(s.vb).toEqual(vb)
      expect(s.tasks[2]).toEqual(last)
      expect(s.line).toEqual(line)
    },
  )

  it('width 0 collapses the boxes like mermaid ', () => {
    const s = shape('{"width":0}')
    expect(s.tasks.map((t) => t[2])).toEqual([0, 0, 0])
    expect(s.sections[0]).toEqual([150, 50, 50, 50])
  })

  it('wraps the legend at maxLabelWidth and offsets by leftMargin like mermaid@12.3.0', () => {
    const src = (cfg: string) =>
      layoutJourney(
        parseJourney(
          `%%{init: {"journey": ${cfg}}}%%\njourney\nsection A\nt1: 5: A very long actor name here, Me`,
        ),
      )
    const a = src('{"maxLabelWidth":100}')
    expect(a.legend[0]!.lines.map((l) => l.text)).toEqual([
      'A very long',
      'actor name',
      'here',
    ])
    expect([a.width, a.tasks[0]!.x]).toEqual([662.90625, 231.453125])
    const b = src('{"maxLabelWidth":100,"leftMargin":60}')
    expect([b.width, b.tasks[0]!.x]).toEqual([482.90625, 141.453125])
  })

  it('wraps task labels at the configured width', () => {
    const l = layoutJourney(
      parseJourney(
        '%%{init: {"journey": {"width": 400}}}%%\njourney\nsection S\nOne two three four five six seven: 3: Me',
      ),
    )
    expect(l.tasks[0]!.lines).toHaveLength(1)
  })

  // Probed in mermaid@12.3.0 (headless Chrome) on this BODY's shape (#3006).
  it.each([
    ['{"width":"60"}', [720, 540]],
    ['{"width":-40}', [520, 540]],
    ['{"taskMargin":-40}', [630, 540]],
    ['{"diagramMarginX":-40}', [630, 540]],
    ['{"diagramMarginY":-40}', [900, 440]],
  ] as const)(
    '%s accepts strings and negatives like mermaid@12.3.0',
    (cfg, vb) => {
      expect(shape(cfg).vb).toEqual(vb)
    },
  )

  it('a numeric-string height coerces like mermaid; negative leftMargin shifts the first task left', () => {
    expect(shape('{"height":"80"}')).toEqual(shape('{"height":80}'))
    expect(lay('{"leftMargin":-40}').tasks[0]!.x).toBeLessThan(
      lay('').tasks[0]!.x,
    )
  })

  it('drops bad values and unknown keys', () => {
    // String taskMargin concatenates in mermaid (garbage viewBox), negative height draws
    // negative-height rects: both dropped.
    expect(
      shape(
        '{"height":-40,"taskMargin":"20","leftMargin":"60","width":"x","maxLabelWidth":1e9,"x":1}',
      ),
    ).toEqual(shape(''))
    expect(shape('{"width":null,"height":""}')).toEqual(shape(''))
  })

  it('leaves the ASCII output unchanged (mermaid has no text mode)', () => {
    const cfg = `%%{init: {"journey": {"width": 200, "leftMargin": 300}}}%%\n${BODY}`
    expect(renderMermaidASCII(cfg)).toBe(renderMermaidASCII(BODY))
  })
})
