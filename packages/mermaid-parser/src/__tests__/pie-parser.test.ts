import { describe, it, expect } from 'vitest'
import { parsePieChart } from '../index.ts'

// The first block is lukilabs/beautiful-mermaid#151's pie-parser.test.ts
// (birenroy), adapted. Where #151 accepted something Mermaid rejects, or
// read it differently, the case now asserts Mermaid's behavior and says so.
// The strictness cases after it cover Mermaid rules #151 didn't enforce,
// several of which #150's (Daniele-rolli) parser already did.

describe('upstream #151: parsePieChart', () => {
  it('parses basic pie chart with double-quoted labels', () => {
    const chart = parsePieChart(`pie
      "Dogs" : 386
      "Cats" : 85
      "Rats" : 15`)
    expect(chart).toEqual({
      showData: false,
      slices: [
        { label: 'Dogs', value: 386 },
        { label: 'Cats', value: 85 },
        { label: 'Rats', value: 15 },
      ],
    })
  })

  it('parses title in header line: pie title <title>', () => {
    const chart = parsePieChart(`pie title Pets adopted by volunteers
      "Dogs" : 386
      "Cats" : 85`)
    expect(chart.title).toBe('Pets adopted by volunteers')
    expect(chart.showData).toBe(false)
    expect(chart.slices).toHaveLength(2)
  })

  // #151 stripped the quotes. Mermaid's title is the raw rest of the line,
  // so the quotes are part of it.
  it('keeps quotes in a quoted title, as Mermaid does', () => {
    const chart = parsePieChart(`pie title "Pets adopted by volunteers"
      "Dogs" : 386`)
    expect(chart.title).toBe('"Pets adopted by volunteers"')
  })

  it('parses standalone title directive', () => {
    const chart = parsePieChart(`pie
      title Key Elements in Product X
      "Calcium" : 42.96
      "Potassium" : 50.05`)
    expect(chart.title).toBe('Key Elements in Product X')
    expect(chart.slices).toHaveLength(2)
    expect(chart.slices[0]!.value).toBe(42.96)
  })

  it('parses showData on the header line', () => {
    const chart = parsePieChart(`pie showData title Key elements
      "Calcium" : 42.96
      "Potassium" : 50.05`)
    expect(chart.showData).toBe(true)
    expect(chart.title).toBe('Key elements')
  })

  // #151 accepted a standalone `showData` line. Mermaid's grammar only
  // allows it directly after `pie`.
  it('rejects showData on its own line', () => {
    expect(() =>
      parsePieChart(`pie
      showData
      title Elements
      "A" : 10`),
    ).toThrow(/Line 2: .*showData is only allowed directly after "pie"/)
  })

  it('parses single-quoted labels', () => {
    const chart = parsePieChart(`pie
      'Calcium' : 42.96
      "Magnesium" : 10.01`)
    expect(chart.slices).toEqual([
      { label: 'Calcium', value: 42.96 },
      { label: 'Magnesium', value: 10.01 },
    ])
  })

  // #151 accepted unquoted labels. Mermaid requires quotes.
  it('rejects unquoted slice labels', () => {
    expect(() =>
      parsePieChart(`pie
      Potassium : 50.05`),
    ).toThrow(/Line 2: .*slice labels must be quoted/)
  })

  it('parses quoted labels containing colons', () => {
    const chart = parsePieChart(`pie
      "Ratio 1:2" : 30
      "Ratio 2:3" : 70`)
    expect(chart.slices).toEqual([
      { label: 'Ratio 1:2', value: 30 },
      { label: 'Ratio 2:3', value: 70 },
    ])
  })

  it('ignores comments and empty lines', () => {
    const chart = parsePieChart(`pie
      %% This is a comment
      "Slice A" : 10

      %% Another comment
      "Slice B" : 20`)
    expect(chart.slices).toHaveLength(2)
  })

  it('does not read "showdata" inside a title as the showData flag', () => {
    const chart = parsePieChart(`pie title How to showdata properly
      "A" : 10`)
    expect(chart.showData).toBe(false)
    expect(chart.title).toBe('How to showdata properly')
  })

  // #151 accepted `title: …`. In Mermaid's grammar `title` must be followed
  // by whitespace, so the colon is a syntax error.
  it('rejects title: with a colon', () => {
    expect(() =>
      parsePieChart(`pie
      title: My Chart
      "A" : 10`),
    ).toThrow(/Line 2: /)
  })

  // #151 dropped accTitle/accDescr. They are now kept.
  it('keeps accTitle and accDescr alongside the slices', () => {
    const chart = parsePieChart(`pie title Accessibility Chart
      accTitle: 2024 Chart
      accDescr: An accessibility description
      "A" : 10
      "B" : 20`)
    expect(chart).toEqual({
      title: 'Accessibility Chart',
      accTitle: '2024 Chart',
      accDescr: 'An accessibility description',
      showData: false,
      slices: [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 },
      ],
    })
  })
})

describe('Mermaid docs examples', () => {
  it('parses the basic example', () => {
    const chart = parsePieChart(`pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`)
    expect(chart.title).toBe('Pets adopted by volunteers')
    expect(chart.slices.map((s) => s.label)).toEqual(['Dogs', 'Cats', 'Rats'])
  })

  it('parses the showData example body', () => {
    const chart = parsePieChart(`pie showData
    title Key elements in Product X
    "Calcium" : 42.96
    "Potassium" : 50.05
    "Magnesium" : 10.01
    "Iron" :  5`)
    expect(chart.showData).toBe(true)
    expect(chart.title).toBe('Key elements in Product X')
    expect(chart.slices.map((s) => s.value)).toEqual([42.96, 50.05, 10.01, 5])
  })
})

describe('values', () => {
  it("rejects a negative value with Mermaid's message and the line number", () => {
    expect(() => parsePieChart('pie\n"A" : 1\n"B" : -2')).toThrow(
      'Line 3: "B" has invalid value: -2. Negative values are not allowed in pie charts. All slice values must be >= 0.',
    )
  })

  it('rejects a negative value even when its label repeats an earlier one', () => {
    expect(() => parsePieChart('pie\n"A" : 1\n"A" : -2')).toThrow(
      /"A" has invalid value: -2/,
    )
  })

  it('reports a syntax error before a negative value earlier in the chart', () => {
    expect(() => parsePieChart('pie\n"A" : -1\nnonsense')).toThrow(/^Line 3: /)
  })

  it('accepts zero', () => {
    expect(parsePieChart('pie\n"A" : 0\n"B" : 1').slices).toEqual([
      { label: 'A', value: 0 },
      { label: 'B', value: 1 },
    ])
  })

  it('accepts -0 (Mermaid only rejects values < 0) and stores it as 0', () => {
    const [slice] = parsePieChart('pie\n"A" : -0').slices
    expect(Object.is(slice!.value, 0)).toBe(true)
  })

  it('accepts any number of decimal places and leading zeros before a decimal point', () => {
    expect(parsePieChart('pie\n"A" : 1.23456\n"B" : 00.5').slices).toEqual([
      { label: 'A', value: 1.23456 },
      { label: 'B', value: 0.5 },
    ])
  })

  it.each([
    ['a plus sign', '+5'],
    ['a plus sign on a decimal', '+5.5'],
    ['a leading dot', '.5'],
    ['a trailing dot', '5.'],
    ['an exponent', '1e3'],
    ['a leading zero on an integer', '05'],
    ['two dots', '1.2.3'],
    ['a unit suffix', '10px'],
    ['a word', 'ten'],
    ['a space after the minus', '- 5'],
  ])('rejects a value with %s (%s)', (_name, value) => {
    expect(() => parsePieChart(`pie\n"A" : ${value}`)).toThrow(/^Line 2: /)
  })

  it('rejects a slice with no value', () => {
    expect(() => parsePieChart('pie\n"A" :')).toThrow(/expected a number/)
    expect(() => parsePieChart('pie\n"A" : \n"B" : 1')).toThrow(
      /Line 2: .*expected a number/,
    )
  })

  it('rejects a slice with no colon', () => {
    expect(() => parsePieChart('pie\n"A" 10')).toThrow(
      /Line 2: .*expected ":" after the slice label/,
    )
  })
})

describe('labels', () => {
  it('keeps the first value of a repeated label, in its original position', () => {
    expect(parsePieChart('pie\n"A" : 1\n"B" : 2\n"A" : 3').slices).toEqual([
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ])
  })

  it('keeps slices in source order rather than sorting them', () => {
    expect(
      parsePieChart('pie\n"small" : 1\n"big" : 100\n"mid" : 10').slices.map(
        (s) => s.label,
      ),
    ).toEqual(['small', 'big', 'mid'])
  })

  it('resolves backslash escapes the way Langium does', () => {
    expect(
      parsePieChart(String.raw`pie
"say \"hi\"" : 1
'it\'s' : 2
"tab\there" : 3`).slices.map((s) => s.label),
    ).toEqual(['say "hi"', "it's", 'tab\there'])
  })

  // Langium's convertEscapeCharacter maps exactly these seven letters; any
  // other escaped character stands for itself. Checked against
  // @mermaid-js/parser 2.0.1, which turns
  // "b\bf\fn\nr\rt\tv\v0\0q\"z\z" into "b\bf\fn\nr\rt\tv\u000b0\u0000q\"zz".
  it.each([
    ['\\b', '\b'],
    ['\\f', '\f'],
    ['\\n', '\n'],
    ['\\r', '\r'],
    ['\\t', '\t'],
    ['\\v', '\v'],
    ['\\0', '\0'],
    ['\\z', 'z'],
    ['\\\\', '\\'],
  ])('resolves the %s escape in a label', (escape, resolved) => {
    expect(parsePieChart(`pie\n"a${escape}b" : 1`).slices).toEqual([
      { label: `a${resolved}b`, value: 1 },
    ])
  })

  it('keeps the other quote character literally', () => {
    expect(
      parsePieChart(`pie\n"it's" : 1\n'say "hi"' : 2`).slices.map(
        (s) => s.label,
      ),
    ).toEqual(["it's", 'say "hi"'])
  })

  it('keeps surrounding spaces and allows an empty label', () => {
    expect(
      parsePieChart('pie\n" padded " : 1\n"" : 2').slices.map((s) => s.label),
    ).toEqual([' padded ', ''])
  })

  it('treats ; and %% inside a label as text', () => {
    expect(
      parsePieChart('pie\n"a; b" : 1\n"50%% off" : 2').slices.map(
        (s) => s.label,
      ),
    ).toEqual(['a; b', '50%% off'])
  })

  it('accepts a quoted label that spans lines, as the grammar does', () => {
    const chart = parsePieChart('pie\n"two\nlines" : 1\n"B" : 2')
    expect(chart.slices[0]!.label).toBe('two\nlines')
  })

  it('rejects an unterminated quoted label', () => {
    expect(() => parsePieChart('pie\n"A : 1')).toThrow(
      /Line 2: Unterminated quoted label/,
    )
  })
})

describe('statements and structure', () => {
  it('accepts a bare pie with no slices (Mermaid renders an empty chart)', () => {
    expect(parsePieChart('pie')).toEqual({ showData: false, slices: [] })
    expect(parsePieChart('pie title Nothing yet')).toEqual({
      title: 'Nothing yet',
      showData: false,
      slices: [],
    })
  })

  it('accepts a slice on the header line, as the grammar does', () => {
    expect(parsePieChart('pie "A" : 1\n"B" : 2').slices).toHaveLength(2)
  })

  it('rejects two statements on one line', () => {
    expect(() => parsePieChart('pie\n"A" : 1 "B" : 2')).toThrow(
      /Line 2: .*expected end of line after the slice value/,
    )
  })

  it('does not treat ; as a statement separator', () => {
    expect(() => parsePieChart('pie\n"A" : 1; "B" : 2')).toThrow(/Line 2: /)
    expect(() => parsePieChart('pie;"A" : 1')).toThrow(/Line 1: /)
  })

  it('keeps ; in a title, which runs to the end of the line', () => {
    expect(parsePieChart('pie title A; B').title).toBe('A; B')
  })

  it('rejects unknown statements', () => {
    expect(() => parsePieChart('pie\n"A" : 1\nnonsense here')).toThrow(
      /Line 3: Unrecognized statement.*"nonsense here"/,
    )
  })

  it('rejects unknown header modifiers', () => {
    expect(() => parsePieChart('pie banana\n"A" : 1')).toThrow(/Line 1: /)
  })

  it('rejects a second pie header', () => {
    expect(() => parsePieChart('pie\npie')).toThrow(
      /Line 2: .*may only appear once/,
    )
  })

  it('rejects input that does not start with pie', () => {
    expect(() => parsePieChart('"A" : 1')).toThrow(/expected the "pie" header/)
    expect(() => parsePieChart('')).toThrow(/expected the "pie" header/)
  })

  it('allows blank lines and comments before the header', () => {
    expect(parsePieChart('\n%% note\n  \npie\n"A" : 1').slices).toHaveLength(1)
  })

  it('matches keywords case-sensitively', () => {
    expect(() => parsePieChart('Pie\n"A" : 1')).toThrow()
    expect(() => parsePieChart('pie showdata\n"A" : 1')).toThrow()
    expect(() => parsePieChart('pie\nTitle X')).toThrow()
    expect(() => parsePieChart('pie\naccdescr: X')).toThrow()
  })

  it('requires whitespace after the pie and showData keywords', () => {
    expect(() => parsePieChart('pieshowData')).toThrow()
    expect(() => parsePieChart('pie showDatatitle X')).toThrow()
  })

  it('allows a comment directly after a keyword', () => {
    expect(parsePieChart('pie%% c\n"A" : 1').slices).toHaveLength(1)
    expect(parsePieChart('pie showData%% c\n"A" : 1').showData).toBe(true)
  })

  it('accepts CRLF line endings', () => {
    expect(
      parsePieChart('pie title T\r\n"A" : 1\r\n"B" : 2\r\n').slices,
    ).toHaveLength(2)
  })

  it('skips %%{init}%% directives, including multi-line ones', () => {
    const chart = parsePieChart(
      '%%{init: {"pie": {"textPosition": 0.5}}}%%\npie\n%%{\n  init: {}\n}%%\n"A" : 1',
    )
    expect(chart.slices).toEqual([{ label: 'A', value: 1 }])
  })

  it('reports physical line numbers across a multi-line directive', () => {
    expect(() => parsePieChart('%%{\ninit: {}\n}%%\npie\nbad')).toThrow(
      /^Line 5: /,
    )
  })
})

describe('title and accessibility', () => {
  it('strips a trailing %% comment from title/accTitle/accDescr', () => {
    const chart = parsePieChart(`pie
title My title %% note
accTitle: Acc %% note
accDescr: Desc %% note`)
    expect(chart.title).toBe('My title')
    expect(chart.accTitle).toBe('Acc')
    expect(chart.accDescr).toBe('Desc')
  })

  it('strips a comment even after an apostrophe in the title', () => {
    expect(parsePieChart("pie title Bob's pets %% note").title).toBe(
      "Bob's pets",
    )
  })

  it('collapses runs of spaces and tabs', () => {
    expect(parsePieChart('pie title a  \t b').title).toBe('a b')
  })

  it('lets the last title win, and treats an empty title as unset', () => {
    expect(parsePieChart('pie title A\ntitle B').title).toBe('B')
    expect(parsePieChart('pie title A\ntitle').title).toBeUndefined()
  })

  it('treats empty accTitle/accDescr as unset', () => {
    const chart = parsePieChart('pie\naccTitle:\naccDescr {}')
    expect(chart.accTitle).toBeUndefined()
    expect(chart.accDescr).toBeUndefined()
  })

  it('accepts accTitle/accDescr with space before the colon', () => {
    const chart = parsePieChart('pie\naccTitle : T\naccDescr : D')
    expect(chart.accTitle).toBe('T')
    expect(chart.accDescr).toBe('D')
  })

  it('rejects accTitle without a colon', () => {
    expect(() => parsePieChart('pie\naccTitle T')).toThrow(/Line 2: /)
  })

  it('rejects text after a multi-line accDescr block on the same line', () => {
    expect(() => parsePieChart('pie\naccDescr {\n  d\n} "A" : 1')).toThrow(
      /Line 4: .*expected end of line after accDescr/,
    )
  })
})
