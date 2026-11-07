// ============================================================================
// Gantt date helpers
//
// Mermaid reads `dateFormat` with dayjs (customParseFormat, strict) and draws
// the axis with d3-time-format and d3-scale's time ticks. None of that is
// available here, so this module carries the pieces gantt needs, all in UTC:
// Mermaid works in the viewer's local time zone, which only differs around
// daylight-saving changes and for sources that name no date at all.
//
//   - `parseDayjs` / `formatDayjs`: the dayjs tokens a `dateFormat` uses
//   - `formatD3Time`: the d3-time-format directives an `axisFormat` uses
//   - `timeTicks`: d3-scale's `scaleTime().ticks()` (default and `tickInterval`)
// ============================================================================

export const MS_SECOND = 1000
export const MS_MINUTE = 60_000
export const MS_HOUR = 3_600_000
export const MS_DAY = 86_400_000
export const MS_WEEK = 7 * MS_DAY
/** The approximate month and year lengths, used only to choose a tick step. */
const MS_MONTH_APPROX = 30 * MS_DAY
const MS_YEAR_APPROX = 365 * MS_DAY

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0')
const daysInMonth = (y: number, m0: number) =>
  new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()

// ---------------------------------------------------------------------------
// dayjs
// ---------------------------------------------------------------------------

const DAYJS_TOKENS =
  /(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?|X|x)/g

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

/** `date.format(fmt)` for the dayjs tokens Mermaid's gantt uses. */
export function formatDayjs(ms: number, fmt: string): string {
  const d = new Date(ms)
  const h24 = d.getUTCHours()
  const h12 = h24 % 12 || 12
  return fmt.replace(DAYJS_TOKENS, (tok, esc: string | undefined) => {
    if (esc) return esc.slice(1, -1)
    switch (tok) {
      case 'YYYY':
        return pad(d.getUTCFullYear(), 4)
      case 'YY':
        return pad(d.getUTCFullYear() % 100)
      case 'MMMM':
        return MONTHS[d.getUTCMonth()]!
      case 'MMM':
        return MONTHS[d.getUTCMonth()]!.slice(0, 3)
      case 'MM':
        return pad(d.getUTCMonth() + 1)
      case 'M':
        return String(d.getUTCMonth() + 1)
      case 'DD':
        return pad(d.getUTCDate())
      case 'D':
        return String(d.getUTCDate())
      case 'Do':
        return ordinal(d.getUTCDate())
      case 'HH':
        return pad(h24)
      case 'H':
        return String(h24)
      case 'hh':
        return pad(h12)
      case 'h':
        return String(h12)
      case 'mm':
        return pad(d.getUTCMinutes())
      case 'm':
        return String(d.getUTCMinutes())
      case 'ss':
        return pad(d.getUTCSeconds())
      case 's':
        return String(d.getUTCSeconds())
      case 'SSS':
        return pad(d.getUTCMilliseconds(), 3)
      case 'A':
        return h24 < 12 ? 'AM' : 'PM'
      case 'a':
        return h24 < 12 ? 'am' : 'pm'
      case 'Z':
        return '+00:00'
      case 'ZZ':
        return '+0000'
      case 'X':
        return String(Math.floor(ms / 1000))
      case 'x':
        return String(ms)
      default:
        return tok
    }
  })
}

/** `dayjs(d).format('dddd')`, lowercased, for `excludes monday`-style entries. */
export function weekdayName(ms: number): string {
  return DAYS[new Date(ms).getUTCDay()]!.toLowerCase()
}

/** ISO weekday: Monday 1 .. Sunday 7. */
export function isoWeekday(ms: number): number {
  return new Date(ms).getUTCDay() || 7
}

interface Field {
  key: string
  re: string
}

const FIELD: Record<string, Field> = {
  YYYY: { key: 'y4', re: '(\\d{4})' },
  YY: { key: 'y2', re: '(\\d{2})' },
  MMMM: { key: 'monthName', re: `(${MONTHS.join('|')})` },
  MMM: {
    key: 'monthShort',
    re: `(${MONTHS.map((m) => m.slice(0, 3)).join('|')})`,
  },
  MM: { key: 'M', re: '(\\d{2})' },
  M: { key: 'M', re: '(\\d\\d?)' },
  DD: { key: 'D', re: '(\\d{2})' },
  D: { key: 'D', re: '(\\d\\d?)' },
  Do: { key: 'D', re: '(\\d+)(?:st|nd|rd|th)' },
  HH: { key: 'H', re: '(\\d{2})' },
  H: { key: 'H', re: '(\\d\\d?)' },
  hh: { key: 'h', re: '(\\d{2})' },
  h: { key: 'h', re: '(\\d\\d?)' },
  mm: { key: 'm', re: '(\\d{2})' },
  m: { key: 'm', re: '(\\d\\d?)' },
  ss: { key: 's', re: '(\\d{2})' },
  s: { key: 's', re: '(\\d\\d?)' },
  SSS: { key: 'ms', re: '(\\d{3})' },
  A: { key: 'ap', re: '(AM|PM)' },
  a: { key: 'ap', re: '(am|pm)' },
  Z: { key: 'off', re: '([+-]\\d\\d:?\\d\\d|Z)' },
  ZZ: { key: 'off', re: '([+-]\\d\\d:?\\d\\d|Z)' },
  X: { key: 'unix', re: '(-?\\d+)' },
  x: { key: 'unixMs', re: '(-?\\d+)' },
}

const compiled = new Map<string, { re: RegExp; keys: string[] } | null>()

function compile(fmt: string) {
  let hit = compiled.get(fmt)
  if (hit !== undefined) return hit
  const keys: string[] = []
  let re = ''
  let supported = true
  let last = 0
  const escapeLit = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const m of fmt.matchAll(DAYJS_TOKENS)) {
    re += escapeLit(fmt.slice(last, m.index))
    last = m.index + m[0].length
    if (m[1]) re += escapeLit(m[1].slice(1, -1))
    else if (m[2]) re += escapeLit(m[2])
    else {
      const f = FIELD[m[3]!]
      // Timestamps are the whole value: two `\d+` groups side by side backtrack.
      if (!f || ((m[3] === 'X' || m[3] === 'x') && fmt !== m[3])) {
        supported = false
      } else {
        re += f.re
        keys.push(f.key)
      }
    }
  }
  re += escapeLit(fmt.slice(last))
  // The pattern is escaped literals and fixed-width digit groups, so it cannot
  // backtrack catastrophically whatever `dateFormat` says.
  const matcher = new RegExp(`^${re}$`) // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  hit = supported ? { re: matcher, keys } : null
  compiled.set(fmt, hit)
  return hit
}

/**
 * `dayjs(str, fmt, true)`: a UTC timestamp, or `undefined` when `str` does not
 * match `fmt` exactly or names an impossible date. Fields the format leaves
 * out default as dayjs does: this year (and, with no month and no year, this
 * month and day), January 1st, midnight.
 */
export function parseDayjs(
  str: string,
  fmt: string,
  now: Date = new Date(),
): number | undefined {
  const c = compile(fmt)
  if (!c) return undefined
  const m = c.re.exec(str)
  if (!m) return undefined
  const v: Record<string, string> = {}
  c.keys.forEach((k, i) => (v[k] = m[i + 1]!))
  if (v.unixMs !== undefined) return Number(v.unixMs)
  if (v.unix !== undefined) return Number(v.unix) * 1000

  let year = v.y4 ? Number(v.y4) : v.y2 ? 2000 + Number(v.y2) : undefined
  if (v.y2 && Number(v.y2) > 68) year = 1900 + Number(v.y2)
  let month0: number | undefined
  if (v.M) month0 = Number(v.M) - 1
  else if (v.monthName) month0 = MONTHS.indexOf(v.monthName)
  else if (v.monthShort)
    month0 = MONTHS.findIndex((x) => x.startsWith(v.monthShort!))
  const hasMonth = month0 !== undefined
  const day = v.D ? Number(v.D) : undefined
  const y = year ?? now.getUTCFullYear()
  const mo = hasMonth ? month0! : year ? 0 : now.getUTCMonth()
  const d = day ?? (!year && !hasMonth ? now.getUTCDate() : 1)

  let hour = v.H ? Number(v.H) : 0
  if (v.h) {
    if (Number(v.h) < 1 || Number(v.h) > 12) return undefined
    hour = Number(v.h) % 12
    if (v.ap?.toLowerCase() === 'pm') hour += 12
  } else if (v.H && v.ap?.toLowerCase() === 'pm' && hour < 12) hour += 12
  const min = v.m ? Number(v.m) : 0
  const sec = v.s ? Number(v.s) : 0
  const msec = v.ms ? Number(v.ms) : 0

  if (mo < 0 || mo > 11 || d < 1 || d > daysInMonth(y, mo)) return undefined
  if (hour > 23 || min > 59 || sec > 59) return undefined
  let t = Date.UTC(y, mo, d, hour, min, sec, msec)
  if (y < 100) t = new Date(t).setUTCFullYear(y)
  if (v.off && v.off !== 'Z') {
    const sign = v.off.startsWith('-') ? -1 : 1
    const digits = v.off.replace(/\D/g, '')
    t -=
      sign *
      (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) *
      MS_MINUTE
  }
  return t
}

/** `dayjs(d).add(n, unit)` for Mermaid's duration units (y M w d h m s ms). */
export function addDuration(ms: number, n: number, unit: string): number {
  const d = new Date(ms)
  switch (unit) {
    case 'y': {
      d.setUTCFullYear(d.getUTCFullYear() + Math.round(n))
      return d.getTime()
    }
    case 'M': {
      const day = d.getUTCDate()
      d.setUTCDate(1)
      d.setUTCMonth(d.getUTCMonth() + Math.round(n))
      d.setUTCDate(
        Math.min(day, daysInMonth(d.getUTCFullYear(), d.getUTCMonth())),
      )
      return d.getTime()
    }
    case 'w':
      return ms + Math.round(n * 7) * MS_DAY
    case 'd':
      return ms + Math.round(n) * MS_DAY
    case 'h':
      return Math.round(ms + n * MS_HOUR)
    case 'm':
      return Math.round(ms + n * MS_MINUTE)
    case 's':
      return Math.round(ms + n * MS_SECOND)
    default:
      return Math.round(ms + n)
  }
}

// ---------------------------------------------------------------------------
// d3-time-format
// ---------------------------------------------------------------------------

function dayOfYear(d: Date): number {
  return (
    Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / MS_DAY) + 1
  )
}

/** Week of the year, weeks starting on `startDay` (0 Sunday, 1 Monday). */
function weekOfYear(d: Date, startDay: number): number {
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const firstWeekStart = (7 - ((jan1.getUTCDay() - startDay + 7) % 7)) % 7
  const doy = dayOfYear(d) - 1
  return Math.floor((doy - firstWeekStart + 7) / 7)
}

/** ISO 8601 week number and year. */
function isoWeek(d: Date): { week: number; year: number } {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
  const dow = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dow)
  const y = t.getUTCFullYear()
  return {
    week: Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / MS_DAY + 1) / 7),
    year: y,
  }
}

/**
 * `d3.timeFormat(fmt)(date)`: `%a %A %b %B %d %e %f %g %G %H %I %j %L %m %M
 * %p %q %Q %s %S %u %U %V %w %W %y %Y %Z %%`, `%c`/`%x`/`%X`, and the `-`, `_`
 * and `0` padding flags. `%Z` prints `+0000`.
 */
export function formatD3Time(ms: number, fmt: string): string {
  const d = new Date(ms)
  const out: string[] = []
  for (let i = 0; i < fmt.length; i++) {
    if (fmt[i] !== '%') {
      out.push(fmt[i]!)
      continue
    }
    let flag: string | undefined
    let c = fmt[++i]
    if (c === '-' || c === '_' || c === '0') {
      flag = c
      c = fmt[++i]
    }
    if (c === undefined) break
    const num = (n: number, width: number, defPad: string): string => {
      const p =
        flag === '-' ? '' : flag === '_' ? ' ' : flag === '0' ? '0' : defPad
      const s = String(Math.abs(n))
      return (n < 0 ? '-' : '') + (p ? s.padStart(width, p) : s)
    }
    const h24 = d.getUTCHours()
    switch (c) {
      case 'a':
        out.push(DAYS[d.getUTCDay()]!.slice(0, 3))
        break
      case 'A':
        out.push(DAYS[d.getUTCDay()]!)
        break
      case 'b':
      case 'h':
        out.push(MONTHS[d.getUTCMonth()]!.slice(0, 3))
        break
      case 'B':
        out.push(MONTHS[d.getUTCMonth()]!)
        break
      case 'c':
        out.push(formatD3Time(ms, '%a %b %e %X %Y'))
        break
      case 'd':
        out.push(num(d.getUTCDate(), 2, '0'))
        break
      case 'e':
        out.push(num(d.getUTCDate(), 2, ' '))
        break
      case 'f':
        out.push(num(d.getUTCMilliseconds() * 1000, 6, '0'))
        break
      case 'g':
        out.push(num(isoWeek(d).year % 100, 2, '0'))
        break
      case 'G':
        out.push(num(isoWeek(d).year, 4, '0'))
        break
      case 'H':
        out.push(num(h24, 2, '0'))
        break
      case 'I':
        out.push(num(h24 % 12 || 12, 2, '0'))
        break
      case 'j':
        out.push(num(dayOfYear(d), 3, '0'))
        break
      case 'L':
        out.push(num(d.getUTCMilliseconds(), 3, '0'))
        break
      case 'm':
        out.push(num(d.getUTCMonth() + 1, 2, '0'))
        break
      case 'M':
        out.push(num(d.getUTCMinutes(), 2, '0'))
        break
      case 'p':
        out.push(h24 < 12 ? 'AM' : 'PM')
        break
      case 'q':
        out.push(String(1 + Math.floor(d.getUTCMonth() / 3)))
        break
      case 'Q':
        out.push(String(ms))
        break
      case 's':
        out.push(String(Math.floor(ms / 1000)))
        break
      case 'S':
        out.push(num(d.getUTCSeconds(), 2, '0'))
        break
      case 'u':
        out.push(String(d.getUTCDay() || 7))
        break
      case 'U':
        out.push(num(weekOfYear(d, 0), 2, '0'))
        break
      case 'V':
        out.push(num(isoWeek(d).week, 2, '0'))
        break
      case 'w':
        out.push(String(d.getUTCDay()))
        break
      case 'W':
        out.push(num(weekOfYear(d, 1), 2, '0'))
        break
      case 'x':
        out.push(formatD3Time(ms, '%m/%d/%Y'))
        break
      case 'X':
        out.push(formatD3Time(ms, '%H:%M:%S'))
        break
      case 'y':
        out.push(num(d.getUTCFullYear() % 100, 2, '0'))
        break
      case 'Y':
        out.push(num(d.getUTCFullYear(), 4, '0'))
        break
      case 'Z':
        out.push('+0000')
        break
      case '%':
        out.push('%')
        break
      default:
        out.push(`%${flag ?? ''}${c}`)
    }
  }
  return out.join('')
}

// ---------------------------------------------------------------------------
// d3-time intervals and d3-scale ticks (UTC)
// ---------------------------------------------------------------------------

/** A d3-time interval: floor/offset plus the `every(k)` filter d3 builds on it. */
interface Interval {
  floor(ms: number): number
  offset(ms: number, n: number): number
  /** `interval.every(k)`'s predicate, or undefined for "every boundary". */
  field?(ms: number): number
  /** For intervals with no field: `interval.count(0, d)`. */
  count?(ms: number): number
}

const fixed = (size: number, field?: (ms: number) => number): Interval => ({
  floor: (t) => Math.floor(t / size) * size,
  offset: (t, n) => t + n * size,
  field,
  count: (t) => Math.floor(t / size),
})

const SECOND = fixed(MS_SECOND, (t) => new Date(t).getUTCSeconds())
const MINUTE = fixed(MS_MINUTE, (t) => new Date(t).getUTCMinutes())
const HOUR = fixed(MS_HOUR, (t) => new Date(t).getUTCHours())
const DAY = fixed(MS_DAY, (t) => new Date(t).getUTCDate() - 1)
const MILLI = fixed(1, undefined)
const weekInterval = (startDay: number): Interval => {
  const floor = (t: number) => {
    const day = Math.floor(t / MS_DAY) * MS_DAY
    const dow = new Date(day).getUTCDay()
    return day - ((dow - startDay + 7) % 7) * MS_DAY
  }
  return {
    floor,
    offset: (t, n) => t + n * MS_WEEK,
    count: (t) => Math.floor((floor(t) - floor(0)) / MS_WEEK),
  }
}
const MONTH: Interval = {
  floor: (t) => {
    const d = new Date(t)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  },
  offset: (t, n) => {
    const d = new Date(t)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)
  },
  field: (t) => new Date(t).getUTCMonth(),
}
const YEAR: Interval = {
  floor: (t) => Date.UTC(new Date(t).getUTCFullYear(), 0, 1),
  offset: (t, n) => Date.UTC(new Date(t).getUTCFullYear() + n, 0, 1),
  field: (t) => new Date(t).getUTCFullYear(),
}

const WEEKDAYS: Record<string, Interval> = Object.fromEntries(
  DAYS.map((n, i) => [n.toLowerCase(), weekInterval(i)]),
)

/** `interval.every(k).range(start, stop)`; k = 1 means every boundary. */
function rangeEvery(
  iv: Interval,
  k: number,
  start: number,
  stop: number,
): number[] {
  const pass = (t: number) =>
    k <= 1 ||
    (iv.field ? iv.field(t) % k === 0 : (iv.count?.(t) ?? 0) % k === 0)
  const out: number[] = []
  // ceil(start): the first boundary at or after start
  let t = iv.floor(start)
  if (t < start) t = iv.offset(t, 1)
  const step = (x: number) => iv.floor(iv.offset(x, 1))
  // Bounded by the ticks kept, not the boundaries skipped, so a wide filter
  // (`60minute` over a year) still covers the whole range.
  for (let n = 0; t < stop && out.length < 20_000 && n < 5_000_000; n++) {
    if (pass(t)) out.push(t)
    t = step(t)
  }
  return out
}

/** The `tickIntervals` of d3-scale, with the step each one stands for. */
const TICK_INTERVALS: [Interval, number, number][] = [
  [SECOND, 1, MS_SECOND],
  [SECOND, 5, 5 * MS_SECOND],
  [SECOND, 15, 15 * MS_SECOND],
  [SECOND, 30, 30 * MS_SECOND],
  [MINUTE, 1, MS_MINUTE],
  [MINUTE, 5, 5 * MS_MINUTE],
  [MINUTE, 15, 15 * MS_MINUTE],
  [MINUTE, 30, 30 * MS_MINUTE],
  [HOUR, 1, MS_HOUR],
  [HOUR, 3, 3 * MS_HOUR],
  [HOUR, 6, 6 * MS_HOUR],
  [HOUR, 12, 12 * MS_HOUR],
  [DAY, 1, MS_DAY],
  [DAY, 2, 2 * MS_DAY],
  [weekInterval(0), 1, MS_WEEK],
  [MONTH, 1, MS_MONTH_APPROX],
  [MONTH, 3, 3 * MS_MONTH_APPROX],
  [YEAR, 1, MS_YEAR_APPROX],
]

/** The `tickStep` of d3-array (the nice 1-2-5 step for `count` ticks). */
function tickStep(start: number, stop: number, count: number): number {
  const step0 = Math.abs(stop - start) / Math.max(0, count)
  let step1 = 10 ** Math.floor(Math.log(step0) / Math.LN10)
  const error = step0 / step1
  if (error >= Math.sqrt(50)) step1 *= 10
  else if (error >= Math.sqrt(10)) step1 *= 5
  else if (error >= Math.sqrt(2)) step1 *= 2
  return stop < start ? -step1 : step1
}

/** The unit names `tickInterval` accepts, mapped to their intervals. */
const UNIT: Record<string, Interval> = {
  millisecond: MILLI,
  second: SECOND,
  minute: MINUTE,
  hour: HOUR,
  day: DAY,
  month: MONTH,
}

export interface TickInterval {
  every: number
  unit: string
}

/**
 * The ticks `d3.axisBottom(scaleTime().domain([t0, t1])).ticks(...)` shows:
 * ten or so "nice" ticks by default, or every `every` units of a custom
 * `tickInterval` (a `week` runs on `weekday`).
 */
export function timeTicks(
  t0: number,
  t1: number,
  custom?: TickInterval,
  weekday = 'sunday',
): number[] {
  if (custom) {
    const iv = custom.unit === 'week' ? WEEKDAYS[weekday]! : UNIT[custom.unit]!
    return rangeEvery(iv, custom.every, t0, t1 + 1)
  }
  const target = Math.abs(t1 - t0) / 10
  // bisector(...).right over the step column
  let i = TICK_INTERVALS.findIndex(([, , s]) => s > target)
  if (i === -1) i = TICK_INTERVALS.length
  if (i === TICK_INTERVALS.length) {
    const step = tickStep(t0 / MS_YEAR_APPROX, t1 / MS_YEAR_APPROX, 10)
    return rangeEvery(YEAR, Math.max(1, Math.floor(step)), t0, t1 + 1)
  }
  if (i > 0) {
    const [prev, cur] = [TICK_INTERVALS[i - 1]!, TICK_INTERVALS[i]!]
    const [iv, step] = target / prev[2] < cur[2] / target ? prev : cur
    return rangeEvery(iv, step, t0, t1 + 1)
  }
  const step = Math.max(tickStep(t0, t1, 10), 1)
  return rangeEvery(MILLI, Math.floor(step), t0, t1 + 1)
}
