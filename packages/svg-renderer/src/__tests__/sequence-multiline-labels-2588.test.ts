/**
 * #2588: multi-line (`<br/>`) frame and message labels keep mermaid 12.3.0's
 * spacing. Measured in 12.3.0: each extra message-label line moves the arrow
 * down one line height while the label's first line stays put; each extra
 * header-label line pushes the frame's first arrow down, the frame top fixed.
 */
import { describe, it, expect } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutSequenceDiagram } from '../sequence/layout.ts'
import { renderMermaidSVG } from '../index.ts'

function layout(src: string) {
  return layoutSequenceDiagram(
    parseSequenceDiagram(
      ('sequenceDiagram\n' + src)
        .split('\n')
        .map((text, line) => ({ text: text.trim(), line })),
    ),
  )
}

/** [first, last] baseline y of the `<text>` holding `marker` (single or tspans). */
function baselines(svg: string, marker: string): [number, number] {
  const el = svg
    .split('<text ')
    .find((t) => t.includes(`>${marker}`) || t.includes(`">${marker}`))!
  const y = Number(/ y="([\d.]+)"/.exec(el)![1])
  const dys = [...el.matchAll(/dy="([-\d.]+)"/g)].map((m) => Number(m[1]))
  const first = y + dys[0]!
  return [first, y + dys.reduce((a, b) => a + b, 0)]
}

describe('multi-line message labels (#2588)', () => {
  it('moves the arrow down by the extra lines, first line fixed', () => {
    const y = (n: number) =>
      layout(`A->>B: ${Array(n).fill('l').join('<br/>')}\nA->>B: z`)
    const [one, two, three] = [y(1), y(2), y(3)]
    const lh = two.messages[0]!.y - one.messages[0]!.y
    expect(lh).toBeGreaterThan(10)
    expect(three.messages[0]!.y - two.messages[0]!.y).toBeCloseTo(lh)
    // The next row keeps its distance from the arrow
    expect(two.messages[1]!.y - two.messages[0]!.y).toBeCloseTo(
      one.messages[1]!.y - one.messages[0]!.y,
    )
  })

  it('keeps the last line where a one-line label sits above the arrow', () => {
    const arrowY = (svg: string) =>
      Number(
        /<line x1="[\d.]+" y1="([\d.]+)"/.exec(
          svg.split('class="message"')[1]!,
        )![1],
      )
    const one = renderMermaidSVG('sequenceDiagram\nA->>B: first')
    const two = renderMermaidSVG('sequenceDiagram\nA->>B: first<br/>second')
    expect(arrowY(two) - baselines(two, 'first')[1]).toBeCloseTo(
      arrowY(one) - baselines(one, 'first')[1],
    )
    // And the first line stays at the same y, so nothing moves up into the header
    expect(baselines(two, 'first')[0]).toBeCloseTo(baselines(one, 'first')[0])
  })
})

describe('multi-line frame labels (#2588)', () => {
  const frame = (label: string) =>
    layout(`A->>B: m\nloop ${label}\nA->>B: msg\nend`)

  it('pushes the first arrow down, frame top unchanged', () => {
    const one = frame('one')
    const two = frame('one<br/>two')
    expect(two.blocks[0]!.y).toBeCloseTo(one.blocks[0]!.y)
    const extra = two.messages[1]!.y - one.messages[1]!.y
    expect(extra).toBeGreaterThan(10)
    // Arrow stays the same distance below the frame's label block
    expect(two.messages[1]!.y - two.blocks[0]!.y).toBeCloseTo(
      one.messages[1]!.y - one.blocks[0]!.y + extra,
    )
    expect(
      frame('a<br/>b<br/>c').messages[1]!.y - two.messages[1]!.y,
    ).toBeCloseTo(extra)
  })

  it('keeps the first line in the tab band; extra lines hang below it', () => {
    const one = renderMermaidSVG('sequenceDiagram\nloop one\nA->>B: m\nend')
    const two = renderMermaidSVG(
      'sequenceDiagram\nloop one<br/>two\nA->>B: m\nend',
    )
    expect(baselines(two, '[one')[0]).toBeCloseTo(baselines(one, '[one')[0])
    expect(baselines(two, '[one')[1]).toBeGreaterThan(
      baselines(one, '[one')[0] + 10,
    )
  })
})

describe('multi-line divider labels (#2588)', () => {
  const alt = (label: string, tail = 'A->>B: y') =>
    layout(`A->>B: m\nalt a\nA->>B: x\nelse ${label}\n${tail}\nend`)
  const render = (label: string) =>
    renderMermaidSVG(
      `sequenceDiagram\nA->>B: m\nalt a\nA->>B: x\nelse ${label}\nA->>B: y\nend`,
    )

  it('keeps the divider line fixed and pushes the next arrow down', () => {
    const one = alt('e1')
    const two = alt('e1<br/>e2')
    expect(two.blocks[0]!.dividers[0]!.y).toBeCloseTo(
      one.blocks[0]!.dividers[0]!.y,
    )
    expect(two.messages[2]!.y - one.messages[2]!.y).toBeGreaterThan(10)
  })

  it('keeps the divider fixed under a multi-line message label', () => {
    const one = alt('e1')
    const two = alt('e1', 'A->>B: y<br/>y2')
    expect(two.blocks[0]!.dividers[0]!.y).toBeCloseTo(
      one.blocks[0]!.dividers[0]!.y,
    )
  })

  it('keeps the first line where a one-line label sits', () => {
    expect(baselines(render('e1<br/>e2'), '[e1')[0]).toBeCloseTo(
      baselines(render('e1'), '[e1]')[0],
    )
  })

  it('handles an else with no message after it', () => {
    const l = layout('A->>B: m\nalt a\nA->>B: x\nelse e1<br/>e2\nend')
    expect(l.blocks[0]!.dividers).toHaveLength(1)
  })
})
