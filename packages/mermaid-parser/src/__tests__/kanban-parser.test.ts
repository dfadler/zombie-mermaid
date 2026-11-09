import { describe, it, expect } from 'vitest'
import { parseKanban } from '../kanban/parser.ts'

describe('parseKanban', () => {
  it('reads columns, cards and metadata', () => {
    const k = parseKanban(`kanban
  Todo
    [Create Documentation]
    docs[Blog]
  id10[Ready for test]
    id4[Create parsing tests]@{ ticket: MC-2038, assigned: 'K.S', priority: 'High' }
`)
    expect(k.columns.map((c) => c.text)).toEqual(['Todo', 'Ready for test'])
    expect(k.columns[0]!.cards.map((c) => [c.id, c.text])).toEqual([
      ['Create Documentation', 'Create Documentation'],
      ['docs', 'Blog'],
    ])
    expect(k.columns[1]!.id).toBe('id10')
    expect(k.columns[1]!.cards[0]).toEqual({
      id: 'id4',
      text: 'Create parsing tests',
      ticket: 'MC-2038',
      assigned: 'K.S',
      priority: 'High',
    })
  })

  it('reads multi-line data, quoted values with commas, and label overrides', () => {
    const k = parseKanban(`kanban
  c
    a[x]@{
      ticket: 12
      assigned: "Ann, Bob"
      label: "Renamed"
    }`)
    expect(k.columns[0]!.cards[0]).toMatchObject({
      text: 'Renamed',
      ticket: '12',
      assigned: 'Ann, Bob',
    })
  })

  it('reads a bare key as null, an empty board for a header and newline', () => {
    expect(
      parseKanban('kanban\n  A\n    a@{ ticket }').columns[0]!.cards[0]!.ticket,
    ).toBeUndefined()
    expect(parseKanban('kanban\n').columns).toEqual([])
  })

  it('drops falsy metadata like Mermaid', () => {
    const c = parseKanban("kanban\n  c\n    a[x]@{ ticket: 0, assigned: '' }")
      .columns[0]!.cards[0]!
    expect(c.ticket).toBeUndefined()
    expect(c.assigned).toBeUndefined()
  })

  it('treats the first indentation as the column level', () => {
    const k = parseKanban(
      'kanban\n    A\n      a1\n    B\n        b1\n      b2',
    )
    expect(k.columns.map((c) => c.cards.length)).toEqual([1, 2])
  })

  it('records icons and classes on the node above', () => {
    const k = parseKanban(
      'kanban\n  A\n    a\n    ::icon(fa fa-x)\n    :::hot cold',
    )
    expect(k.columns[0]!.cards[0]).toMatchObject({
      icon: 'fa fa-x',
      className: 'hot cold',
    })
  })

  it('allows empty columns, comments, an indented header and CRLF', () => {
    const k = parseKanban('  kanban\r\n%% note\r\n  A\r\n  B\r\n')
    expect(k.columns.map((c) => c.cards.length)).toEqual([0, 0])
  })

  it('reads kanban config from front matter and init directives', () => {
    expect(
      parseKanban(
        "---\nconfig:\n  kanban:\n    sectionWidth: 260\n    ticketBaseUrl: 'https://x/#TICKET#'\n---\nkanban\n  A",
      ).config,
    ).toEqual({ sectionWidth: 260, ticketBaseUrl: 'https://x/#TICKET#' })
    expect(
      parseKanban('%%{init: {"kanban": {"sectionWidth": 300}}}%%\nkanban\n  A')
        .config,
    ).toEqual({ sectionWidth: 300 })
  })

  it('rejects what Mermaid 12.3.0 rejects', () => {
    expect(() => parseKanban('flowchart TD')).toThrow(/kanban/)
    expect(() => parseKanban('kanban\n    A\n  B\n    c')).toThrow(
      /Items without section detected/,
    )
    expect(() => parseKanban('kanban\n  A\n    a@{ shape: Foo }')).toThrow(
      /Shape names should be lowercase/,
    )
    expect(() => parseKanban('kanban\n  ::icon(x)')).toThrow(/needs a node/)
    expect(() => parseKanban('kanban')).toThrow(/Line 1/)
    expect(() => parseKanban('kanban\n  A\n    [a')).toThrow(/Line 3/)
  })

  it('reads bare booleans, null, numbers, quoted quotes and ignores non-text keys', () => {
    const card = (data: string) =>
      parseKanban(`kanban\n  A\n    a[x]@{ ${data} }`).columns[0]!.cards[0]!
    expect(card('ticket: true, assigned: false')).toMatchObject({
      ticket: 'true',
    })
    expect(card('ticket: false').ticket).toBeUndefined()
    expect(card('ticket: null').ticket).toBeUndefined()
    expect(card('ticket: 1e3, priority: 2.5')).toMatchObject({
      ticket: '1000',
      priority: '2.5',
    })
    expect(card(`assigned: 'it''s, ok'`).assigned).toBe("it's, ok")
    expect(card('assigned: "say \\"hi\\""').assigned).toBe('say "hi"')
    expect(card('1: x, icon: fa-x')).toMatchObject({ icon: 'fa-x' })
    expect(card('shape: rect').text).toBe('x')
    expect(card(`'ticket': "A: b"`).ticket).toBe('A: b')
  })

  it('says what it expected when a line is malformed', () => {
    expect(() => parseKanban('kanban\n  A\n    a[x] b')).toThrow(
      /end of the line/,
    )
    expect(() => parseKanban('kanban\n  A\n    a[]')).toThrow(/node text/)
    expect(() => parseKanban('kanban\n  A\n    mail@x.com')).toThrow(
      /Unexpected "@"/,
    )
    expect(() => parseKanban('kanban\n  @{ a: b }')).toThrow(/a node/)
    expect(() => parseKanban('kanban\n  A\n    a[x')).toThrow(/closing bracket/)
    expect(() => parseKanban('kanban\n  :::hot')).toThrow(/class needs a node/)
    expect(() => parseKanban('kanban\n  ::icon(x)')).toThrow(
      /icon needs a node/,
    )
    expect(() => parseKanban('kanban\n  A\n    )')).toThrow(/Line 3/)
  })

  it('ignores an icon on a column and blank indented lines', () => {
    const k = parseKanban('kanban\n  A\n  ::icon(fa)\n    \n  :::c\n    a')
    expect(k.columns[0]).not.toHaveProperty('icon')
    expect(k.columns[0]!.className).toBe('c')
    expect(k.columns[0]!.cards).toHaveLength(1)
  })
})
