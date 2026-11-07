/**
 * Gantt parser and date helpers. Expected values are what mermaid@12.3.0
 * produces for the same sources (checked with scripts/gantt-oracle.ts), so
 * dates are UTC milliseconds of the dates the sources name.
 */
import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import {
  addDuration,
  formatD3Time,
  formatDayjs,
  isExcludedDate,
  parseDayjs,
  parseGantt,
  timeTicks,
} from '../index.ts'

const NOW = new Date(Date.UTC(2024, 5, 15, 12))
const D = (s: string) => Date.parse(`${s}T00:00:00Z`)
const parse = (src: string) => parseGantt(`gantt\n${src}`, NOW)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16)

describe('parseGantt: statements', () => {
  it('reads titles, formats, flags and lists', () => {
    const c = parse(`  title  Plan
  dateFormat YYYY-MM-DD
  axisFormat  %b %d
  tickInterval 2day
  todayMarker stroke-width:5px,stroke:#0f0
  inclusiveEndDates
  topAxis
  excludes weekends, Monday 2024-01-03
  includes 2024-01-06
  weekday monday
  weekend friday
  section S1
  A :a1, 2024-01-01, 2d`)
    expect(c).toMatchObject({
      title: 'Plan',
      dateFormat: 'YYYY-MM-DD',
      axisFormat: ' %b %d',
      tickInterval: { every: 2, unit: 'day' },
      todayMarker: 'stroke-width:5px,stroke:#0f0',
      inclusiveEndDates: true,
      topAxis: true,
      excludes: ['weekends', 'monday', '2024-01-03'],
      includes: ['2024-01-06'],
      weekday: 'monday',
      weekend: 'friday',
      sections: ['S1'],
    })
  })

  it('ignores a bad tickInterval, comments, accessibility lines and directives', () => {
    const c = parse(`  tickInterval 0day
  %% a comment
  accTitle: T
  accDescr { one
  two }
  %%{init: {"theme": "dark"}}%%
  %%{init:
    {"x": 1}
  }%%
  dateFormat YYYY-MM-DD
  A :a, 2024-01-01, 1d`)
    expect(c.tickInterval).toBeUndefined()
    expect(c.tasks).toHaveLength(1)
  })

  it('reads gantt config from an init directive', () => {
    const c = parseGantt(
      `%%{init: {'gantt': {'displayMode': 'compact', 'topAxis': true, 'axisFormat': '%d', 'weekday': 'tuesday', 'tickInterval': '1week'}}}%%
gantt
dateFormat YYYY-MM-DD
A :a, 2024-01-01, 1d`,
      NOW,
    )
    expect(c).toMatchObject({
      displayMode: 'compact',
      topAxis: true,
      axisFormat: '%d',
      weekday: 'tuesday',
      tickInterval: { every: 1, unit: 'week' },
    })
    const own = parseGantt(
      `%%{init: {"gantt": {"axisFormat": "%d", "tickInterval": "1week"}}}%%
gantt
axisFormat %m
tickInterval 1day
dateFormat YYYY-MM-DD
A :a, 2024-01-01, 1d`,
      NOW,
    )
    expect(own.axisFormat).toBe('%m')
    expect(own.tickInterval).toEqual({ every: 1, unit: 'day' })
    // Not JSON, no gantt block, bad values
    for (const bad of [
      '%%{init: nope}%%',
      '%%{init: {"gantt": 3}}%%',
      '%%{init: {"gantt": {"weekday": "x", "tickInterval": "0day"}}}%%',
    ]) {
      expect(parseGantt(`${bad}\ngantt\n`, NOW).weekday).toBe('sunday')
    }
  })

  it('accepts a bare header and case-insensitive keywords', () => {
    expect(parseGantt('gantt', NOW).tasks).toEqual([])
    const c = parse(
      'TITLE Hi\nDATEFORMAT YYYY-MM-DD\nSECTION X\nA :a, 2024-01-01, 1d',
    )
    expect(c.title).toBe('Hi')
    expect(c.sections).toEqual(['X'])
  })

  it('rejects a missing header and unreadable lines', () => {
    expect(() => parseGantt('pie\n', NOW)).toThrow(MermaidParseError)
    expect(() => parseGantt('', NOW)).toThrow(/gantt/)
    expect(() => parse('just words')).toThrow(/Line 2/)
    expect(() => parse(' : a, 2024-01-01, 1d')).toThrow(MermaidParseError)
    expect(() => parse('A :a, b, c, d')).toThrow(/one to three/)
    expect(() => parse('click')).toThrow(MermaidParseError)
    expect(() => parse('A :x')).toThrow(/no task before/)
  })
})

describe('parseGantt: scheduling', () => {
  const fmt = 'dateFormat YYYY-MM-DD\n'

  it('reads the one-, two- and three-part forms', () => {
    const c = parse(`${fmt}
  section S
  one :a, 2024-01-01, 2d
  two :2024-01-10, 2024-01-12
  three :after a, 3d
  four :t4, after a task2, 1w
  five :3h`)
    const [a, two, three, four, five] = c.tasks
    expect(iso(a!.start)).toBe('2024-01-01T00:00')
    expect(iso(a!.end)).toBe('2024-01-03T00:00')
    expect(a!.section).toBe('S')
    expect(a!.id).toBe('a')
    expect(two!.id).toBe('task1')
    expect(iso(two!.end)).toBe('2024-01-12T00:00')
    expect(iso(three!.start)).toBe('2024-01-03T00:00')
    expect(iso(four!.start)).toBe('2024-01-06T00:00')
    expect(iso(four!.end)).toBe('2024-01-13T00:00')
    expect(four!.id).toBe('t4')
    expect(iso(five!.start)).toBe('2024-01-13T00:00')
    expect(iso(five!.end)).toBe('2024-01-13T03:00')
  })

  it('reads tags in any order and orders vert markers out of the rows', () => {
    const c = parse(`${fmt}
  A :done, crit, a, 2024-01-01, 1d
  B :active, milestone, b, 2024-01-02, 0d
  C :vert, v, 2024-01-03, 0d
  D :d, 2024-01-04, 1d`)
    expect(
      c.tasks.map((t) => [
        t.done,
        t.crit,
        t.active,
        t.milestone,
        t.vert,
        t.order,
      ]),
    ).toEqual([
      [true, true, false, false, false, 0],
      [false, false, true, true, false, 1],
      [false, false, false, false, true, -1],
      [false, false, false, false, false, 2],
    ])
  })

  it('resolves references to tasks defined later, and until', () => {
    const c = parse(`${fmt}
  A :a, after b, 1d
  B :b, 2024-02-01, 2d
  C :c, 2024-01-01, until b`)
    expect(iso(c.tasks[0]!.start)).toBe('2024-02-03T00:00')
    expect(iso(c.tasks[2]!.end)).toBe('2024-02-01T00:00')
  })

  it('falls back to today for unknown ids, and rejects a cycle', () => {
    const c = parse(`${fmt}
  A :a, after zzz, 1d
  B :b, 2024-01-01, until yyy`)
    expect(iso(c.tasks[0]!.start)).toBe('2024-06-15T00:00')
    expect(iso(c.tasks[1]!.end)).toBe('2024-06-15T00:00')
    expect(() => parse(`${fmt}A :a, after b, 1d\nB :b, after a, 1d`)).toThrow(
      /could not be scheduled/,
    )
  })

  it('ignores an unreadable end, honours inclusive end dates, and reads unix timestamps', () => {
    const c = parse(`${fmt}A :a, 2024-01-01, nonsense`)
    expect(c.tasks[0]!.end).toBe(c.tasks[0]!.start)
    const inc = parse(`${fmt}inclusiveEndDates\nA :a, 2024-01-01, 2024-01-02`)
    expect(iso(inc.tasks[0]!.end)).toBe('2024-01-03T00:00')
    const x = parse('dateFormat X\nA :a, 1700000000, 3600s')
    expect(x.tasks[0]!.start).toBe(1700000000)
    expect(x.tasks[0]!.end).toBe(1700000000 + 3_600_000)
  })

  it('falls back to Date for dates that do not match dateFormat, or throws', () => {
    const c = parse(`${fmt}A :a, 2024/01/05, 1d`)
    expect(new Date(c.tasks[0]!.start).getFullYear()).toBe(2024)
    expect(() => parse(`${fmt}A :a, not-a-date, 1d`)).toThrow(/Invalid date/)
    const bare = parse('A :a, 2024-01-05, 1d')
    expect(iso(bare.tasks[0]!.start)).toBe('2024-01-05T00:00')
    expect(() => parse('A :a, zzz, 1d')).toThrow(/Invalid date/)
  })

  it('stretches tasks over excluded days, but not a literal end date', () => {
    const c = parse(`${fmt}excludes weekends
  A :a, 2024-01-04, 3d
  B :b, 2024-01-04, 2024-01-08`)
    // Thu 4th + 3d crosses Sat/Sun
    expect(iso(c.tasks[0]!.end)).toBe('2024-01-09T00:00')
    expect(iso(c.tasks[0]!.renderEnd!)).toBe('2024-01-09T00:00')
    expect(iso(c.tasks[1]!.end)).toBe('2024-01-08T00:00')
    expect(c.tasks[1]!.renderEnd).toBeNull()
  })

  it('applies weekday, date, includes and weekend settings', () => {
    const c = parse(`${fmt}excludes weekends monday 2024-01-10
  includes 2024-01-06
  weekend friday`)
    expect(isExcludedDate(c, D('2024-01-05'))).toBe(true) // Friday
    expect(isExcludedDate(c, D('2024-01-06'))).toBe(false) // Included back
    expect(isExcludedDate(c, D('2024-01-07'))).toBe(false) // Sunday: not a weekend here
    expect(isExcludedDate(c, D('2024-01-08'))).toBe(true) // Monday
    expect(isExcludedDate(c, D('2024-01-10'))).toBe(true) // Listed date
    expect(isExcludedDate(c, D('2024-01-09'))).toBe(false)
  })

  it('gives up when no day is ever valid', () => {
    expect(() =>
      parse(
        `${fmt}excludes monday tuesday wednesday thursday friday saturday sunday\nA :a, 2024-01-01, 1d`,
      ),
    ).toThrow(/10,000/)
  })

  it('marks clicked tasks and keeps hrefs', () => {
    const c = parse(`${fmt}A :a, 2024-01-01, 1d
  B :b, 2024-01-02, 1d
  click a href "https://x.test"
  click a,b call fn(1)
  click zz href "https://y.test"`)
    expect(c.tasks[0]).toMatchObject({
      link: 'https://x.test',
      classes: ['clickable'],
    })
    expect(c.tasks[1]!.classes).toEqual(['clickable'])
    expect(c.tasks[1]!.link).toBeUndefined()
  })

  it('decodes entities in titles, sections and labels', () => {
    const c = parse(
      `${fmt}title a #35; b\nsection s #35; t\nx #35; y :a, 2024-01-01, 1d`,
    )
    expect(c.title).toBe('a # b')
    expect(c.sections).toEqual(['s # t'])
    expect(c.tasks[0]!.label).toBe('x # y')
  })

  it('treats an empty dateFormat as native parsing', () => {
    const c = parse('A :a, 2024-01-05, 1d')
    expect(iso(c.tasks[0]!.end)).toBe('2024-01-06T00:00')
  })
})

describe('dayjs helpers', () => {
  it('parses strictly', () => {
    expect(iso(parseDayjs('2024-02-29', 'YYYY-MM-DD')!)).toBe(
      '2024-02-29T00:00',
    )
    expect(parseDayjs('2023-02-29', 'YYYY-MM-DD')).toBeUndefined()
    expect(parseDayjs('2024-1-05', 'YYYY-MM-DD')).toBeUndefined()
    expect(parseDayjs('2024-13-05', 'YYYY-MM-DD')).toBeUndefined()
    expect(parseDayjs('2024-01-05 25:00', 'YYYY-MM-DD HH:mm')).toBeUndefined()
    expect(parseDayjs('x', 'Q')).toBeUndefined()
  })

  it('supports the common tokens', () => {
    const p = (s: string, f: string) => iso(parseDayjs(s, f, NOW)!)
    expect(p('5/1/24', 'D/M/YY')).toBe('2024-01-05T00:00')
    expect(p('5/1/99', 'D/M/YY')).toBe('1999-01-05T00:00')
    expect(p('Jan 5, 2024', 'MMM D, YYYY')).toBe('2024-01-05T00:00')
    expect(p('March 3 2024', 'MMMM D YYYY')).toBe('2024-03-03T00:00')
    expect(p('5th 2024-02', 'Do YYYY-MM')).toBe('2024-02-05T00:00')
    expect(p('2024-01-05 03:04:05.006 PM', 'YYYY-MM-DD hh:mm:ss.SSS A')).toBe(
      '2024-01-05T15:04',
    )
    expect(p('2024-01-05 12 am', 'YYYY-MM-DD h a')).toBe('2024-01-05T00:00')
    expect(p('17:49', 'HH:mm')).toBe('2024-06-15T17:49')
    expect(p('2024', 'YYYY')).toBe('2024-01-01T00:00')
    expect(p('06', 'MM')).toBe('2024-06-01T00:00')
    expect(p('2024-01-05 +02:00', 'YYYY-MM-DD Z')).toBe('2024-01-04T22:00')
    expect(p('2024-01-05 -0130', 'YYYY-MM-DD ZZ')).toBe('2024-01-05T01:30')
    expect(p('2024-01-05 Z', 'YYYY-MM-DD Z')).toBe('2024-01-05T00:00')
    expect(parseDayjs('1700000000', 'X', NOW)).toBe(1_700_000_000_000)
    expect(parseDayjs('1700000000000', 'x', NOW)).toBe(1_700_000_000_000)
    expect(p('at 2024', '[at] YYYY')).toBe('2024-01-01T00:00')
  })

  it('formats tokens', () => {
    const t = Date.UTC(2024, 0, 5, 15, 4, 5, 6)
    expect(
      formatDayjs(
        t,
        'YYYY YY MMMM MMM MM M DD D Do HH H hh h mm m ss s SSS A a Z ZZ [x] Q',
      ),
    ).toBe(
      '2024 24 January Jan 01 1 05 5 5th 15 15 03 3 04 4 05 5 006 PM pm +00:00 +0000 x Q',
    )
    expect(formatDayjs(t, 'X x')).toBe(`${Math.floor(t / 1000)} ${t}`)
    expect(formatDayjs(Date.UTC(2024, 0, 1, 0), 'h A')).toBe('12 AM')
    expect(formatDayjs(Date.UTC(2024, 0, 22), 'Do')).toBe('22nd')
    expect(formatDayjs(Date.UTC(2024, 0, 3), 'Do')).toBe('3rd')
    expect(formatDayjs(Date.UTC(2024, 0, 11), 'Do')).toBe('11th')
  })

  it('adds durations by calendar and clock units', () => {
    const t = D('2024-01-31')
    expect(iso(addDuration(t, 1, 'M'))).toBe('2024-02-29T00:00')
    expect(iso(addDuration(t, 1, 'y'))).toBe('2025-01-31T00:00')
    expect(iso(addDuration(D('2024-02-29'), 1, 'y'))).toBe('2025-02-28T00:00')
    expect(iso(addDuration(D('2024-02-29'), 4, 'y'))).toBe('2028-02-29T00:00')
    expect(iso(addDuration(t, 1, 'w'))).toBe('2024-02-07T00:00')
    expect(iso(addDuration(t, 1.5, 'd'))).toBe('2024-02-02T00:00')
    expect(iso(addDuration(t, 90, 'm'))).toBe('2024-01-31T01:30')
    expect(addDuration(0, 2, 's')).toBe(2000)
    expect(addDuration(0, 1.5, 'h')).toBe(5_400_000)
    expect(addDuration(0, 7, 'ms')).toBe(7)
  })
})

describe('formatD3Time', () => {
  const t = Date.UTC(2024, 0, 5, 15, 4, 5, 6) // Friday, week 1
  it('formats the directives', () => {
    expect(
      formatD3Time(
        t,
        '%a %A %b %B %h|%d %e %-d %_d %0d|%H %I %M %S %L %f|%p %j %m|%y %Y %Z %%',
      ),
    ).toBe(
      'Fri Friday Jan January Jan|05  5 5  5 05|15 03 04 05 006 006000|PM 005 01|24 2024 +0000 %',
    )
    expect(formatD3Time(t, '%u %w %U %W %V %g %G %q %Q %s')).toBe(
      `5 5 00 01 01 24 2024 1 ${t} ${Math.floor(t / 1000)}`,
    )
    expect(formatD3Time(t, '%x|%X|%c')).toBe(
      '01/05/2024|15:04:05|Fri Jan  5 15:04:05 2024',
    )
    expect(formatD3Time(Date.UTC(2024, 11, 30), '%V %G %g')).toBe('01 2025 25')
    expect(formatD3Time(Date.UTC(2024, 0, 1, 0), '%I')).toBe('12')
    expect(formatD3Time(t, 'plain %')).toBe('plain ')
    expect(formatD3Time(t, '%E')).toBe('%E')
    expect(formatD3Time(t, '%-E')).toBe('%-E')
  })
})

describe('timeTicks', () => {
  const ticks = (
    a: string,
    b: string,
    ...rest: Parameters<typeof timeTicks> extends [number, number, ...infer R]
      ? R
      : never
  ) =>
    timeTicks(Date.parse(a + 'Z'), Date.parse(b + 'Z'), ...rest).map((x) =>
      new Date(x).toISOString().slice(0, 16),
    )

  it('picks d3 nice intervals', () => {
    expect(ticks('2014-01-06', '2014-01-28')).toHaveLength(11) // 2-day, odd dates
    expect(ticks('2014-01-06', '2014-01-28')[0]).toBe('2014-01-07T00:00')
    expect(ticks('2024-01-01T17:49', '2024-01-01T18:12')[0]).toBe(
      '2024-01-01T17:50',
    )
    expect(ticks('2024-01-01T00:00:00', '2024-01-01T00:00:30')[0]).toBe(
      '2024-01-01T00:00',
    )
    expect(ticks('2024-01-01', '2024-04-10')[0]).toBe('2024-01-07T00:00') // Weeks, from Sunday
    expect(ticks('2024-01-01', '2024-12-31').length).toBeGreaterThan(3) // Months
    expect(ticks('2020-01-01', '2024-12-31')).toContain('2022-01-01T00:00') // Years
    expect(ticks('1990-01-01', '2024-12-31').length).toBeGreaterThan(3) // Year steps
    expect(timeTicks(0, 5)).toEqual([0, 1, 2, 3, 4, 5]) // sub-second
  })

  it('honours tickInterval and weekday', () => {
    expect(
      ticks('2024-01-01', '2024-01-20', { every: 1, unit: 'week' }),
    ).toEqual(['2024-01-07T00:00', '2024-01-14T00:00'])
    expect(
      ticks('2024-01-01', '2024-01-20', { every: 1, unit: 'week' }, 'monday'),
    ).toEqual(['2024-01-01T00:00', '2024-01-08T00:00', '2024-01-15T00:00'])
    expect(
      ticks('2024-01-01', '2024-01-10', { every: 3, unit: 'day' }),
    ).toEqual([
      '2024-01-01T00:00',
      '2024-01-04T00:00',
      '2024-01-07T00:00',
      '2024-01-10T00:00',
    ])
    expect(
      ticks('2024-01-01', '2024-06-01', { every: 2, unit: 'month' }),
    ).toEqual(['2024-01-01T00:00', '2024-03-01T00:00', '2024-05-01T00:00'])
    expect(
      ticks('2024-01-01T00:00', '2024-01-01T05:00', { every: 2, unit: 'hour' }),
    ).toHaveLength(3)
    expect(
      ticks('2024-01-01T00:00', '2024-01-01T00:20', {
        every: 10,
        unit: 'minute',
      }),
    ).toHaveLength(3)
    expect(
      ticks('2024-01-01T00:00:00', '2024-01-01T00:00:20', {
        every: 10,
        unit: 'second',
      }),
    ).toHaveLength(3)
    expect(timeTicks(0, 10, { every: 5, unit: 'millisecond' })).toEqual([
      0, 5, 10,
    ])
    expect(
      ticks(
        '2024-01-01',
        '2024-01-20',
        { every: 1, unit: 'week' },
        'saturday',
      )[0],
    ).toBe('2024-01-06T00:00')
    expect(
      ticks('2024-01-01', '2024-01-22', { every: 2, unit: 'week' }, 'monday')
        .length,
    ).toBe(2)
  })
})

describe('gantt parser: review fixes', () => {
  const fmt = 'dateFormat YYYY-MM-DD\n'

  it('rejects 12-hour values outside 1-12', () => {
    expect(parseDayjs('2024-01-05 13 PM', 'YYYY-MM-DD hh A')).toBeUndefined()
    expect(parseDayjs('2024-01-05 00 AM', 'YYYY-MM-DD hh A')).toBeUndefined()
  })

  it('takes timestamps only as the whole format (no backtracking)', () => {
    expect(parseDayjs('1700000000', 'XX')).toBeUndefined()
    expect(parseDayjs(`${'1'.repeat(40)}a`, 'xxxxxxxx')).toBeUndefined()
  })

  it('accepts epoch-zero starts, explicit and inherited', () => {
    const c = parse(`${fmt}A :a, 1970-01-01, 1d\nB :1d`)
    expect(c.tasks[0]!.start).toBe(0)
    expect(c.tasks[1]!.start).toBe(86_400_000)
  })

  it('waits for every task an after/until names', () => {
    const c = parse(`${fmt}A :a, 2024-01-01, 1d
  C :c, after a b, 1d
  B :b, 2024-02-01, 2d
  D :d, 2024-01-01, until b a`)
    expect(iso(c.tasks[1]!.start)).toBe('2024-02-03T00:00')
  })

  it('rejects dates outside the JavaScript range and absurd exclude spans', () => {
    expect(() => parse(`${fmt}A :a, 2024-01-01, ${'9'.repeat(30)}d`)).toThrow(
      /outside the dates/,
    )
    expect(() =>
      parse(`${fmt}excludes 2000-01-01\nA :a, 2024-01-01, 10000000d`),
    ).toThrow(/too long/)
    expect(() => parse('dateFormat X\nA :a, 99999999999999999, 1d')).toThrow(
      /outside the dates/,
    )
  })

  it('keeps custom ticks across a long range', () => {
    const t = timeTicks(0, 365 * 86_400_000, { every: 60, unit: 'minute' })
    expect(t.at(-1)!).toBeGreaterThan(300 * 86_400_000)
  })
})
