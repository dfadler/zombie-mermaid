/**
 * `option` inside `critical` is a block divider like `else`/`and`: mermaid
 * 12.2.0 draws a dashed line and the `[label]` at it. It used to be dropped
 * silently, taking the label and the divider with it (#1592 audit).
 */
import { describe, expect, it } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII, renderMermaidSVG } from '../src/index.ts'

const parse = (src: string) =>
  parseSequenceDiagram(
    ('sequenceDiagram\n' + src)
      .split('\n')
      .map((text, line) => ({ text: text.trim(), line })),
  )

const source = `sequenceDiagram
  critical Establish
    A->>B: connect
  option Timeout
    B->>A: retry
  option Denied
    B->>A: abort
  end`

describe('critical block option dividers', () => {
  it('parses each option as a divider at its message index', () => {
    const [block] = parse(source.replace('sequenceDiagram\n', '')).blocks
    expect(block!.dividers).toEqual([
      { index: 1, label: 'Timeout' },
      { index: 2, label: 'Denied' },
    ])
  })

  it('draws the labels in SVG and ASCII', () => {
    const svg = renderMermaidSVG(source)
    const ascii = renderMermaidASCII(source)
    for (const label of ['Timeout', 'Denied']) {
      expect(svg).toContain(`[${label}]`)
      expect(ascii).toContain(`[${label}]`)
      expect(ascii).toMatch(new RegExp(`├╌ \\[${label}\\]`))
    }
    // One dashed horizontal separator per divider (y1 === y2), none for lifelines.
    const separators = svg.match(
      /<line x1="[^"]+" y1="([^"]+)" x2="[^"]+" y2="\1" stroke="var\(--_line\)" stroke-width="0.75" stroke-dasharray="6 4"/g,
    )
    expect(separators).toHaveLength(2)
  })

  it('does not treat a participant named like a keyword as a divider', () => {
    const [block] = parse(
      'critical C\n  optionService->>andy: q\n  option O\n  andy->>optionService: r\nend',
    ).blocks
    expect(block!.dividers).toEqual([{ index: 1, label: 'O' }])
  })

  it('leaves `option` outside critical alone', () => {
    const [block] = parse('loop L\n  A->>B: x\n  option O\n  end').blocks
    expect(block!.dividers).toEqual([])
  })
})
