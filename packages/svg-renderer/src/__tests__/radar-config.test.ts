/**
 * `%%{init}%%` / front matter `radar` geometry and `themeVariables.radar`
 * sizes (#2944). Expected numbers are measured from mermaid@12.3.0.
 */
import { describe, it, expect } from 'vitest'
import { stripFrontMatter } from '@zombie-mermaid/core'
import { parseRadar } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '../index.ts'
import { layoutRadar } from '../radar/layout.ts'

const BODY = 'radar-beta\ntitle T\naxis a, b, c\ncurve c{1, 2, 3}\n'
const lay = (init: string) => layoutRadar(parseRadar(init + BODY))

describe('radar init config', () => {
  it('moves the frame and legend like mermaid@12.3.0', () => {
    const l = lay(
      '%%{init: {"radar": {"width": 400, "height": 300, "marginTop": 80, "marginRight": 20, "marginBottom": 10, "marginLeft": 60}}}%%\n',
    )
    expect([l.width, l.height, l.centerX, l.centerY]).toEqual([
      480, 390, 260, 230,
    ])
    expect(l.legend[0]).toMatchObject({ x: 165, y: -172.5 })
    expect(l.title.y).toBe(-230)
    expect(l.axes[0]).toMatchObject({ x2: 0, y2: -150 })
  })

  it('reads axis factors and curve tension', () => {
    const l = lay(
      '%%{init: {"radar": {"axisScaleFactor": 0.8, "axisLabelFactor": 1.3}}}%%\n',
    )
    expect(l.axes[0]).toMatchObject({ y2: -240, labelY: -394 })
  })

  it('reads front matter config', () => {
    const l = layoutRadar(
      parseRadar(
        stripFrontMatter(
          '---\nconfig:\n  radar:\n    width: 450\n---\n' + BODY,
        ),
      ),
    )
    expect(l.width).toBe(550)
  })

  it('reads front matter config passed straight to parseRadar', () => {
    expect(
      parseRadar('---\nconfig:\n  radar:\n    width: 450\n---\n' + BODY).config,
    ).toEqual({ width: 450 })
  })

  it('drops bad values', () => {
    expect(
      lay('%%{init: {"radar": {"width": "x", "marginTop": -1}}}%%\n').width,
    ).toBe(700)
  })

  it('writes themeVariables.radar sizes into the CSS, keeping 0', () => {
    const svg = renderMermaidSVG(
      '%%{init: {"themeVariables": {"radar": {"axisStrokeWidth": 5, "curveOpacity": 0, "legendFontSize": 20, "graticuleOpacity": 0.7, "graticuleStrokeWidth": 3, "axisLabelFontSize": 18, "curveStrokeWidth": 4}}}}%%\n' +
        BODY,
    )
    expect(svg).toContain(
      '.radarAxisLine { stroke: var(--fg); stroke-width: 5; }',
    )
    expect(svg).toContain('font-size: 18px')
    expect(svg).toContain(
      'fill-opacity: 0.7; stroke: var(--_line); stroke-width: 3;',
    )
    expect(svg).toContain(
      'fill-opacity: 0; stroke: var(--radar-color-0); stroke-width: 4;',
    )
    expect(svg).toContain('font-size: 20px; dominant-baseline')
  })

  it('ignores radar.* style keys, as mermaid@12.3.0 does', () => {
    expect(
      renderMermaidSVG(
        '%%{init: {"radar": {"axisStrokeWidth": 9}}}%%\n' + BODY,
      ),
    ).toContain('.radarAxisLine { stroke: var(--fg); stroke-width: 2; }')
  })

  it('leaves the ASCII output alone', () => {
    const init =
      '%%{init: {"radar": {"width": 200}, "themeVariables": {"radar": {"curveOpacity": 1}}}}%%\n'
    expect(renderMermaidASCII(init + BODY)).toBe(renderMermaidASCII(BODY))
  })
})
