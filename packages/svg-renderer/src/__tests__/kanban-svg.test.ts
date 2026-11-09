import { describe, it, expect } from 'vitest'
import { parseKanban } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { layoutKanban, KANBAN } from '../kanban/layout.ts'

const layout = (src: string) => layoutKanban(parseKanban(src))

describe('kanban layout (Mermaid 12.3.0 figures)', () => {
  it('places columns 205px apart and sizes cards from their text', () => {
    const b = layout(
      'kanban\n  A\n    [One]\n    [Two]@{ ticket: T-1 }\n  B\n    [Three]',
    )
    expect(b.columns.map((c) => c.x)).toEqual([100, 305])
    const [one, two] = b.columns[0]!.cards
    expect([one!.width, one!.height, one!.cy]).toEqual([185, 44, -253])
    // 56 = 44 + half a row for the ticket; cards are 5px apart.
    expect([two!.height, two!.cy]).toEqual([56, -253 + 22 + 5 + 28])
    // Last card ends at -165; the column runs 30px past it from -275.
    expect(b.columns[0]!.height).toBe(140)
  })

  it('wraps at 175px and grows the column', () => {
    const b = layout(
      'kanban\n  A\n    [Create Blog about the new diagram]\n  B\n    [x]',
    )
    expect(b.columns[0]!.cards[0]!.height).toBe(68)
    expect(b.columns[0]!.cards[0]!.title.lines).toHaveLength(2)
  })

  it('keeps an empty column at 50px and the viewBox 10px around', () => {
    const b = layout('kanban\n  A')
    expect(b.columns[0]!.height).toBe(KANBAN.minColumn)
    expect(b.viewBox).toEqual({ x: 90, y: -310, width: 220, height: 70 })
  })

  it('honours kanban.sectionWidth', () => {
    const b = layout(
      "%%{init: {'kanban': {'sectionWidth': 300}}}%%\nkanban\n  A\n    [x]",
    )
    expect(b.columns[0]!.width).toBe(300)
    expect(b.columns[0]!.cards[0]!.width).toBe(285)
  })

  it('colours a priority bar, and leaves Medium and unknown names uncoloured', () => {
    const cards = layout(
      "kanban\n  A\n    a@{ priority: 'Very High' }\n    b@{ priority: Medium }\n    c@{ priority: Nope }\n    d",
    ).columns[0]!.cards
    expect(cards.map((c) => c.priorityColor)).toEqual([
      'red',
      '',
      '',
      undefined,
    ])
  })
})

describe('kanban line breaking (as Chrome breaks a 175px break-spaces box)', () => {
  const lines = (text: string) =>
    layout(`kanban\n  A\n    a[${text}]`).columns[0]!.cards[0]!.title.lines.map(
      (l) => l.map((r) => r.text).join(''),
    )

  it('breaks after a hyphen between letters, not before a digit', () => {
    expect(lines('aaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb')).toEqual([
      'aaaaaaaaaaaaaa-',
      'bbbbbbbbbbbbbbbb',
    ])
    expect(lines('aaaaaaaaaaaaaa-1111111111111111')).toHaveLength(1)
  })

  it('breaks after a hyphen that ends a bold run', () => {
    expect(lines('**aaaaaaaaaaaaaa-**bbbbbbbbbbbbbbbb')).toHaveLength(2)
    expect(lines('aaaaaa**aaaaaaaa-**bbbbbbbbbbbbbbbb')).toHaveLength(2)
  })

  it('breaks between ideographs and widens the box for an unbreakable word', () => {
    const cjk = layout(
      `kanban\n  列\n    a[${'一二三四五六七八九十'.repeat(2)}]`,
    )
    expect(cjk.columns[0]!.cards[0]!.title.lines).toHaveLength(2)
    const long = layout(`kanban\n  A\n    a[${'W'.repeat(30)} x]`)
    expect(long.columns[0]!.cards[0]!.title.width).toBeGreaterThan(175)
    expect(long.viewBox.width).toBeGreaterThan(220)
  })

  it('breaks between a Latin word and an ideograph that does not fit after it', () => {
    expect(lines(`${'W'.repeat(12)}一二`)[0]).toBe('W'.repeat(12))
  })

  it('moves a space that no longer fits to the next line', () => {
    const one = lines('aaaaaaaaaaaaaaaaaaaa bbb')
    expect(one.join('')).toContain('aaaaaaaaaaaaaaaaaaaa')
  })
})

describe('kanban SVG', () => {
  const svg = renderMermaidSVG(
    'kanban\n  Todo\n    a[One]@{ ticket: T-1, assigned: bob, priority: High }\n  Done\n    b[Two]',
  )

  it('draws a cluster per column and a node per card', () => {
    expect(svg.match(/class="cluster section-\d/g)).toHaveLength(2)
    expect(svg.match(/class="node/g)).toHaveLength(2)
    expect(svg).toContain('stroke="orange"')
    expect(svg).toContain('>T-1<')
    expect(svg).toContain('>bob<')
  })

  it('links tickets only with ticketBaseUrl', () => {
    expect(svg).not.toContain('<a ')
    const linked = renderMermaidSVG(
      "---\nconfig:\n  kanban:\n    ticketBaseUrl: 'https://x.test/#TICKET#'\n---\nkanban\n  A\n    a@{ ticket: Q-7 }",
    )
    expect(linked).toContain('href="https://x.test/Q-7"')
  })

  it('escapes text', () => {
    expect(renderMermaidSVG('kanban\n  A\n    [a &lt;b> "c"]')).not.toContain(
      '<b>',
    )
  })

  it('keeps safe user classes, draws bars and Markdown runs, and an empty board', () => {
    const out = renderMermaidSVG(
      'kanban\n  A\n  :::hot bad;class\n    a[**b** *i* ***both***]@{ priority: Medium }\n    :::cool\n    b',
    )
    expect(out).toContain('cluster section-1 hot"')
    expect(out).toContain('class="node cool"')
    expect(out).toContain('<line')
    expect(out).not.toContain('stroke="undefined"')
    expect(out).toContain('kb-bold')
    expect(out).toContain('kb-italic')
    const empty = layout('kanban\n')
    expect(empty.columns).toEqual([])
    expect(empty.viewBox.width).toBe(20)
    expect(renderMermaidSVG('kanban\n')).toContain('<svg')
  })
})
