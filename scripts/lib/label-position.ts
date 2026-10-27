/** Edge-label position measurement shared by label-position-oracle.ts and layout-oracle.ts (#1385, #1686). */

import { renderMermaidASCII } from '../../src/index.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface Case {
  name: string
  source: string
  from: string
  to: string
  label: string
}

export const CASES: Case[] = [
  {
    name: 'TD down edge',
    source: 'graph TD\n  A -->|push = build| B',
    from: 'A',
    to: 'B',
    label: 'push = build',
  },
  {
    name: 'TD one-word label',
    source: 'graph TD\n  A -->|go| B',
    from: 'A',
    to: 'B',
    label: 'go',
  },
  {
    name: 'LR edge',
    source: 'graph LR\n  A -->|push = build| B',
    from: 'A',
    to: 'B',
    label: 'push = build',
  },
  {
    name: 'TD reciprocal (A->B)',
    source: 'graph TD\n  A -->|down| B\n  B -->|up| A',
    from: 'A',
    to: 'B',
    label: 'down',
  },
]

export interface Pos {
  along: number
  across: number
}

/** Official: label centre along the gap between the two nodes, and off node A's centre line. */
async function official(
  session: RealMermaidSession,
  i: number,
  c: Case,
): Promise<Pos> {
  const svg = await renderRealMermaidSvg(session, `lp_${i}`, c.source)
  return session.page.evaluate(
    ([markup, from, to, text]) => {
      document.body.innerHTML = markup
      const box = (id: string) =>
        [...document.querySelectorAll('g.node')]
          .find((n) =>
            (n.getAttribute('id') ?? '').includes(`flowchart-${id}-`),
          )!
          .getBoundingClientRect()
      const a = box(from)
      const b = box(to)
      const r = [...document.querySelectorAll('g.edgeLabel')]
        .find((l) => (l.textContent ?? '').includes(text))!
        .getBoundingClientRect()
      const cy = r.y + r.height / 2
      const cx = r.x + r.width / 2
      if (Math.abs(a.y - b.y) > Math.abs(a.x - b.x)) {
        const along =
          a.y < b.y
            ? (cy - a.bottom) / (b.top - a.bottom)
            : (cy - b.bottom) / (a.top - b.bottom)
        return {
          along: a.y < b.y ? along : 1 - along,
          across: cx - (a.x + a.width / 2),
        }
      }
      const along =
        a.x < b.x
          ? (cx - a.right) / (b.left - a.right)
          : (cx - b.right) / (a.left - b.left)
      return {
        along: a.x < b.x ? along : 1 - along,
        across: cy - (a.y + a.height / 2),
      }
    },
    [svg, c.from, c.to, c.label] as [string, string, string, string],
  )
}

/** ASCII: label centre along the gap (box border to border) and off node A's centre column/row, in cells. */
function ascii(c: Case): Pos {
  const rows = renderMermaidASCII(c.source, { colorMode: 'none' }).split('\n')
  const find = (s: string) => {
    for (const [y, row] of rows.entries()) {
      const x = row.indexOf(s)
      if (x >= 0) return { x, y }
    }
    throw new Error(`"${s}" not found in:\n${rows.join('\n')}`)
  }
  const l = find(c.label)
  const a = find(c.from)
  const b = find(c.to)
  const cx = l.x + (c.label.length - 1) / 2
  if (c.source.startsWith('graph LR')) {
    const wall = /[│├┤]/g
    const walls = [...rows[a.y]!.matchAll(wall)].map((m) => m.index)
    const aRight = walls.find((x) => x > a.x)!
    const bLeft = walls.filter((x) => x < b.x).pop()!
    return { along: (cx - aRight) / (bLeft - aRight), across: l.y - a.y }
  }
  const aBottom = rows.findIndex((r, y) => y > a.y && r.includes('└'))
  const bTop = rows.findIndex((r, y) => y > aBottom && r.includes('┌'))
  return { along: (l.y - aBottom) / (bTop - aBottom), across: cx - a.x }
}

/** Official and ASCII label position for every case. */
export async function measureLabels(session: RealMermaidSession) {
  const out: { name: string; official: Pos; ascii: Pos }[] = []
  for (const [i, c] of CASES.entries()) {
    out.push({
      name: c.name,
      official: await official(session, i, c),
      ascii: ascii(c),
    })
  }
  return out
}
