// ============================================================================
// Gantt chart SVG renderer
//
// Draws a PositionedGanttChart (see ./layout.ts) in Mermaid's structure and
// paint order: exclude ranges, the grid/axis, section stripes, task bars and
// labels, section titles, the today line, the title. Styling follows Mermaid's
// default theme (styles.js), mapped onto this library's CSS custom properties
// so every theme (and live switching through `--bg`/`--fg`/`--accent`) applies:
//
//   Mermaid                         here
//   task / border                   the theme accent / the accent toward --fg
//   active                          the accent mixed 35% into --bg
//   done                            --fg mixed 20% into --bg (border: 50%)
//   crit                            red with a light red border, as Mermaid
//   section stripes                 the accent at opacity 0.2, alternating
//                                   with --bg; the third section is Mermaid's
//                                   #fff400
//   grid, exclude range             --fg mixed into --bg
//   today / vert                    red / the accent toward --fg
//
// Classes keep Mermaid's names (`task`, `taskText`, `section0`, `milestone`,
// `exclude-range`, ...). There is no click handling: `click` only marks the
// task `clickable` (bold, link-coloured label), as in Mermaid's static output.
// ============================================================================

import type {
  GanttTask,
  PositionedGanttChart,
  PositionedGanttTask,
} from '@zombie-mermaid/mermaid-parser'
import { CHART_ACCENT_FALLBACK } from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'

function r(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** The `todayMarker` CSS as a rule body: known stroke properties, plain values only. */
function todayDeclarations(style: string): string {
  return style
    .split(';')
    .map((d) => d.split(':').map((x) => x.trim()))
    .filter(
      ([k, v]) =>
        k !== undefined &&
        v !== undefined &&
        /^(?:stroke(?:-width|-dasharray|-opacity|-linecap)?|opacity)$/.test(
          k,
        ) &&
        /^[\w#.%() -]+$/.test(v),
    )
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ')
}

function ganttStyles(todayStyle: string, nonce?: string): string {
  const A = `var(--accent, ${CHART_ACCENT_FALLBACK})`
  const mix = (c: string, p: number, into = 'var(--bg)') =>
    `color-mix(in srgb, ${c} ${p}%, ${into})`
  const border = mix(A, 75, 'var(--fg)')
  const four = (prefix: string, decl: string) =>
    `  ${[0, 1, 2, 3].map((i) => `.${prefix}${i}`).join(',')} { ${decl} }`
  const outside = ['doneText', 'doneCritText']
    .flatMap((c) =>
      [0, 1, 2, 3].flatMap((i) => [
        `.${c}${i}.taskTextOutsideLeft`,
        `.${c}${i}.taskTextOutsideRight`,
      ]),
    )
    .join(',')
  return `${styleOpenTag(nonce)}
  .exclude-range { fill: ${mix('var(--fg)', 8)}; }
  .section { stroke: none; opacity: 0.2; }
  .section0 { fill: ${A}; }
  .section2 { fill: #fff400; }
  .section1, .section3 { fill: var(--bg); opacity: 0.2; }
  .sectionTitle { text-anchor: start; fill: var(--_text); }
  .grid .tick { stroke: ${mix('var(--fg)', 22)}; opacity: 0.8; shape-rendering: crispEdges; }
  .grid .tick text { fill: var(--_text); stroke: none; }
  .grid path { stroke-width: 0; }
  .today { fill: none; stroke: red; stroke-width: 2px; }
${todayStyle ? `  .today-custom { ${todayStyle} }\n` : ''}  .task { stroke-width: 2; }
  .taskText { text-anchor: middle; }
  .taskTextOutsideRight { fill: var(--_text); text-anchor: start; }
  .taskTextOutsideLeft { fill: var(--_text); text-anchor: end; }
  .task.clickable { cursor: pointer; }
  .taskText.clickable, .taskTextOutsideLeft.clickable, .taskTextOutsideRight.clickable { cursor: pointer; fill: #003163 !important; font-weight: bold; }
${four('taskText', 'fill: #fff;')}
${four('task', `fill: ${A}; stroke: ${border};`)}
${four('taskTextOutside', 'fill: var(--_text);')}
${four('active', `fill: ${mix(A, 35)}; stroke: ${border};`)}
${four('activeText', 'fill: var(--fg) !important;')}
${four('done', `stroke: ${mix('var(--fg)', 50)}; fill: ${mix('var(--fg)', 20)}; stroke-width: 2;`)}
${four('doneText', 'fill: var(--fg) !important;')}
  ${outside} { fill: var(--_text) !important; }
${four('crit', 'stroke: #ff8888; fill: red; stroke-width: 2;')}
${four('activeCrit', `stroke: #ff8888; fill: ${mix(A, 35)}; stroke-width: 2;`)}
${four('doneCrit', `stroke: #ff8888; fill: ${mix('var(--fg)', 20)}; stroke-width: 2; cursor: pointer; shape-rendering: crispEdges;`)}
  .milestone { transform: rotate(45deg) scale(0.8, 0.8); }
  .milestoneText { font-style: italic; }
${four('doneCritText', 'fill: var(--fg) !important;')}
  .vert { stroke: ${mix(A, 60, 'var(--fg)')}; }
  .vertText { font-size: 15px; text-anchor: middle; fill: ${mix(A, 60, 'var(--fg)')} !important; }
${four('activeCritText', 'fill: var(--fg) !important;')}
  .titleText { text-anchor: middle; font-size: 18px; fill: var(--_text); }
</style>`
}

/** Mermaid's task-bar class string. */
export function barClass(t: GanttTask, sec: number): string {
  let cls = ''
  if (t.active) cls = t.crit ? ' activeCrit' : ' active'
  else if (t.done) cls = t.crit ? ' doneCrit' : ' done'
  else if (t.crit) cls = ' crit'
  if (cls.length === 0) cls = ' task'
  if (t.milestone) cls = ` milestone ${cls}`
  if (t.vert) cls = ` vert ${cls}`
  return `task${cls}${sec} ${t.classes.join(' ')}`.trimEnd()
}

/** Mermaid's task-label class string (minus its `width-N` debugging class). */
export function textClass(p: PositionedGanttTask): string {
  const t = p.task
  const sec = p.sectionStyle
  let type = ''
  if (t.active) type = t.crit ? `activeCritText${sec}` : `activeText${sec}`
  if (t.done) type += t.crit ? ` doneCritText${sec}` : ` doneText${sec}`
  else if (t.crit) type += ` critText${sec}`
  if (t.milestone) type += ' milestoneText'
  if (t.vert) type += ' vertText'
  const pos =
    p.text.outside === 'left'
      ? `taskTextOutsideLeft taskTextOutside${sec}`
      : p.text.outside === 'right'
        ? `taskTextOutsideRight taskTextOutside${sec}`
        : `taskText taskText${sec}`
  return [t.classes.join(' '), pos, type].join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Render a positioned gantt chart as an SVG string.
 *
 * The accessible name is `title` (from `options.title`, or the chart's own
 * `accTitle` via the front door), as for every type but C4; it is dropped when
 * `decorative` is set — see svgOpenTag() in packages/core/src/theme.ts.
 */
export function renderGanttSvg(
  chart: PositionedGanttChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []
  parts.push(
    withDataSrc(
      svgOpenTag(
        chart.width,
        chart.height,
        colors,
        transparent,
        title,
        decorative,
        undefined,
        emit.styleAttribute,
        emit.description,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  parts.push(
    ganttStyles(
      chart.today ? todayDeclarations(chart.today.style) : '',
      emit.nonce,
    ),
  )

  parts.push('<g class="exclude-ranges">')
  for (const e of chart.excludeRanges) {
    parts.push(
      `<rect data-date="${e.id}" x="${r(e.x)}" y="${r(e.y)}" width="${r(e.width)}" height="${r(e.height)}" class="exclude-range"/>`,
    )
  }
  parts.push('</g>')

  for (const a of chart.axes) {
    const k = a.position === 'bottom' ? 1 : -1
    parts.push(
      `<g class="grid" transform="translate(${a.x}, ${a.y})" fill="none" font-size="10" text-anchor="middle">`,
      `<path class="domain" stroke="currentColor" d="M0.5,${k * a.tickSize}V0.5H${a.rangeEnd + 0.5}V${k * a.tickSize}"/>`,
    )
    for (const t of a.ticks) {
      parts.push(
        `<g class="tick" opacity="1" transform="translate(${r(t.x)},0)"><line stroke="currentColor" y2="${k * a.tickSize}"/>` +
          `<text fill="currentColor" y="${k * 3}" dy="${k === 1 ? '1em' : '0em'}" font-size="10" text-anchor="middle">${escapeXml(t.label)}</text></g>`,
      )
    }
    parts.push('</g>')
  }

  parts.push('<g class="rows">')
  for (const row of chart.rows) {
    parts.push(
      `<rect x="0" y="${r(row.y)}" width="${r(row.width)}" height="${row.height}" class="section section${row.sectionStyle}"/>`,
    )
  }
  parts.push('</g>')

  parts.push('<g class="tasks">')
  for (const p of chart.tasks) {
    parts.push(
      `<rect data-task="${escapeXml(p.id)}" rx="3" ry="3" x="${r(p.x)}" y="${r(p.y)}" width="${r(p.width)}" height="${r(p.height)}"` +
        ` transform-origin="${r(p.originX)}px ${r(p.originY)}px" class="${escapeXml(barClass(p.task, p.sectionStyle))}"/>`,
    )
  }
  for (const p of chart.tasks) {
    parts.push(
      `<text data-task="${escapeXml(p.id)}" font-size="${chart.fontSize}" x="${r(p.text.x)}" y="${r(p.text.y)}" class="${escapeXml(textClass(p))}">${escapeXml(p.text.text)}</text>`,
    )
  }
  parts.push('</g>')

  parts.push('<g class="section-titles">')
  for (const s of chart.sectionLabels) {
    const dy = -(s.lines.length - 1) / 2
    const tspans = s.lines
      .map(
        (line, j) =>
          `<tspan alignment-baseline="central" x="10"${j > 0 ? ' dy="1em"' : ''}>${escapeXml(line)}</tspan>`,
      )
      .join('')
    if (s.lines.every((l) => l === '')) continue
    parts.push(
      `<text dy="${dy}em" x="10" y="${r(s.y)}" font-size="${chart.sectionFontSize}" class="sectionTitle sectionTitle${s.sectionStyle}">${tspans}</text>`,
    )
  }
  parts.push('</g>')

  if (chart.today) {
    const t = chart.today
    const custom = todayDeclarations(t.style) ? ' today-custom' : ''
    parts.push(
      `<g class="today"><line x1="${r(t.x)}" x2="${r(t.x)}" y1="${t.y1}" y2="${r(t.y2)}" class="today${custom}"/></g>`,
    )
  }

  if (chart.title) {
    parts.push(
      `<text x="${r(chart.title.x)}" y="${chart.title.y}" class="titleText">${escapeXml(chart.title.text)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}
