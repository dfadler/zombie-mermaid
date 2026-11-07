// ============================================================================
// ASCII renderer — Timeline
//
// Mermaid has no text mode for timelines, so there is no reference output to
// match. The SVG lays periods out in columns along a horizontal axis, which at
// terminal widths would run off the screen after a handful of periods, so
// this draws the same content as a vertical spine (for `timeline TD` as well
// as the default `timeline LR`):
//
//          History of Social Media Platform
//
//     2002 ──●── LinkedIn
//            │
//     2004 ──●── Facebook
//            │   Google
//            │
//     2005 ──●── YouTube
//            ▼
//
//   - Periods are right-aligned in a left column, each on a `●` of the spine,
//     in source order; its events follow on the right, one per row, the
//     spine running down beside the continuation rows.
//   - A `section` is a `[name]` heading on its own row, the spine running
//     through; periods written before the first section sit above it, and as
//     in Mermaid are not drawn when sections exist (they belong to no
//     section).
//   - The spine ends in an arrow, like the SVG axis.
//   - Section and period markers are painted in the theme accent. accTitle /
//     accDescr are not printed (see the pie renderer).
//
// Widths are display widths (CJK and emoji labels line up).
// ============================================================================

import { parseTimeline } from '@zombie-mermaid/mermaid-parser'
import type { TimelinePeriod } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

/** Period labels wrap at this many columns, as Mermaid wraps them at 150px. */
const LABEL_WIDTH = 24

/** Greedy word wrap by display width; a word wider than `width` keeps its own line. */
function wrapLabel(label: string): string[] {
  const lines: string[] = []
  let cur = ''
  for (const word of label.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word
    if (cur && displayWidth(next) > LABEL_WIDTH) {
      lines.push(cur)
      cur = word
    } else cur = next
  }
  lines.push(cur)
  return lines
}

const UNI = { spine: '│', node: '●', arm: '──', arrow: '▼' }
const ASC = { spine: '|', node: 'o', arm: '--', arrow: 'v' }

export function renderTimelineAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const tl = parseTimeline(text)
  const g = config.useAscii ? ASC : UNI
  const paint = (s: string, hex: string): string =>
    colorizeText(s, hex, colorMode)
  const accent = theme.accent ?? theme.fg

  // Mermaid draws a period only under the section it was written in; with no
  // sections every period is drawn.
  const groups: { heading?: string; periods: TimelinePeriod[] }[] =
    tl.sections.length > 0
      ? tl.sections.map((name) => ({
          heading: name,
          periods: tl.periods.filter((p) => p.section === name),
        }))
      : [{ periods: tl.periods }]

  const wrapped = new Map(
    tl.periods.map((p) => [p, wrapLabel(p.label)] as const),
  )
  const labelWidth = Math.max(
    0,
    ...[...wrapped.values()].flatMap((ls) => ls.map((l) => displayWidth(l))),
  )
  // Column of the spine: indent, label, space, arm.
  const indent = 2
  const spineCol = indent + labelWidth + 1 + g.arm.length
  const spine = ' '.repeat(spineCol) + paint(g.spine, theme.line)

  const rows: string[] = []
  const gap = () => {
    if (rows.length > 0) rows.push(spine)
  }
  for (const grp of groups) {
    if (grp.heading !== undefined) {
      gap()
      rows.push(' '.repeat(indent) + paint(`[${grp.heading}]`, accent))
    }
    for (const p of grp.periods) {
      gap()
      const [head = '', ...rest] = wrapped.get(p) ?? []
      const first = p.events[0]
      rows.push(
        ' '.repeat(indent) +
          ' '.repeat(labelWidth - displayWidth(head)) +
          paint(head, theme.fg) +
          ' ' +
          paint(g.arm, theme.line) +
          paint(g.node, accent) +
          paint(g.arm, theme.line) +
          (first !== undefined ? ' ' + paint(first, theme.fg) : ''),
      )
      // Further label lines and events share the rows below the marker.
      const extra = Math.max(rest.length, p.events.length - 1)
      for (let i = 0; i < extra; i++) {
        const l = rest[i]
        const e = p.events[i + 1]
        rows.push(
          ' '.repeat(indent) +
            (l === undefined
              ? ' '.repeat(labelWidth)
              : ' '.repeat(labelWidth - displayWidth(l)) + paint(l, theme.fg)) +
            ' '.repeat(spineCol - indent - labelWidth) +
            paint(g.spine, theme.line) +
            (e === undefined ? '' : '   ' + paint(e, theme.fg)),
        )
      }
    }
  }
  if (rows.length === 0) rows.push(spine)
  rows.push(' '.repeat(spineCol) + paint(g.arrow, theme.arrow))

  const out: string[] = []
  if (tl.title) {
    const width = Math.max(...rows.map((r) => displayWidth(stripAnsi(r))))
    const pad = Math.max(0, Math.floor((width - displayWidth(tl.title)) / 2))
    out.push(' '.repeat(pad) + paint(tl.title, theme.fg), '')
  }
  return [...out, ...rows].join('\n')
}

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, '')
