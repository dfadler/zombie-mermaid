/**
 * Treemap parsing, checked against mermaid@12.3.0's Langium grammar and db
 * (the same sources were run through the real renderer to see what it accepts).
 */
import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import {
  formatTreemapValue,
  parseTreemap,
  treemapValueFormatter,
} from '../index.ts'

describe('parseTreemap', () => {
  it('nests rows by indentation and keeps leaf values', () => {
    const tm = parseTreemap(
      'treemap-beta\n"A"\n  "B": 5\n  "C"\n    "D": 1,500.5\n"E": 2',
    )
    expect(tm.roots.map((n) => n.name)).toEqual(['A', 'E'])
    const a = tm.roots[0]!
    expect(a.children!.map((n) => n.name)).toEqual(['B', 'C'])
    expect(a.children![0]!.value).toBe(5)
    expect(a.children![1]!.children![0]).toMatchObject({
      name: 'D',
      value: 1500.5,
    })
    expect(tm.roots[1]!.value).toBe(2)
    expect(tm.title).toBeUndefined()
  })

  it('accepts `treemap`, single quotes, a comma separator and blanks around it', () => {
    const tm = parseTreemap("treemap\n'R'\n  'A' , 3\n  \"B\"  :  4")
    expect(tm.roots[0]!.children!.map((n) => [n.name, n.value])).toEqual([
      ['A', 3],
      ['B', 4],
    ])
  })

  it('reads rows on the header line and skips comments and directives', () => {
    const tm = parseTreemap(
      '%%{init: {"theme": "dark"}}%%\ntreemap-beta "R"\n%% note\n  "A": 5\n',
    )
    expect(tm.roots[0]!.children).toHaveLength(1)
  })

  it('treats a leaf as closed: later deeper rows climb out of it', () => {
    const tm = parseTreemap('treemap-beta\n"R": 10\n  "A": 5')
    expect(tm.roots.map((n) => n.name)).toEqual(['R', 'A'])
  })

  it('leaves a section with no children as an empty section', () => {
    const tm = parseTreemap('treemap-beta\n"R"\n  "A"')
    expect(tm.roots[0]!.children![0]).toMatchObject({ name: 'A', children: [] })
  })

  it('reads the last title and drops its trailing comment', () => {
    const tm = parseTreemap(
      'treemap-beta\ntitle One\n"A": 1\ntitle  Two   words %% c',
    )
    expect(tm.title).toBe('Two words')
  })

  it('attaches classDef styles to nodes naming the class, wherever it is defined', () => {
    const tm = parseTreemap(
      'treemap-beta\n"R":::sec\n  "A": 50:::big\n  "B": 1:::nope\nclassDef big fill:#f96,stroke:#333;\nclassDef sec stroke-width:4px',
    )
    const r = tm.roots[0]!
    expect(r.classSelector).toBe('sec')
    expect(r.styles).toEqual([{ key: 'stroke-width', value: '4px' }])
    expect(r.children![0]!.styles).toEqual([
      { key: 'fill', value: '#f96' },
      { key: 'stroke', value: '#333' },
    ])
    expect(r.children![1]!.styles).toEqual([])
  })

  it('merges repeated classDefs and splits on escaped commas', () => {
    const tm = parseTreemap(
      'treemap-beta\n"A": 1:::cc\nclassDef cc fill:red\nclassDef cc stroke:blue;\nclassDef dd font-family:a\\,b',
    )
    expect(tm.roots[0]!.styles.map((s) => s.key)).toEqual(['fill', 'stroke'])
  })

  it.each([
    ['no header', '"A": 1', /header/],
    ['a bare word', 'treemap-beta\nA: 1', /quoted name/],
    ['a semicolon', 'treemap-beta\n"A";', /Line 2/],
    ['a negative value', 'treemap-beta\n"A": -5', /Line 2/],
    ['a missing value', 'treemap-beta\n"A":', /value/],
    ['an unreadable value', 'treemap-beta\n"A": .', /not a number/],
    ['a missing class name', 'treemap-beta\n"A": 1:::', /class name/],
    [
      'an indented trailing comment',
      'treemap-beta\n"R" %% c\n  "A": 5',
      /quoted name/,
    ],
    ['an uppercase header', 'Treemap-beta\n"A": 1', /header/],
  ])('rejects %s', (_label, src, message) => {
    expect(() => parseTreemap(src)).toThrow(MermaidParseError)
    expect(() => parseTreemap(src)).toThrow(message)
  })

  it('accepts a header alone, as Mermaid does', () => {
    expect(parseTreemap('treemap-beta\n').roots).toEqual([])
  })
})

describe('formatTreemapValue', () => {
  it.each([
    [0, '0'],
    [5, '5'],
    [1500.5, '1,500.5'],
    [1234567, '1,234,567'],
    [0.1 + 0.2, '0.3'],
    [1e21, '1e+21'],
    [1.5e21, '1.5e+21'],
  ])('formats %s as %s', (v, out) => {
    expect(formatTreemapValue(v)).toBe(out)
  })
})

describe('treemapValueFormatter (d3-format, as mermaid@12.3.0 wraps it)', () => {
  it.each([
    [undefined, 1234.5, '1,234.5'],
    ['', 1234.5, '1,234.5'],
    ['$0,0', 1234.5, '$1,234.5'],
    ['$,.2f', 1234.5, '$1.2e+3'],
    ['$.1f', 1234.5, '$1234.5'],
    ['$', 1234.5, '$1234.5'],
    ['.1%', 0.256, '25.6%'],
    ['.2p', 0.256, '26%'],
    ['.2f', 3, '3.00'],
    ['~g', 1500, '1500'],
    ['s', 0.25, '250.000m'],
    ['s', 4634.75, '4.63475k'],
    ['.3~s', 4634.75, '4.63k'],
    ['.2s', 0.00012, '120µ'],
    ['e', 1234.5, '1.234500e+3'],
    ['d', 1234.5, '1235'],
    [',d', -1234567, '−1,234,567'],
    ['+,.1f', 1234.56, '+1,234.6'],
    ['(.1f', -2.5, '(2.5)'],
    ['x', 255, 'ff'],
    ['#X', 255, '0xFF'],
    ['#b', 5, '0b101'],
    ['o', 8, '10'],
    ['c', 65, '65'],
    ['08.2f', 3.14159, '00003.14'],
    ['0,.0f', 1234, '1,234'],
    ['010,.0f', 1234, '00,001,234'],
    ['>10,.1f', 1234.5, '   1,234.5'],
    ['<10.1f', 1.5, '1.5       '],
    ['^10.1f', 1.5, '   1.5    '],
    ['=+10.1f', 1.5, '+      1.5'],
    ['*>8.1f', 1.5, '*****1.5'],
    ['n', 1234.5, '1,234.50'],
    ['r', 1234.5678, '1234.57'],
    ['.3r', 0.00012345, '0.000123'],
    ['.0f', -0.2, '0'],
    ['f', NaN, 'NaN'],
    ['zzz', 1234.5, '1,234.5'],
    ['.2', 1234.5, '1.2e+3'],
    ['r', Infinity, 'Infinity'],
    ['s', Infinity, 'Infinity'],
    ['s', 1e30, '1000000Y'],
    ['s', 1e-30, '0.000001y'],
    ['.1s', 1, '1'],
    ['.2s', 1234, '1.2k'],
    ['d', 1e21, '1000000000000000000000'],
    ['0=8.1f', 1.5, '000001.5'],
    ['#.1f', 1.5, '1.5'],
    ['$,', 1234.5, '$1,234.5'],
  ])('%j formats %s as %s', (spec, v, out) => {
    expect(treemapValueFormatter(spec)(v)).toBe(out)
  })
})

describe('parseTreemap config', () => {
  it('reads the treemap init keys from a directive', () => {
    expect(
      parseTreemap(
        '%%{init: {"treemap": {"nodeWidth": 60, "showValues": false}}}%%\ntreemap-beta\n"A": 1',
      ).config,
    ).toEqual({ nodeWidth: 60, showValues: false })
    expect(parseTreemap('treemap-beta\n"A": 1').config).toBeUndefined()
  })
})
