import { describe, it, expect } from 'vitest'
import { parsePieChart } from '../index.ts'

// Fixtures ported from Mermaid's own pie tests (mermaid-js/mermaid, MIT):
//   - packages/mermaid/src/diagrams/pie/pie.spec.ts (parser + pieDb)
//   - packages/parser/tests/pie.test.ts (the Langium grammar)
// Inputs are copied verbatim; assertions are translated from Mermaid's
// `db.getSections()` Map / AST shape to this package's `PieChart`. The two
// `config` cases in pie.spec.ts (`it.todo` setConfig/resetConfig, and
// getConfig defaults) test Mermaid's diagram config, not parsing, and are
// left for the follow-up that adds `%%{init: {"pie": …}}%%` support.

/** `db.getSections()` equivalent: label → value, in source order. */
const sections = (text: string): Map<string, number> =>
  new Map(parsePieChart(text).slices.map((s) => [s.label, s.value]))

describe('mermaid pie.spec.ts: parse', () => {
  it('should handle very simple pie', () => {
    expect(
      sections(`pie
      "ash": 100
      `).get('ash'),
    ).toBe(100)
  })

  it('should handle simple pie', () => {
    const s = sections(`pie
      "ash" : 60
      "bat" : 40
      `)
    expect(s.get('ash')).toBe(60)
    expect(s.get('bat')).toBe(40)
  })

  it('should handle simple pie with showData', () => {
    const chart = parsePieChart(`pie showData
      "ash" : 60
      "bat" : 40
      `)
    expect(chart.showData).toBe(true)
    expect(chart.slices).toEqual([
      { label: 'ash', value: 60 },
      { label: 'bat', value: 40 },
    ])
  })

  it('should handle simple pie with comments', () => {
    const s = sections(`pie
      %% comments
      "ash" : 60
      "bat" : 40
      `)
    expect(s.get('ash')).toBe(60)
    expect(s.get('bat')).toBe(40)
  })

  it('should handle simple pie with a title', () => {
    const chart = parsePieChart(`pie title a 60/40 pie
      "ash" : 60
      "bat" : 40
      `)
    expect(chart.title).toBe('a 60/40 pie')
    expect(chart.slices).toHaveLength(2)
  })

  it('should handle simple pie with an acc title (accTitle)', () => {
    const chart = parsePieChart(`pie title a neat chart
      accTitle: a neat acc title
      "ash" : 60
      "bat" : 40
      `)
    expect(chart.title).toBe('a neat chart')
    expect(chart.accTitle).toBe('a neat acc title')
    expect(chart.slices).toHaveLength(2)
  })

  it('should handle simple pie with an acc description (accDescr)', () => {
    const chart = parsePieChart(`pie title a neat chart
      accDescr: a neat description
      "ash" : 60
      "bat" : 40
      `)
    expect(chart.title).toBe('a neat chart')
    expect(chart.accDescr).toBe('a neat description')
    expect(chart.slices).toHaveLength(2)
  })

  it('should handle simple pie with a multiline acc description (accDescr)', () => {
    const chart = parsePieChart(`pie title a neat chart
      accDescr {
        a neat description
        on multiple lines
      }
      "ash" : 60
      "bat" : 40
    `)
    expect(chart.title).toBe('a neat chart')
    expect(chart.accDescr).toBe('a neat description\non multiple lines')
    expect(chart.slices).toHaveLength(2)
  })

  it('should handle simple pie with positive decimal', () => {
    const s = sections(`pie
      "ash" : 60.67
      "bat" : 40
      `)
    expect(s.get('ash')).toBe(60.67)
    expect(s.get('bat')).toBe(40)
  })

  it('should handle simple pie with negative decimal', () => {
    expect(() =>
      parsePieChart(`pie
        "ash" : -60.67
        "bat" : 40.12
        `),
    ).toThrow()
  })

  it('should handle simple pie with zero slice value', () => {
    const s = sections(`pie title Default text position: Animal adoption
        accTitle: simple pie char demo
        accDescr: pie chart with 3 sections: dogs, cats, rats. Most are dogs.
         "dogs" : 0
        "rats" : 40.12
      `)
    expect(s.get('dogs')).toBe(0)
    expect(s.get('rats')).toBe(40.12)
  })

  it('should handle simple pie with negative slice value', () => {
    expect(() =>
      parsePieChart(`pie title Default text position: Animal adoption
        accTitle: simple pie char demo
        accDescr: pie chart with 3 sections: dogs, cats, rats. Most are dogs.
         "dogs" : -60.67
        "rats" : 40.12
    `),
    ).toThrow(
      '"dogs" has invalid value: -60.67. Negative values are not allowed in pie charts. All slice values must be >= 0.',
    )
  })

  it('should handle unsafe properties', () => {
    const chart = parsePieChart(`pie title Unsafe props test
        "__proto__" : 386
        "constructor" : 85
        "prototype" : 15`)
    expect(chart.slices.map((s) => s.label)).toEqual([
      '__proto__',
      'constructor',
      'prototype',
    ])
  })
})

describe('mermaid parser/tests/pie.test.ts: header with or without showData', () => {
  it.each([
    `pie`,
    `  pie  `,
    `\tpie\t`,
    `
    \tpie
    `,
  ])('should handle regular pie: %j', (context) => {
    const chart = parsePieChart(context)
    expect(chart.showData).toBe(false)
    expect(chart.slices).toEqual([])
  })

  it.each([
    `pie showData`,
    `  pie  showData  `,
    `\tpie\tshowData\t`,
    `
    pie\tshowData
    `,
  ])('should handle regular showData: %j', (context) => {
    expect(parsePieChart(context).showData).toBe(true)
  })
})

describe('mermaid parser/tests/pie.test.ts: TitleAndAccessibilities', () => {
  it.each([
    `pie title sample title`,
    `  pie  title sample title  `,
    `\tpie\ttitle sample title\t`,
    `pie
        \ttitle sample title
        `,
  ])('should handle regular pie + title in same line: %j', (context) => {
    expect(parsePieChart(context).title).toBe('sample title')
  })

  it.each([
    `pie
        title sample title`,
    `pie
        title sample title
        `,
  ])('should handle regular pie + title in different line: %j', (context) => {
    expect(parsePieChart(context).title).toBe('sample title')
  })

  it.each([
    `pie showData title sample title`,
    `pie showData title sample title
        `,
  ])('should handle regular pie + showData + title: %j', (context) => {
    const chart = parsePieChart(context)
    expect(chart.showData).toBe(true)
    expect(chart.title).toBe('sample title')
  })

  it.each([
    `pie showData
        title sample title`,
    `pie showData
        title sample title
        `,
  ])(
    'should handle regular showData + title in different line: %j',
    (context) => {
      const chart = parsePieChart(context)
      expect(chart.showData).toBe(true)
      expect(chart.title).toBe('sample title')
    },
  )
})

describe('mermaid parser/tests/pie.test.ts: sections', () => {
  it.each([
    `pie
        "GitHub":100
        "GitLab":50`,
    `pie
        "GitHub"   :   100
        "GitLab"   :   50`,
    `pie
        "GitHub"\t:\t100
        "GitLab"\t:\t50`,
    `pie
        \t"GitHub" \t : \t 100
        \t"GitLab" \t : \t  50
        `,
  ])('should handle regular sections: %j', (context) => {
    expect(parsePieChart(context).slices).toEqual([
      { label: 'GitHub', value: 100 },
      { label: 'GitLab', value: 50 },
    ])
  })

  it('should handle sections with showData', () => {
    const chart = parsePieChart(`pie showData
        "GitHub": 100
        "GitLab": 50`)
    expect(chart.showData).toBe(true)
    expect(chart.slices).toEqual([
      { label: 'GitHub', value: 100 },
      { label: 'GitLab', value: 50 },
    ])
  })

  it('should handle sections with title', () => {
    const chart = parsePieChart(`pie title sample wow
        "GitHub": 100
        "GitLab": 50`)
    expect(chart.title).toBe('sample wow')
    expect(chart.slices).toHaveLength(2)
  })

  it('should handle value with positive decimal', () => {
    expect(
      parsePieChart(`pie
        "ash": 60.67
        "bat": 40`).slices,
    ).toEqual([
      { label: 'ash', value: 60.67 },
      { label: 'bat', value: 40 },
    ])
  })

  it('should handle sections with accTitle', () => {
    const chart = parsePieChart(`pie accTitle: sample wow
        "GitHub": 100
        "GitLab": 50`)
    expect(chart.accTitle).toBe('sample wow')
    expect(chart.slices).toHaveLength(2)
  })

  it('should handle sections with single line accDescr', () => {
    const chart = parsePieChart(`pie accDescr: sample wow
        "GitHub": 100
        "GitLab": 50`)
    expect(chart.accDescr).toBe('sample wow')
    expect(chart.slices).toHaveLength(2)
  })

  it('should handle sections with multi line accDescr', () => {
    const chart = parsePieChart(`pie accDescr {
            sample wow
        }
        "GitHub": 100
        "GitLab": 50`)
    expect(chart.accDescr).toBe('sample wow')
    expect(chart.slices).toHaveLength(2)
  })
})
