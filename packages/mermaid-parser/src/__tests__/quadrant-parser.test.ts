/**
 * Quadrant chart parser. Expectations follow Mermaid's own grammar and
 * quadrantDb (mermaid@12.2.0, diagrams/quadrant-chart): coordinates are
 * `1` or `0`/`0.<digits>`, styles are validated with Mermaid's messages, and
 * a class applies to a point even when it is defined after it.
 */
import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseQuadrantChart } from '../quadrant/parser.ts'

const parse = parseQuadrantChart

describe('parseQuadrantChart – structure', () => {
  it('parses Mermaid’s documented example', () => {
    const c = parse(`quadrantChart
    title Reach and engagement of campaigns
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 We should expand
    quadrant-2 Need to promote
    quadrant-3 Re-evaluate
    quadrant-4 May be improved
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]`)
    expect(c.title).toBe('Reach and engagement of campaigns')
    expect([c.xAxisLeft, c.xAxisRight]).toEqual(['Low Reach', 'High Reach'])
    expect([c.yAxisBottom, c.yAxisTop]).toEqual([
      'Low Engagement',
      'High Engagement',
    ])
    expect(c.quadrants).toEqual([
      'We should expand',
      'Need to promote',
      'Re-evaluate',
      'May be improved',
    ])
    expect(c.points).toEqual([
      { label: 'Campaign A', x: 0.3, y: 0.6 },
      { label: 'Campaign B', x: 0.45, y: 0.23 },
    ])
  })

  it('accepts a bare header', () => {
    expect(parse('quadrantChart')).toEqual({
      quadrants: ['', '', '', ''],
      points: [],
      classes: {},
    })
  })

  it('ignores blank lines, %% comments and init directives', () => {
    const c = parse(
      `%%{init: {"theme": "base"}}%%\nquadrantChart\n\n  %% a comment\n  title T %% trailing\n  A: [1, 0] %% note\n`,
    )
    expect(c.title).toBe('T')
    expect(c.points).toEqual([{ label: 'A', x: 1, y: 0 }])
  })

  it('reads CRLF source and keeps keywords case-insensitive', () => {
    const c = parse(
      'quadrantChart\r\nTITLE Hi\r\nQuadrant-2 Left\r\nX-Axis A --> B',
    )
    expect(c.title).toBe('Hi')
    expect(c.quadrants[1]).toBe('Left')
    expect(c.xAxisRight).toBe('B')
  })

  it('drops quotes (and markdown backticks) from text', () => {
    const c = parse(
      'quadrantChart\n  title "A: B"\n  quadrant-1 "`md`"\n  "Say: hi": [0.5, 0.5]',
    )
    expect(c.title).toBe('A: B')
    expect(c.quadrants[0]).toBe('md')
    expect(c.points[0]!.label).toBe('Say: hi')
  })

  it('decodes entities in labels', () => {
    expect(parse('quadrantChart\n  A#35;1: [0, 0]').points[0]!.label).toBe(
      'A#1',
    )
  })

  it('accepts accTitle / accDescr when called directly', () => {
    const c = parse(
      'quadrantChart\n  accTitle: T\n  accDescr: D\n  accDescr {\n    many\n    lines\n  }\n  title X\n  accDescr { one }\n  A: [0, 1]',
    )
    expect(c.title).toBe('X')
    expect(c.points).toHaveLength(1)
  })

  it('allows a label containing a semicolon', () => {
    expect(parse('quadrantChart\n  a;b: [0.1, 0.2]').points[0]!.label).toBe(
      'a;b',
    )
  })
})

describe('parseQuadrantChart – axes', () => {
  it('keeps a trailing arrow when nothing follows `-->`', () => {
    const c = parse('quadrantChart\n  x-axis Effort -->\n  y-axis Impact --->')
    expect(c.xAxisLeft).toBe('Effort ⟶')
    expect(c.xAxisRight).toBeUndefined()
    expect(c.yAxisBottom).toBe('Impact ⟶')
    expect(c.yAxisTop).toBeUndefined()
  })

  it('leaves a one-sided label as written', () => {
    const c = parse('quadrantChart\n  x-axis Left\n  y-axis Bottom')
    expect([c.xAxisLeft, c.xAxisRight]).toEqual(['Left', undefined])
    expect([c.yAxisBottom, c.yAxisTop]).toEqual(['Bottom', undefined])
  })

  it('rejects an axis with no label', () => {
    expect(() => parse('quadrantChart\n  x-axis')).toThrow(/Missing x-axis/)
  })
})

describe('parseQuadrantChart – coordinates', () => {
  it.each(['0', '1', '0.5', '0.00', '0.123'])('accepts %s', (v) => {
    expect(parse(`quadrantChart\n  A: [${v}, ${v}]`).points[0]!.x).toBe(
      Number(v),
    )
  })

  it.each(['1.5', '-0.2', '.5', '1.0', '2', 'a'])('rejects %s', (v) => {
    expect(() => parse(`quadrantChart\n  A: [${v}, 0.5]`)).toThrow(
      /between 0 and 1/,
    )
    expect(() => parse(`quadrantChart\n  A: [0.5, ${v}]`)).toThrow(
      /between 0 and 1/,
    )
  })
})

describe('parseQuadrantChart – styles', () => {
  it('applies inline styles', () => {
    const c = parse(
      'quadrantChart\n  B: [0.1, 1] radius: 20, color: #00ff00, stroke-color: abc, stroke-width: 3px',
    )
    expect(c.points[0]).toEqual({
      label: 'B',
      x: 0.1,
      y: 1,
      radius: 20,
      color: '#00ff00',
      strokeColor: '#abc',
      strokeWidth: '3px',
    })
  })

  it('applies a class, even one defined later, under inline styles', () => {
    const c = parse(
      'quadrantChart\n  A:::c1: [0.9, 0] radius: 3\n  B:::missing: [0, 0]\n  classDef c1 color: #ff3300, radius : 10',
    )
    expect(c.classes).toEqual({ c1: { color: '#ff3300', radius: 10 } })
    expect(c.points[0]).toMatchObject({
      className: 'c1',
      color: '#ff3300',
      radius: 3,
    })
    expect(c.points[1]).toMatchObject({ className: 'missing' })
    expect(c.points[1]!.color).toBeUndefined()
  })

  it.each([
    [
      'radius: ten',
      'value for radius ten is invalid, please use a valid number',
    ],
    ['radius: 1.5', 'value for radius 1.5 is invalid'],
    [
      'color: red',
      'value for color red is invalid, please use a valid hex code',
    ],
    ['stroke-color: #12', 'value for stroke-color #12 is invalid'],
    [
      'stroke-width: 3',
      'value for stroke-width 3 is invalid, please use a valid number of pixels',
    ],
    ['shape: square', 'style named shape is not supported.'],
  ])('rejects %s', (style, message) => {
    expect(() => parse(`quadrantChart\n  A: [0, 0] ${style}`)).toThrow(message)
    expect(() => parse(`quadrantChart\n  classDef c ${style}`)).toThrow(message)
  })

  it('skips empty style parts', () => {
    expect(
      parse('quadrantChart\n  A: [0, 0] radius: 4,').points[0]!.radius,
    ).toBe(4)
  })
})

describe('parseQuadrantChart – errors', () => {
  it('reports the line of a bad statement as a MermaidParseError', () => {
    let err: unknown
    try {
      parse('quadrantChart\n  title ok\n  what is this')
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(MermaidParseError)
    expect((err as MermaidParseError).line).toBe(3)
    expect((err as MermaidParseError).diagramType).toBe('quadrant')
    expect((err as Error).message).toMatch(/Unrecognized statement/)
  })

  it('rejects a missing or wrong header', () => {
    expect(() => parse('')).toThrow(/Expected "quadrantChart" header/)
    expect(() => parse('%% only a comment')).toThrow(/header/)
    expect(() => parse('pie\n  "A": 1')).toThrow(/Line 1/)
    expect(() => parse('QuadrantChart')).toThrow(/Line 1/)
  })
})
