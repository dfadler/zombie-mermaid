/**
 * Gantt figure agreement against official mermaid.js (#2835), for
 * scripts/gantt-oracle.ts. Browser-free so it can be unit-tested.
 *
 * Everything but label placement is pure arithmetic over the parsed dates and
 * the frame width, so rows, bars, exclude ranges, ticks and tick labels,
 * section stripes, section labels and the title must match exactly (the
 * tolerance only absorbs mermaid printing floats). A task label is placed by
 * measuring its text in the browser's font, which this library cannot match:
 * its `y` and style classes are compared, but whether it sits inside, left or
 * right of the bar (and so its `x`) is only reported as a note.
 */
import { parseGantt } from '@zombie-mermaid/mermaid-parser'
import { layoutGantt } from '../../packages/svg-renderer/src/gantt/layout.ts'
import {
  barClass as barClassOf,
  textClass as textClassOf,
} from '../../packages/svg-renderer/src/gantt/renderer.ts'

export interface GanttRect {
  key: string
  x: number
  y: number
  width: number
  height: number
  cls: string
}

export interface GanttTickFigure {
  axisY: number
  x: number
  label: string
}

export interface GanttText {
  key: string
  x: number
  y: number
  cls: string
  text: string
}

export interface GanttFigure {
  viewBox: string
  excludes: GanttRect[]
  rows: GanttRect[]
  bars: GanttRect[]
  ticks: GanttTickFigure[]
  taskTexts: GanttText[]
  sectionLabels: { y: number; text: string; cls: string }[]
  title?: { x: number; y: number; text: string }
}

const attr = (tag: string, name: string): string => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return m ? m[1]! : ''
}
const num = (tag: string, name: string) => Number(attr(tag, name))
const norm = (cls: string) =>
  cls
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('width-'))
    .sort()
    .join(' ')
const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const entityText = (s: string) => decode(s).trim()

/** Official mermaid: read the figure back out of the SVG string. */
export function parseOfficialGantt(svg: string, renderId: string): GanttFigure {
  const fig: GanttFigure = {
    viewBox: attr(svg.slice(0, svg.indexOf('>') + 1), 'viewBox'),
    excludes: [],
    rows: [],
    bars: [],
    ticks: [],
    taskTexts: [],
    sectionLabels: [],
  }
  const body = svg.slice(svg.indexOf('</style>') + 8)
  const strip = (id: string) => id.replace(`${renderId}-`, '')
  for (const [tag] of body.matchAll(/<rect\b[^>]*>/g)) {
    const r = {
      key: strip(attr(tag, 'id')),
      x: num(tag, 'x'),
      y: num(tag, 'y'),
      width: num(tag, 'width'),
      height: num(tag, 'height'),
      cls: norm(attr(tag, 'class')),
    }
    if (r.cls === 'exclude-range') fig.excludes.push(r)
    else if (r.cls.startsWith('section')) fig.rows.push({ ...r, key: '' })
    else fig.bars.push(r)
  }
  let axisY = 0
  for (const m of body.matchAll(
    /<g class="grid" transform="translate\(([-\d.]+), ([-\d.]+)\)"|<g class="tick"[^>]*transform="translate\(([-\d.]+),0\)">[\s\S]*?<text[^>]*>([^<]*)<\/text>/g,
  )) {
    if (m[2] !== undefined) axisY = Number(m[2])
    else fig.ticks.push({ axisY, x: Number(m[3]), label: decode(m[4]!) })
  }
  for (const m of body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const a = m[1]!
    const cls = norm(attr(a, 'class'))
    if (attr(a, 'id').endsWith('-text')) {
      fig.taskTexts.push({
        key: strip(attr(a, 'id')).replace(/-text$/, ''),
        x: num(a, 'x'),
        y: num(a, 'y'),
        cls,
        text: entityText(m[2]!),
      })
    } else if (cls.startsWith('sectionTitle')) {
      fig.sectionLabels.push({
        y: num(a, 'y'),
        text: entityText(m[2]!.replace(/<[^>]+>/g, '')),
        cls,
      })
    } else if (cls === 'titleText') {
      fig.title = { x: num(a, 'x'), y: num(a, 'y'), text: entityText(m[2]!) }
    }
  }
  return fig
}

/** Our layout, flattened the same way. */
export function ourGantt(
  source: string,
  width: number,
  now: Date = new Date(),
): GanttFigure {
  const l = layoutGantt(parseGantt(source, now), { width, now: now.getTime() })
  const rect = (
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    cls: string,
  ): GanttRect => ({ key, x, y, width: w, height: h, cls: norm(cls) })
  const fig: GanttFigure = {
    viewBox: `0 0 ${l.width} ${l.height}`,
    excludes: l.excludeRanges.map((e) =>
      rect(`exclude-${e.id}`, e.x, e.y, e.width, e.height, 'exclude-range'),
    ),
    rows: l.rows.map((r) =>
      rect('', 0, r.y, r.width, r.height, `section section${r.sectionStyle}`),
    ),
    bars: l.tasks.map((p) =>
      rect(
        p.id,
        p.x,
        p.y,
        p.width,
        p.height,
        barClassOf(p.task, p.sectionStyle),
      ),
    ),
    ticks: l.axes.flatMap((a) =>
      a.ticks.map((t) => ({ axisY: a.y, x: t.x, label: t.label })),
    ),
    taskTexts: l.tasks.map((p) => ({
      key: p.id,
      x: p.text.x,
      y: p.text.y,
      cls: textClassOf(p),
      text: p.text.text,
    })),
    sectionLabels: l.sectionLabels.map((s) => ({
      y: s.y,
      text: s.lines.join(''),
      cls: `sectionTitle sectionTitle${s.sectionStyle}`,
    })),
  }
  if (l.title) fig.title = l.title
  return fig
}

/** Tolerance for mermaid's float printing; the geometry itself has none. */
export const GANTT_TOLERANCE = 1e-6

export interface GanttComparison {
  /** Differences that fail the oracle. */
  mismatches: string[]
  /** Label placements that differ only because text is measured in another font. */
  notes: string[]
}

/** Every mismatch between the two figures, empty when they agree. */
export function ganttMismatches(
  official: GanttFigure,
  ours: GanttFigure,
  tol: number = GANTT_TOLERANCE,
): GanttComparison {
  const out: string[] = []
  const notes: string[] = []
  const close = (a: number, b: number) => Math.abs(a - b) <= tol
  if (official.viewBox !== ours.viewBox)
    out.push(`viewBox: "${official.viewBox}" official, "${ours.viewBox}" ours`)

  const rects = (name: string, a: GanttRect[], b: GanttRect[]) => {
    if (a.length !== b.length)
      out.push(`${name}: ${a.length} official, ${b.length} ours`)
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const x = a[i]!
      const y = b[i]!
      if (
        x.key !== y.key ||
        x.cls !== y.cls ||
        !close(x.x, y.x) ||
        !close(x.y, y.y) ||
        !close(x.width, y.width) ||
        !close(x.height, y.height)
      )
        out.push(
          `${name}[${i}]: ${JSON.stringify(x)} official, ${JSON.stringify(y)} ours`,
        )
    }
  }
  rects('excludes', official.excludes, ours.excludes)
  rects('rows', official.rows, ours.rows)
  rects('bars', official.bars, ours.bars)

  if (official.ticks.length !== ours.ticks.length)
    out.push(
      `ticks: ${official.ticks.length} official, ${ours.ticks.length} ours`,
    )
  for (let i = 0; i < Math.min(official.ticks.length, ours.ticks.length); i++) {
    const a = official.ticks[i]!
    const b = ours.ticks[i]!
    if (a.label !== b.label || !close(a.x, b.x) || !close(a.axisY, b.axisY))
      out.push(
        `tick[${i}]: ${JSON.stringify(a)} official, ${JSON.stringify(b)} ours`,
      )
  }

  if (official.taskTexts.length !== ours.taskTexts.length)
    out.push(
      `task texts: ${official.taskTexts.length} official, ${ours.taskTexts.length} ours`,
    )
  for (
    let i = 0;
    i < Math.min(official.taskTexts.length, ours.taskTexts.length);
    i++
  ) {
    const a = official.taskTexts[i]!
    const b = ours.taskTexts[i]!
    const place = (c: string) =>
      /taskTextOutsideLeft/.test(c)
        ? 'left'
        : /taskTextOutsideRight/.test(c)
          ? 'right'
          : 'in'
    const strip = (c: string) =>
      c
        .split(' ')
        .filter((t) => !/^taskText(?:Outside(?:Left|Right)?)?\d?$/.test(t))
        .join(' ')
    if (
      a.key !== b.key ||
      a.text !== b.text ||
      !close(a.y, b.y) ||
      strip(a.cls) !== strip(b.cls)
    ) {
      out.push(
        `text[${i}]: ${JSON.stringify(a)} official, ${JSON.stringify(b)} ours`,
      )
    } else if (place(a.cls) !== place(b.cls) || !close(a.x, b.x)) {
      notes.push(
        `label "${a.text}": ${place(a.cls)} at x=${a.x} official, ${place(b.cls)} at x=${b.x} ours`,
      )
    }
  }

  if (official.sectionLabels.length !== ours.sectionLabels.length)
    out.push(
      `section labels: ${official.sectionLabels.length} official, ${ours.sectionLabels.length} ours`,
    )
  for (
    let i = 0;
    i < Math.min(official.sectionLabels.length, ours.sectionLabels.length);
    i++
  ) {
    const a = official.sectionLabels[i]!
    const b = ours.sectionLabels[i]!
    if (a.text !== b.text || a.cls !== b.cls || !close(a.y, b.y))
      out.push(
        `section[${i}]: ${JSON.stringify(a)} official, ${JSON.stringify(b)} ours`,
      )
  }
  const ta = official.title
  const tb = ours.title
  if (
    (ta?.text.trim() ?? '') !== (tb?.text ?? '') ||
    (ta && tb && (!close(ta.x, tb.x) || !close(ta.y, tb.y)))
  )
    out.push(
      `title: ${JSON.stringify(ta)} official, ${JSON.stringify(tb)} ours`,
    )
  return { mismatches: out, notes }
}
