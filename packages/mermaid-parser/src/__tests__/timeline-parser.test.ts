/**
 * Timeline parser. Expectations follow Mermaid's own jison lexer and timelineDb
 * (mermaid@12.2.0 and 12.3.0, diagrams/timeline).
 */
import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseTimeline } from '../timeline/parser.ts'

describe('parseTimeline – structure', () => {
  it('parses periods, events and a title', () => {
    const t = parseTimeline(`timeline
    title Social media
    2002 : LinkedIn
    2004 : Facebook : Google
    2005 : YouTube`)
    expect(t.direction).toBe('LR')
    expect(t.title).toBe('Social media')
    expect(t.sections).toEqual([])
    expect(t.periods).toEqual([
      { section: '', label: '2002', events: ['LinkedIn'] },
      { section: '', label: '2004', events: ['Facebook', 'Google'] },
      { section: '', label: '2005', events: ['YouTube'] },
    ])
  })

  it('assigns periods to the section above them', () => {
    const t = parseTimeline(`timeline
    section A
      1 : x
    section B
      2 : y`)
    expect(t.sections).toEqual(['A', 'B'])
    expect(t.periods.map((p) => p.section)).toEqual(['A', 'B'])
  })

  it('adds events on continuation lines to the last period', () => {
    const t = parseTimeline('timeline\n 1776 : a\n      : b\n      : c')
    expect(t.periods[0]!.events).toEqual(['a', 'b', 'c'])
  })

  it('attaches an event after a section line to the last period of the previous section', () => {
    const t = parseTimeline('timeline\n section A\n 1\n section B\n : late')
    expect(t.periods[0]).toEqual({ section: 'A', label: '1', events: ['late'] })
  })

  it('keeps a period with no events', () => {
    expect(parseTimeline('timeline\nIron Age').periods).toEqual([
      { section: '', label: 'Iron Age', events: [] },
    ])
  })

  it('accepts a bare header', () => {
    expect(parseTimeline('timeline')).toEqual({
      direction: 'LR',
      sections: [],
      periods: [],
    })
  })

  it('reads the direction, only for LR and TD', () => {
    expect(parseTimeline('timeline TD').direction).toBe('TD')
    expect(parseTimeline('timeline LR').direction).toBe('LR')
    expect(parseTimeline('timeline td').direction).toBe('TD')
    // `TB` is not a direction: it is a period.
    const tb = parseTimeline('timeline TB')
    expect(tb.direction).toBe('LR')
    expect(tb.periods.map((p) => p.label)).toEqual(['TB'])
  })

  it('lets the last title win and drops an empty one', () => {
    expect(parseTimeline('timeline\ntitle A\ntitle B').title).toBe('B')
    expect(parseTimeline('timeline\ntitle A\ntitle  ').title).toBeUndefined()
  })

  it('stops a section name at a colon', () => {
    const t = parseTimeline('timeline\n1\nsection Early: note')
    expect(t.sections).toEqual(['Early'])
    expect(t.periods[0]!.events).toEqual(['note'])
  })
})

describe('parseTimeline – comments and text', () => {
  it('ignores %% comment lines and directives', () => {
    const t = parseTimeline(
      '%%{init: {"theme": "dark"}}%%\ntimeline\n%% note\n1 : a',
    )
    expect(t.periods).toHaveLength(1)
  })

  it('starts a comment at # even inside a period, but not inside an event', () => {
    const t = parseTimeline('timeline\nC# Language : dropped\nx : keeps # here')
    expect(t.periods[0]).toEqual({ section: '', label: 'C', events: [] })
    expect(t.periods[1]!.events).toEqual(['keeps # here'])
  })

  it('does not split on a colon without a space after it', () => {
    const t = parseTimeline('timeline\n1 : a:b : c')
    expect(t.periods[0]!.events).toEqual(['a:b', 'c'])
  })

  it('keeps semicolons and html-ish text as written', () => {
    const t = parseTimeline('timeline\ntitle a;b\n1 : x;y<br>z')
    expect(t.title).toBe('a;b')
    expect(t.periods[0]!.events).toEqual(['x;y<br>z'])
  })

  it('accepts CRLF line endings and ignores accessibility statements', () => {
    const t = parseTimeline(
      'timeline\r\naccTitle: a\r\naccDescr {\r\nmulti\r\n}\r\n1 : x',
    )
    expect(t.periods).toEqual([{ section: '', label: '1', events: ['x'] }])
  })

  it('treats keywords case-insensitively', () => {
    const t = parseTimeline('timeline\nTITLE T\nSECTION S\n1 : x')
    expect(t.title).toBe('T')
    expect(t.sections).toEqual(['S'])
  })
})

describe('parseTimeline – errors', () => {
  const fails = (src: string, msg: RegExp) => {
    let err: unknown
    try {
      parseTimeline(src)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(MermaidParseError)
    expect((err as Error).message).toMatch(msg)
  }

  it('rejects an event before any period', () => {
    fails('timeline\n: orphan', /Line 2: An event/)
  })

  it('rejects a colon with no space after it', () => {
    fails('timeline\n1:a', /Line 2: Unexpected ":"/)
  })

  it('rejects text before the header and a second header', () => {
    fails('1 : a\ntimeline', /Line 1: Expected the "timeline" header/)
    fails('timeline\ntimeline', /Line 2: Unexpected "timeline"/)
  })

  it('rejects empty input', () => {
    fails('', /Expected the "timeline" header/)
  })
})
