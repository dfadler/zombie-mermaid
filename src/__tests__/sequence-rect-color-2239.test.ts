import { describe, expect, it } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const src = (rect: string) =>
  `sequenceDiagram\n  participant A\n  participant B\n  ${rect}\n    A->>B: hi\n  end`

const blocksOf = (text: string) =>
  parseSequenceDiagram(splitStatements(text)).blocks

describe('sequence rect <color> highlight (#2239)', () => {
  it.each(['rgb(255,0,0)', '#ff0000', 'red', 'rgba(200,150,255,0.5)'])(
    'parses %s as a colour, not a label',
    (c) => {
      expect(blocksOf(src(`rect ${c}`))[0]).toMatchObject({
        type: 'rect',
        color: c,
        label: '',
      })
    },
  )

  it('ignores a rect whose text is not a colour', () => {
    const block = blocksOf(src('rect notacolor'))[0]!
    expect(block.color).toBeUndefined()
    expect(block.label).toBe('')
  })

  it('SVG: paints the region and draws no frame or tab', () => {
    const svg = renderMermaidSVG(src('rect rgb(255,0,0)'))
    expect(svg).toContain('data-color="rgb(255,0,0)"')
    expect(svg).toMatch(/<rect [^>]*fill="rgb\(255,0,0\)" \/>/)
    expect(svg).not.toContain('rect [')
  })

  it('SVG: an invalid colour does not leak into the SVG', () => {
    expect(renderMermaidSVG(src('rect notacolor'))).not.toContain('notacolor')
  })

  it('ASCII: the colour text is not printed as a block label', () => {
    expect(renderMermaidASCII(src('rect rgb(255,0,0)'))).not.toContain('rgb(')
  })

  it('other blocks keep their label and get no colour', () => {
    const block = blocksOf(
      'sequenceDiagram\n  participant A\n  loop red\n    A->>A: x\n  end',
    )[0]!
    expect(block).toMatchObject({ type: 'loop', label: 'red' })
    expect(block.color).toBeUndefined()
  })
})
