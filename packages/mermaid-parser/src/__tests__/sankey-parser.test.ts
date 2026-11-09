/**
 * Sankey parsing, checked against mermaid@12.3.0's jison grammar and database
 * (the same sources were run through the real parser to see what it accepts).
 */
import { describe, it, expect } from 'vitest'
import { parseSankey } from '../index.ts'

describe('parseSankey', () => {
  it('reads rows, creating nodes source first in order of appearance', () => {
    const sk = parseSankey('sankey-beta\n\nA,B,10\nB,C,2.5\nA,C,1e1')
    expect(sk.nodes).toEqual(['A', 'B', 'C'])
    expect(sk.links).toEqual([
      { source: 'A', target: 'B', value: 10 },
      { source: 'B', target: 'C', value: 2.5 },
      { source: 'A', target: 'C', value: 10 },
    ])
    expect(sk.config).toBeUndefined()
  })

  it('accepts the `sankey` alias, any case, CRLF, indentation and extra blank lines', () => {
    const sk = parseSankey('  SANKEY\r\n   A , B , 5 \r\n\r\n\r\n')
    expect(sk.links).toEqual([{ source: 'A', target: 'B', value: 5 }])
  })

  it('drops %% comments, directives and front matter', () => {
    const sk = parseSankey(
      '---\ntitle: T\n---\n%%{init: {"sankey": {"showValues": false}}}%%\nsankey-beta\n%% note\nA,B,1',
    )
    expect(sk.links).toHaveLength(1)
    expect(sk.config).toEqual({ showValues: false })
  })

  it('reads quoted fields with commas, doubled quotes and newlines', () => {
    const sk = parseSankey(
      'sankey-beta\n"Say ""hi"", you",B,3\n"two\nlines", B ,1',
    )
    expect(sk.nodes).toEqual(['Say "hi", you', 'B', 'two\nlines'])
  })

  it('keeps a repeated pair as two links and reads partial numbers like parseFloat', () => {
    const sk = parseSankey('sankey-beta\nA,B,5\nA,B,3x\nA,C,.5\nA,D,-2')
    expect(sk.links.map((l) => l.value)).toEqual([5, 3, 0.5, -2])
  })

  it('reads the sankey init keys and drops bad values', () => {
    const sk = parseSankey(
      '%%{init: {"sankey": {"linkColor": "target", "nodeAlignment": "center", "width": 300, "height": -1, "nodeWidth": 20, "nodePadding": 5, "showValues": false, "prefix": "$", "suffix": "k", "labelStyle": "outlined", "nodeColors": {"A": "red", "B": 3}}}}%%\nsankey-beta\nA,B,1',
    )
    expect(sk.config).toEqual({
      linkColor: 'target',
      nodeAlignment: 'center',
      width: 300,
      nodeWidth: 20,
      nodePadding: 5,
      showValues: false,
      prefix: '$',
      suffix: 'k',
      labelStyle: 'outlined',
      nodeColors: { A: 'red' },
    })
    const bad = parseSankey(
      '%%{init: {"sankey": {"nodeAlignment": "middle", "labelStyle": "x", "showValues": "no", "linkColor": 1}}}%%\nsankey-beta\nA,B,1',
    )
    expect(bad.config).toEqual({})
  })

  it.each([
    ['no header', 'A,B,1', /header/],
    ['a bare header', 'sankey-beta', /new line/],
    ['a header with blank rows only', 'sankey-beta\n\n  \n', /rows/],
    ['a row on the header line', 'sankey-beta A,B,1', /new line/],
    ['trailing space after the header', 'sankey-beta \nA,B,1', /new line/],
    ['a node linked to itself', 'sankey-beta\nA,A,1', /circular link/],
    ['a cycle', 'sankey-beta\nA,B,1\nB,C,1\nC,A,1', /circular link/],
    ['an empty field', 'sankey-beta\nA,,1', /Empty field/],
    ['an empty quoted field', 'sankey-beta\n"",B,1', /Empty field/],
    ['a fourth field', 'sankey-beta\nA,B,1,2', /end of the row/],
    ['two fields', 'sankey-beta\nA,B', /Expected "," after the field/],
    ['a missing value at the end', 'sankey-beta\nA,B,', /Expected a field/],
    ['a text value', 'sankey-beta\nA,B,abc', /not a number/],
    ['an unclosed quote', 'sankey-beta\n"A,B,1', /Unclosed quote/],
    ['a non-ASCII name', 'sankey-beta\nÉcole,B,1', /Unexpected "É"/],
    ['a non-ASCII name in quotes', 'sankey-beta\n"École",B,1', /quoted field/],
    ['a stray quote', 'sankey-beta\nA"B,C,1', /Expected ","/],
    ['an accTitle line', 'sankey-beta\naccTitle: T\nA,B,1', /Expected ","/],
  ])('rejects %s, as Mermaid does', (_n, src, re) => {
    expect(() => parseSankey(src)).toThrow(re)
  })

  it('numbers the line of an error', () => {
    expect(() => parseSankey('sankey-beta\nA,B,1\nC,D')).toThrow(/Line 3/)
  })
})
