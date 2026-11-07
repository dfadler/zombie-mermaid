import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

const src = (init: string) =>
  `%%{init: ${init}}%%\ntimeline\n  title T\n  2002 : a\n  2003 : b\n  2004 : c`
const viewBox = (svg: string) => /viewBox="([^"]+)"/.exec(svg)![1]!
const classes = (svg: string) =>
  [...svg.matchAll(/section-(-?\d+)/g)].map((m) => m[1])

describe('timeline init config', () => {
  // Sizes below are mermaid 12.3.0's for this source.
  it.each([
    ['timeline', '0 0 995 476.6', '0 0 810 396.6'],
    ['timeline TD', '0 0 745 347.4', '0 0 610 267.4'],
  ])('%s reads leftMargin and padding', (h, base, cfg) => {
    const run = (i: string) =>
      renderMermaidSVG(src(i).replace('timeline\n', h + '\n'))
    expect(viewBox(run('{}'))).toBe(base)
    expect(viewBox(run('{"timeline":{"leftMargin":100,"padding":10}}'))).toBe(
      cfg,
    )
  })

  it('disableMulticolor keeps every period in one colour', () => {
    expect(new Set(classes(renderMermaidSVG(src('{}')))).size).toBeGreaterThan(
      1,
    )
    const off = renderMermaidSVG(src('{"timeline":{"disableMulticolor":true}}'))
    expect(new Set(classes(off)).size).toBe(1)
  })

  it('drops negative padding and absurd margins', () => {
    const bad = renderMermaidSVG(
      src(
        '{"timeline":{"leftMargin":100000000000000000000000000000,"padding":-500}}',
      ),
    )
    expect(viewBox(bad)).toBe(viewBox(renderMermaidSVG(src('{}'))))
  })

  it('drops bad values', () => {
    const bad = renderMermaidSVG(
      src('{"timeline":{"leftMargin":"x","padding":null}}'),
    )
    expect(viewBox(bad)).toBe(viewBox(renderMermaidSVG(src('{}'))))
  })
})
