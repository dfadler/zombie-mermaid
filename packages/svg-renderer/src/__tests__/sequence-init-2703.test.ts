/**
 * #2703: sequence `%%{init}%%` layout keys. Each moves our constant by its
 * distance from mermaid 12.3.0's default (probed: actorMargin 100 moves the
 * second lifeline +50, height 100 grows the actor box +35, noteMargin 30
 * grows a note +20 each way, wrap:true wraps notes at `width`, noteAlign /
 * messageAlign left|right set text-anchor). `*FontSize` and `messageMargin`
 * change nothing in mermaid 12.3.0 either.
 */
import { describe, it, expect } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../../../../src/index.ts'

const body = `sequenceDiagram
  participant A
  participant B
  A->>B: a fairly long message label to wrap around here
  Note right of B: a long note text that might wrap around too
  B->>B: self`
const withInit = (cfg: string) => `%%{init: {"sequence": ${cfg}}}%%\n${body}`
const vb = (svg: string) =>
  /viewBox="0 0 (\S+) (\S+)"/.exec(svg)!.slice(1).map(Number) as [
    number,
    number,
  ]
const rectOf = (svg: string, cls: string) => {
  const g = svg.slice(svg.indexOf(`<g class="${cls}"`))
  const m = /<rect x="(\S+)" y="(\S+)" width="(\S+)" height="(\S+)"/.exec(g)!
  return m.slice(1).map(Number) as [number, number, number, number]
}
const base = renderMermaidSVG(body)

describe('sequence init layout keys (#2703)', () => {
  it('parses keys, drops invalid ones', () => {
    const t = withInit(
      '{"wrap":true,"noteAlign":"left","width":"x","actorMargin":-1,"height":90,"bogus":1}',
    )
    const d = parseSequenceDiagram(splitStatements(t), t)
    expect(d.layout).toEqual({ wrap: true, noteAlign: 'left', height: 90 })
  })

  it('mermaid defaults are a no-op', () => {
    const cfg =
      '{"width":150,"height":65,"actorMargin":50,"boxMargin":10,"noteMargin":10,"diagramMarginX":50,"diagramMarginY":10,"bottomMarginAdj":1,"messageMargin":70,"actorFontSize":30}'
    expect(renderMermaidSVG(withInit(cfg))).toBe(base)
  })

  it('actorMargin widens the lifeline gap by the delta', () => {
    const short = 'sequenceDiagram\n  A->>B: hi'
    const wide = renderMermaidSVG(
      `%%{init: {"sequence": {"actorMargin":100}}}%%\n${short}`,
    )
    expect(vb(wide)[0] - vb(renderMermaidSVG(short))[0]).toBe(50)
  })

  it('width widens actor boxes, height grows them', () => {
    expect(
      rectOf(renderMermaidSVG(withInit('{"width":250}')), 'actor')[2],
    ).toBeGreaterThan(rectOf(base, 'actor')[2])
    expect(
      vb(renderMermaidSVG(withInit('{"height":100}')))[1] - vb(base)[1],
    ).toBeGreaterThanOrEqual(35)
  })

  it('margins grow the canvas', () => {
    for (const [k, axis] of [
      ['diagramMarginX', 0],
      ['diagramMarginY', 1],
      ['boxMargin', 1],
      ['bottomMarginAdj', 1],
      ['noteMargin', 1],
    ] as const) {
      expect(
        vb(renderMermaidSVG(withInit(`{"${k}":100}`)))[axis],
        k,
      ).toBeGreaterThan(vb(base)[axis])
    }
  })

  it('wrap breaks long notes and messages', () => {
    const w = renderMermaidSVG(withInit('{"wrap":true}'))
    expect(rectOf(w, 'note')[3]).toBeGreaterThan(rectOf(base, 'note')[3])
    expect(vb(w)[0]).toBeLessThan(vb(base)[0])
  })

  it('noteAlign and messageAlign set the text anchor', () => {
    expect(renderMermaidSVG(withInit('{"noteAlign":"left"}'))).toMatch(
      /class="note"[\s\S]*?text-anchor="start"/,
    )
    expect(renderMermaidSVG(withInit('{"noteAlign":"right"}'))).toMatch(
      /class="note"[\s\S]*?text-anchor="end"/,
    )
    expect(renderMermaidSVG(withInit('{"messageAlign":"left"}'))).toContain(
      'text-anchor="start"',
    )
    expect(renderMermaidSVG(withInit('{"messageAlign":"right"}'))).toContain(
      'text-anchor="end"',
    )
    expect(renderMermaidSVG(withInit('{"noteAlign":"center"}'))).toBe(base)
  })
})

describe('sequence init layout keys, ASCII (#2703)', () => {
  const a = renderMermaidASCII(body)
  const rows = (s: string) => s.trimEnd().split('\n')
  it('wrap splits long notes and labels over rows', () => {
    const w = renderMermaidASCII(withInit('{"wrap":true}'))
    expect(rows(w).length).toBeGreaterThan(rows(a).length)
    expect(Math.max(...rows(w).map((l) => l.length))).toBeLessThan(
      Math.max(...rows(a).map((l) => l.length)),
    )
  })
  it('noteAlign moves note text to the side', () => {
    const col = (s: string) =>
      s
        .split('\n')
        .find((l) => l.includes('a long note'))!
        .indexOf('a long note')
    const left = col(renderMermaidASCII(withInit('{"noteAlign":"left"}')))
    expect(left).toBeGreaterThan(0)
    // A note spanning two lifelines is wider than its text, so sides differ.
    const span = 'sequenceDiagram\n  A->>B: hi\n  Note over A,B: n'
    const at = (v: string) =>
      renderMermaidASCII(
        `%%{init: {"sequence": {"noteAlign":"${v}"}}}%%\n${span}`,
      )
    expect(new Set([at('left'), at('center'), at('right')]).size).toBe(3)
  })
  it('messageAlign left/right move the label', () => {
    const l = renderMermaidASCII(withInit('{"messageAlign":"left"}'))
    const r = renderMermaidASCII(withInit('{"messageAlign":"right"}'))
    expect(new Set([a, l, r]).size).toBe(3)
  })
})
