/**
 * Ishikawa agreement against official mermaid.js (#2809), for
 * scripts/ishikawa-oracle.ts and __tests__/ishikawa-agreement.test.ts.
 * Browser-free so it can be unit-tested.
 *
 * Mermaid measures text in the browser; we use font metrics, so text widths
 * (and with them every x that depends on a label) differ by a few percent. What
 * does not depend on a width is compared exactly (1px): the drawing order and
 * count of every element by its class name, all text and its line breaks, the
 * vector of every bone (`dx`, `dy`), and every y relative to the spine. The
 * frame is compared loosely: height within 3% and width within 15%.
 */
import { renderMermaidSVG } from '../../src/index.ts'

/** Sources scored next to the ishikawa gallery samples: the edge cases of the layout. */
export const ISHIKAWA_EXTRA_SOURCES: Record<string, string> = {
  'Ishikawa edge: effect only': 'ishikawa\n  Effect',
  'Ishikawa edge: one category':
    'ishikawa\n  Effect\n    A\n      a1\n      a2',
  'Ishikawa edge: categories without causes':
    'ishikawa\n  Effect\n    A\n    B\n    C',
  'Ishikawa edge: uneven sides':
    'ishikawa\n  Effect\n    A\n      a1\n      a2\n      a3\n      a4\n    B\n      b1\n    C\n    D',
  'Ishikawa edge: deep nesting':
    'ishikawa\n  Effect\n    A\n      a\n        b\n          c\n            d',
  'Ishikawa edge: skipped and shallower levels':
    'ishikawa\n  Effect\n      A\n  B\n          b1\n    b2',
  'Ishikawa edge: long labels wrap':
    'ishikawa\n  A very long effect label that wraps\n    A category with a long name\n      A cause that is long enough to wrap onto lines',
  'Ishikawa edge: br in labels':
    'ishikawa\n  Effect<br>two lines\n    Cat<br/>egory\n      cause<br>break',
  'Ishikawa edge: comments and blank lines':
    'ishikawa\n%% a comment\n  Effect\n\n    A\n    %% another\n    B\n\n%% last',
  'Ishikawa edge: tabs': 'ishikawa\n\tEffect\n\t\tA\n\t\t\tb',
  'Ishikawa edge: markup in labels':
    'ishikawa\n  A & B\n    <x> & y\n      1 < 2',
}

export interface IshikawaLineEl {
  cls: string
  dx: number
  dy: number
  /** `y1` less the spine's y. */
  y: number
}

export interface IshikawaSvg {
  width: number
  height: number
  /** Every ishikawa element's class, in drawing order. */
  classes: string[]
  lines: IshikawaLineEl[]
  /** Text per `<text>`, its lines joined with `\n`. */
  texts: string[]
}

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

/** Read the ishikawa elements, in drawing order, from an official or our SVG. */
export function parseIshikawaSvg(svg: string): IshikawaSvg {
  const vb = /viewBox="[^"]*?([\d.e+-]+) ([\d.e+-]+)"/.exec(svg)
  const classes: string[] = []
  const lines: IshikawaLineEl[] = []
  const texts: string[] = []
  const raw: Array<{
    cls: string
    x1: number
    y1: number
    x2: number
    y2: number
  }> = []
  for (const m of svg.matchAll(
    /<(line|rect|text|path)\b([^>]*?)\/?>(?:((?:<tspan[^>]*>[^<]*<\/tspan>)*)<\/text>)?/g,
  )) {
    const attrs: Record<string, string> = {}
    for (const a of m[2]!.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]!] = a[2]!
    const cls = attrs.class
    if (!cls?.startsWith('ishikawa-') || cls === 'ishikawa-arrow') continue
    classes.push(`${m[1]}.${cls}`)
    if (m[1] === 'line')
      raw.push({
        cls,
        x1: Number(attrs.x1),
        y1: Number(attrs.y1),
        x2: Number(attrs.x2),
        y2: Number(attrs.y2),
      })
    if (m[1] === 'text')
      texts.push(
        [...(m[3] ?? '').matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)]
          .map((t) => unescape(t[1]!))
          .join('\n'),
      )
  }
  const spineY = raw.find((l) => l.cls === 'ishikawa-spine')?.y1 ?? 0
  for (const l of raw)
    lines.push({
      cls: l.cls,
      dx: l.x2 - l.x1,
      dy: l.y2 - l.y1,
      y: l.y1 - spineY,
    })
  return {
    width: Number(vb?.[1] ?? 0),
    height: Number(vb?.[2] ?? 0),
    classes,
    lines,
    texts,
  }
}

const near = (a: number, b: number, tol = 1): boolean => Math.abs(a - b) <= tol

/** Everything in which `ours` differs from the official SVG; empty when they agree. */
export function ishikawaSvgMismatches(
  official: IshikawaSvg,
  ours: IshikawaSvg,
): string[] {
  const out: string[] = []
  if (official.classes.join() !== ours.classes.join())
    out.push(
      `elements: ${official.classes.length} official, ${ours.classes.length} ours (or a different order)`,
    )
  if (official.texts.join('|') !== ours.texts.join('|'))
    out.push(
      `text: ${JSON.stringify(official.texts)} official, ${JSON.stringify(ours.texts)} ours`,
    )
  if (official.lines.length === ours.lines.length)
    official.lines.forEach((o, i) => {
      const u = ours.lines[i]!
      // The spine's length and the bones' x depend on text widths; everything else does not.
      const spine = o.cls === 'ishikawa-spine'
      if (!spine && !(near(o.dx, u.dx) && near(o.dy, u.dy)))
        out.push(
          `${o.cls} ${i}: vector (${o.dx}, ${o.dy}) official, (${u.dx}, ${u.dy}) ours`,
        )
      if (!near(o.y, u.y))
        out.push(`${o.cls} ${i}: ${o.y} below the spine official, ${u.y} ours`)
    })
  const ratio = (a: number, b: number): number =>
    a === 0 ? (b === 0 ? 0 : 1) : Math.abs(a - b) / a
  if (ratio(official.height, ours.height) > 0.03)
    out.push(`height: ${official.height} official, ${ours.height} ours`)
  if (ratio(official.width, ours.width) > 0.15)
    out.push(`width: ${official.width} official, ${ours.width} ours`)
  return out
}

/** Render `source` with our SVG renderer and compare it with the official SVG. */
export function ishikawaMismatches(
  source: string,
  officialSvg: string,
): string[] {
  return ishikawaSvgMismatches(
    parseIshikawaSvg(officialSvg),
    parseIshikawaSvg(renderMermaidSVG(source)),
  )
}
