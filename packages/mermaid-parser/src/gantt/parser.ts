import { MermaidParseError, decodeMermaidEntities } from '@zombie-mermaid/core'
import {
  MS_DAY,
  addDuration,
  formatDayjs,
  isoWeekday,
  parseDayjs,
  weekdayName,
} from './dates.ts'
import type {
  GanttChart,
  GanttSizes,
  GanttTask,
  GanttWeekday,
} from './types.ts'

// ============================================================================
// Gantt parser
//
// Parses Mermaid `gantt` syntax (jison grammar and ganttDb.js in mermaid-js/
// mermaid packages/mermaid/src/diagrams/gantt, checked against mermaid@12.3.0):
//
//   gantt
//   title / dateFormat / axisFormat / tickInterval / todayMarker / topAxis
//   inclusiveEndDates / includes / excludes / weekday / weekend
//   section <name>
//   <task>  :[active|done|crit|milestone|vert,]* [id,] [start,] <end|duration>
//   click <id[,id]> href "<url>" | call <fn>(<args>)
//
// Scheduling is ported from ganttDb.js, not reinvented:
//   - A task's data has 1-3 comma parts after its tags: `end`; `start, end`;
//     `id, start, end`. A lone part starts where the previous task ended.
//   - `start` is `after a b` (the latest end of those tasks), a date in
//     `dateFormat`, or any date `new Date()` reads. `end` is `until a b` (the
//     earliest start), a date, or a duration `<n>[y M w d h m s ms]`.
//   - Tasks are compiled in passes (up to 11), so `after` may name a task
//     defined later. An unknown id falls back to today.
//   - `excludes` (weekends, weekday names, dates) push a task's end out by
//     each excluded day it spans, unless the end is a literal YYYY-MM-DD.
//
// Dates are UTC; Mermaid uses the viewer's time zone. Keywords are
// case-insensitive; the `gantt` header is not (Mermaid's detector is
// `/^\s*gantt/`). accTitle/accDescr are stripped by `extractAccessibility`
// before the renderers call this; called directly they are accepted and
// ignored.
// ============================================================================

const SYNTAX_HELP =
  'Expected: title, dateFormat, axisFormat, tickInterval, todayMarker, excludes, includes, section <name>, or <task> :[tags,] [id,] [start,] <end|duration>.'

const TAGS = ['active', 'done', 'crit', 'milestone', 'vert'] as const
const WEEKDAYS = new Set<string>([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
])
/** The largest time a JavaScript Date holds, in milliseconds. */
const MAX_DATE = 8.64e15
/** Longest task (days) `excludes` is applied to; each day is examined. */
const MAX_EXCLUDE_SPAN = 36_525

const WEEKEND_START: Record<string, number> = { friday: 5, saturday: 6 }

interface Raw {
  task: GanttTask
  /** The task is scheduled once its start and end are both known. */
  processed: boolean
  manualEnd: boolean
  prevId: string | undefined
  startSpec:
    | { type: 'prev'; id: string | undefined }
    | { type: 'date'; data: string }
  endData: string
  start?: number
  end?: number
}

function fail(line: number, message: string, source: string): never {
  throw new MermaidParseError(
    `Line ${line}: ${message} in "${source.trim()}". ${SYNTAX_HELP}`,
    { diagramType: 'gantt' },
  )
}

const todayStart = (now: Date) =>
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

function mergeTokens(existing: string[], txt: string): string[] {
  const tokens = txt
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t !== '')
  return [...new Set([...existing, ...tokens])]
}

/**
 * ganttDb's `isInvalidDate`: whether `ms` falls on an excluded day. `includes`
 * wins over `excludes`; `weekends` follows the chart's `weekend` setting.
 */
export function isExcludedDate(
  chart: Pick<GanttChart, 'includes' | 'excludes' | 'weekend' | 'dateFormat'>,
  ms: number,
): boolean {
  const { includes, excludes } = chart
  const formatted = formatDayjs(ms, chart.dateFormat.trim())
  const dateOnly = formatDayjs(ms, 'YYYY-MM-DD')
  if (includes.includes(formatted) || includes.includes(dateOnly)) return false
  const w = WEEKEND_START[chart.weekend]!
  if (
    excludes.includes('weekends') &&
    (isoWeekday(ms) === w || isoWeekday(ms) === w + 1)
  ) {
    return true
  }
  if (excludes.includes(weekdayName(ms))) return true
  return excludes.includes(formatted) || excludes.includes(dateOnly)
}

/** The bodies of `%%{init: ...}%%` directives, found by scanning (no backtracking). */
function* initDirectives(source: string): Generator<string> {
  for (let i = source.indexOf('%%{'); i !== -1; i = source.indexOf('%%{', i)) {
    const end = source.indexOf('}%%', i + 3)
    if (end === -1) return
    const head = /^\s*(?:initialize|init)\s*:/.exec(source.slice(i + 3, i + 40))
    if (head) yield source.slice(i + 3 + head[0].length, end)
    i = end + 3
  }
}

/** A line without its `%%` comment: from the first `%%` at the start or after a blank. */
function stripComment(line: string): string {
  for (let h = line.indexOf('%%'); h !== -1; h = line.indexOf('%%', h + 2)) {
    if (h === 0 || /\s/.test(line[h - 1]!)) {
      return line.slice(0, h).trimEnd() === ''
        ? ''
        : line.slice(0, h - (h > 0 ? 1 : 0))
    }
  }
  return line
}

const SIZE_KEYS = [
  'titleTopMargin',
  'barHeight',
  'barGap',
  'topPadding',
  'rightPadding',
  'leftPadding',
  'gridLineStartPadding',
  'fontSize',
  'sectionFontSize',
  'numberSectionStyles',
] as const satisfies readonly (keyof GanttSizes)[]

/** Parse a Mermaid `gantt` chart from raw source text. */
export function parseGantt(source: string, now: Date = new Date()): GanttChart {
  const chart: GanttChart = {
    dateFormat: '',
    axisFormat: '',
    todayMarker: '',
    includes: [],
    excludes: [],
    inclusiveEndDates: false,
    topAxis: false,
    weekday: 'sunday',
    weekend: 'saturday',
    displayMode: '',
    sections: [],
    tasks: [],
  }
  const raws: Raw[] = []
  const byId = new Map<string, Raw>()
  let section = ''
  let lastId: string | undefined
  let taskCnt = 0
  let order = 0
  let sawHeader = false
  let multiline: false | 'init' | 'descr' = false
  let configAxisFormat = ''
  let configTick = ''
  const links: [string, string][] = []
  const clickable: string[] = []

  // `%%{init: {"gantt": {...}}}%%` (and front matter `config:`): the keys that
  // change what is drawn, sizes (`barHeight`, ...) included.
  for (const body of initDirectives(source)) {
    try {
      const cfg = JSON.parse(body.replace(/'/g, '"')) as {
        gantt?: Record<string, unknown>
      }
      const g = cfg.gantt
      if (!g || typeof g !== 'object') continue
      if (g.displayMode === 'compact') chart.displayMode = 'compact'
      if (g.topAxis === true) chart.topAxis = true
      if (typeof g.axisFormat === 'string') configAxisFormat = g.axisFormat
      if (typeof g.weekday === 'string' && WEEKDAYS.has(g.weekday)) {
        chart.weekday = g.weekday as GanttWeekday
      }
      if (typeof g.tickInterval === 'string') configTick = g.tickInterval
      for (const k of SIZE_KEYS) {
        // A size must be a finite number; numberSectionStyles at least 1.
        const v = g[k]
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          ;(chart.sizes ??= {})[k] =
            k === 'numberSectionStyles' ? Math.max(1, Math.floor(v)) : v
        }
      }
    } catch {
      // Not JSON (Mermaid's own parser is looser): the directive is ignored.
    }
  }

  source.split(/\r?\n/).forEach((full, i) => {
    const lineNo = i + 1
    if (multiline) {
      if (full.includes(multiline === 'init' ? '}%%' : '}')) multiline = false
      return
    }
    if (/^\s*%%\{/.test(full)) {
      if (!full.includes('}%%')) multiline = 'init'
      return
    }
    const noComment = stripComment(full)
    const line = noComment.trim()
    if (!line) return

    if (!sawHeader) {
      if (!/^gantt(?:\s|$)/i.test(line)) {
        fail(lineNo, 'Expected "gantt" header', full)
      }
      sawHeader = true
      return
    }

    let m: RegExpExecArray | null
    if (/^accDescr\s*\{/i.test(line) && !line.includes('}')) {
      multiline = 'descr'
      return
    }
    if (/^acc(?:Title|Descr)\s*[:{]/i.test(line)) return
    if ((m = /^dateFormat\s([^#;]+)/i.exec(line))) {
      chart.dateFormat = m[1]!.trim()
    } else if (/^inclusiveEndDates\b/i.test(line)) {
      chart.inclusiveEndDates = true
    } else if (/^topAxis\b/i.test(line)) {
      chart.topAxis = true
    } else if ((m = /^axisFormat\s([^#;]+)/i.exec(line))) {
      // Kept as written, leading blanks included: Mermaid prints them.
      chart.axisFormat = m[1]!
    } else if ((m = /^tickInterval\s([^#;]+)/i.exec(line))) {
      const t =
        /^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(
          m[1]!,
        )
      if (t) chart.tickInterval = { every: Number(t[1]), unit: t[2]! }
      else delete chart.tickInterval
    } else if ((m = /^excludes\s([^#;]+)/i.exec(line))) {
      chart.excludes = mergeTokens(chart.excludes, m[1]!)
    } else if ((m = /^includes\s([^#;]+)/i.exec(line))) {
      chart.includes = mergeTokens(chart.includes, m[1]!)
    } else if ((m = /^todayMarker\s([^;]+)/i.exec(line))) {
      chart.todayMarker = m[1]!.trim()
    } else if (
      (m = /^weekday\s+(\w+)\b/i.exec(line)) &&
      WEEKDAYS.has(m[1]!.toLowerCase())
    ) {
      chart.weekday = m[1]!.toLowerCase() as GanttWeekday
    } else if ((m = /^weekend\s+(friday|saturday)\b/i.exec(line))) {
      chart.weekend = m[1]!.toLowerCase() as 'friday' | 'saturday'
    } else if ((m = /^title\s(.+)/i.exec(line))) {
      chart.title = decodeMermaidEntities(m[1]!.trim())
    } else if ((m = /^section\s(.+)/i.exec(line))) {
      section = decodeMermaidEntities(m[1]!.trim())
      chart.sections.push(section)
    } else if (/^click\s/i.test(line)) {
      const c = /^click\s+(\S+)\s+(?:href\s+"([^"]*)"(?:\s|$)|call\s)/i.exec(
        line,
      )
      if (!c) fail(lineNo, 'Unrecognized click statement', full)
      clickable.push(c[1]!)
      if (c[2] !== undefined) links.push([c[1]!, c[2]])
    } else {
      // <task text> :<data>
      const colon = noComment.indexOf(':')
      if (colon < 1) fail(lineNo, 'Unrecognized statement', full)
      const label = decodeMermaidEntities(noComment.slice(0, colon).trim())
      if (!label) fail(lineNo, 'Task without a name', full)
      const data = noComment.slice(colon + 1).split(/[#;]/, 1)[0]!
      const parts = data.split(',')
      const task: GanttTask = {
        id: '',
        label,
        section,
        start: NaN,
        end: NaN,
        renderEnd: null,
        active: false,
        done: false,
        crit: false,
        milestone: false,
        vert: false,
        order: 0,
        classes: [],
      }
      for (let more = true; more;) {
        more = false
        for (const t of TAGS) {
          if ((parts[0] ?? '').trim() === t) {
            task[t] = true
            parts.shift()
            more = true
          }
        }
      }
      const d = parts.map((p) => p.trim())
      const newId = (id?: string) => id ?? `task${++taskCnt}`
      let startSpec: Raw['startSpec']
      let endData: string
      if (d.length === 1) {
        task.id = newId()
        startSpec = { type: 'prev', id: lastId }
        endData = d[0]!
      } else if (d.length === 2) {
        task.id = newId()
        startSpec = { type: 'date', data: d[0]! }
        endData = d[1]!
      } else if (d.length === 3) {
        task.id = newId(d[0])
        startSpec = { type: 'date', data: d[1]! }
        endData = d[2]!
      } else {
        fail(lineNo, 'A task takes one to three comma-separated values', full)
      }
      if (task.vert) task.order = -1
      else task.order = order++
      const raw: Raw = {
        task,
        processed: false,
        manualEnd: false,
        prevId: lastId,
        startSpec,
        endData,
      }
      raws.push(raw)
      lastId = task.id
      byId.set(task.id, raw)
    }
  })

  if (!sawHeader) fail(1, 'Expected "gantt" header', source)

  // Statements win over config for axisFormat/tickInterval, as in Mermaid.
  if (!chart.axisFormat && configAxisFormat) chart.axisFormat = configAxisFormat
  if (!chart.tickInterval && configTick) {
    const t =
      /^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(
        configTick,
      )
    if (t) chart.tickInterval = { every: Number(t[1]), unit: t[2]! }
  }

  // ---- scheduling (ganttDb.js getTasks / compileTasks) ----------------------
  const fmt = chart.dateFormat
  const parse = (s: string, f: string): number | undefined => {
    if (f === '') {
      const t = Date.parse(s)
      return Number.isNaN(t) ? undefined : t
    }
    return parseDayjs(s, f, now)
  }
  const idsOf = (rest: string) => rest.split(' ').filter((x) => x !== '')

  function getStart(raw: string): number | undefined {
    const str = raw.trim()
    if ((fmt.trim() === 'x' || fmt.trim() === 'X') && /^\d+$/.test(str)) {
      return Number(str)
    }
    const after = /^after\s+([\d\w- ]+)/.exec(str)
    if (after) {
      let latest: Raw | undefined
      for (const id of idsOf(after[1]!)) {
        const t = byId.get(id)
        if (!t) continue
        // A referenced task that has no end yet: wait for the next pass.
        if (t.end === undefined) return undefined
        if (!latest || (t.end ?? NaN) > (latest.end ?? NaN)) latest = t
      }
      return latest ? latest.end : todayStart(now)
    }
    const direct = parse(str, fmt.trim())
    if (direct !== undefined) return direct
    const dt = new Date(str)
    const y = dt.getFullYear()
    if (Number.isNaN(dt.getTime()) || y < -10000 || y > 10000) {
      throw new MermaidParseError(`Invalid date:${str}`, {
        diagramType: 'gantt',
      })
    }
    return dt.getTime()
  }

  function getEnd(prev: number, raw: string): number | undefined {
    const str = raw.trim()
    const until = /^until\s+([\d\w- ]+)/.exec(str)
    if (until) {
      let earliest: Raw | undefined
      for (const id of idsOf(until[1]!)) {
        const t = byId.get(id)
        if (!t) continue
        if (t.start === undefined) return undefined
        if (!earliest || (t.start ?? NaN) < (earliest.start ?? NaN))
          earliest = t
      }
      return earliest ? earliest.start : todayStart(now)
    }
    const direct = parse(str, fmt.trim())
    if (direct !== undefined) {
      return chart.inclusiveEndDates ? direct + MS_DAY : direct
    }
    const dur = /^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(str)
    return dur ? addDuration(prev, Number.parseFloat(dur[1]!), dur[2]!) : prev
  }

  const isInvalidDate = (ms: number) => isExcludedDate(chart, ms)

  /** A scheduled time must be a real JavaScript Date (a huge duration is not). */
  function checkRange(ms: number, label: string): number {
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE) {
      throw new MermaidParseError(
        `Gantt task "${label}" is scheduled outside the dates JavaScript can represent.`,
        { diagramType: 'gantt' },
      )
    }
    return ms
  }

  function compile(): boolean {
    let all = true
    for (const raw of raws) {
      const { task } = raw
      if (raw.startSpec.type === 'prev') {
        const prev = raw.prevId === undefined ? undefined : byId.get(raw.prevId)
        if (!prev) {
          throw new MermaidParseError(
            `Gantt task "${task.label}" has no start date and no task before it to follow.`,
            { diagramType: 'gantt' },
          )
        }
        raw.start = prev.end
      } else {
        const s = getStart(raw.startSpec.data)
        if (s !== undefined) raw.start = checkRange(s, task.label)
      }
      if (raw.start !== undefined) {
        raw.end = getEnd(raw.start, raw.endData)
        if (raw.end !== undefined) checkRange(raw.end, task.label)
        // `until` an id defined later has no start yet: try again next pass.
        if (raw.end !== undefined) raw.processed = true
        raw.manualEnd = parseDayjs(raw.endData, 'YYYY-MM-DD', now) !== undefined
        if (
          raw.end !== undefined &&
          chart.excludes.length > 0 &&
          !raw.manualEnd
        ) {
          // checkTaskDates / fixTaskDates
          if (raw.end - raw.start > MAX_EXCLUDE_SPAN * MS_DAY) {
            throw new MermaidParseError(
              `Gantt task "${task.label}" spans more than ${MAX_EXCLUDE_SPAN} days, too long to apply \`excludes\` to.`,
              { diagramType: 'gantt' },
            )
          }
          let start = raw.start + MS_DAY
          let end = raw.end
          const maxEnd = end + 10_000 * MS_DAY
          let invalid = false
          let renderEnd: number | null = null
          while (start <= end) {
            if (!invalid) renderEnd = end
            invalid = isInvalidDate(start)
            if (invalid) {
              end += MS_DAY
              if (end > maxEnd) {
                throw new MermaidParseError(
                  'Failed to find a valid date that was not excluded by `excludes` after 10,000 iterations.',
                  { diagramType: 'gantt' },
                )
              }
            }
            start += MS_DAY
          }
          raw.end = end
          task.renderEnd = renderEnd
        }
      }
      all = all && raw.processed
    }
    return all
  }

  let done = compile()
  for (let pass = 0; !done && pass < 10; pass++) done = compile()
  const stuck = raws.find((r) => !r.processed)
  if (stuck) {
    throw new MermaidParseError(
      `Gantt task "${stuck.task.label}" could not be scheduled: its start refers to a task that never gets a date (a circular "after" reference?).`,
      { diagramType: 'gantt' },
    )
  }

  // ---- links and classes (setClickEvent / setLink) --------------------------
  const linkOf = new Map<string, string>()
  for (const [ids, url] of links) {
    for (const id of ids.split(',')) {
      if (byId.has(id)) linkOf.set(id, url)
    }
  }
  for (const ids of [...clickable, ...links.map(([i]) => i)]) {
    for (const id of ids.split(',')) {
      const t = byId.get(id)?.task
      if (t && !t.classes.includes('clickable')) t.classes.push('clickable')
    }
  }

  chart.tasks = raws.map((r) => {
    r.task.start = r.start!
    r.task.end = r.end!
    const link = linkOf.get(r.task.id)
    if (link !== undefined) r.task.link = link
    return r.task
  })
  return chart
}
