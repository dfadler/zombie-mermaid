/**
 * Radar agreement against official mermaid.js (#2814), for
 * scripts/radar-oracle.ts and __tests__/radar-agreement.test.ts. Browser-free
 * so it can be unit-tested.
 *
 * A radar is pure arithmetic (no text wrapping, no measured sizes), so every
 * figure can be compared exactly: the viewBox, the graticule rings, each
 * axis spoke and where its label sits and anchors, each curve's path or
 * polygon, the legend rows and the title. Elements are read from both SVGs by
 * their Mermaid class names (`radarGraticule`, `radarAxisLine`,
 * `radarAxisLabel`, `radarCurve-N`, `radarLegendBox-N`, `radarLegendText`,
 * `radarTitle`) and compared in drawing order. Colours, fonts and the CSS are
 * not compared; numbers match within 0.01 (we round to two decimals).
 */
import { renderMermaidSVG } from '../../src/index.ts'

/** Sources scored next to the radar gallery samples: the edge cases of the geometry. */
export const RADAR_EXTRA_SOURCES: Record<string, string> = {
  'Radar edge: one axis': 'radar-beta\naxis a\ncurve c{3}',
  'Radar edge: two axes, polygon':
    'radar-beta\naxis a, b\ncurve c{1, 2}\ngraticule polygon',
  'Radar edge: fractional ticks':
    'radar-beta\naxis a, b, c\ncurve c{1, 2, 3}\nticks 2.5',
  'Radar edge: no ticks': 'radar-beta\naxis a, b, c\ncurve c{1, 2, 3}\nticks 0',
  'Radar edge: axes only': 'radar-beta\naxis a, b, c, d',
  'Radar edge: min above values':
    'radar-beta\naxis a, b, c\ncurve c{1, 2, 3}\nmin 5\nmax 10',
  'Radar edge: many ticks':
    'radar-beta\naxis a, b, c\ncurve c{1, 2, 3}\nticks 40',
  'Radar edge: markup in labels':
    'radar-beta\ntitle A & B\naxis a["<x> & y"], b, c\ncurve c["1 < 2"]{1, 2, 3}',
}

export interface RadarElement {
  /** The Mermaid class name, `radarCurve-0` and so on. */
  cls: string
  tag: string
  attrs: Record<string, string>
  /** Text content of a `<text>`. */
  text?: string
}

export interface RadarSvg {
  viewBox: string
  /** The `translate(x, y)` of the group holding the chart. */
  center: string
  elements: RadarElement[]
}

const TOLERANCE = 0.01
const NUMBER = /-?\d+(?:\.\d+)?(?:e[-+]?\d+)?|NaN|-?Infinity/gi

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

/** Read the radar elements, in drawing order, from an official or our SVG. */
export function parseRadarSvg(svg: string): RadarSvg {
  const viewBox = /viewBox="([^"]*)"/.exec(svg)?.[1] ?? ''
  const center = /<g transform="(translate\([^"]*\))"/.exec(svg)?.[1] ?? ''
  const elements: RadarElement[] = []
  for (const m of svg.matchAll(
    /<(circle|polygon|line|text|path|rect|g)\b([^>]*?)\/?>(?:([^<]*)<\/text>)?/g,
  )) {
    const attrs: Record<string, string> = {}
    for (const a of m[2]!.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]!] = a[2]!
    const cls = attrs.class
    if (m[1] === 'g') {
      // A legend row is the only other group; keep its position.
      if (attrs.transform && !attrs.class && elements.length > 0)
        elements.push({ cls: 'legendRow', tag: 'g', attrs })
      continue
    }
    if (!cls?.startsWith('radar')) continue
    delete attrs.class
    const el: RadarElement = { cls, tag: m[1]!, attrs }
    if (m[1] === 'text') el.text = unescape(m[3] ?? '')
    elements.push(el)
  }
  return { viewBox, center, elements }
}

function numbersMatch(a: string, b: string): boolean {
  // Same commands and separators, numbers within tolerance.
  if (a.replace(NUMBER, '#') !== b.replace(NUMBER, '#')) return false
  const x = a.match(NUMBER) ?? []
  const y = b.match(NUMBER) ?? []
  return x.every((n, i) => {
    const u = Number(n)
    const v = Number(y[i])
    return Object.is(u, v) || Math.abs(u - v) <= TOLERANCE
  })
}

/** Everything in which `ours` differs from the official SVG; empty when they agree. */
export function radarSvgMismatches(
  official: RadarSvg,
  ours: RadarSvg,
): string[] {
  const out: string[] = []
  if (official.viewBox !== ours.viewBox)
    out.push(`viewBox: ${official.viewBox} official, ${ours.viewBox} ours`)
  if (!numbersMatch(official.center, ours.center))
    out.push(`centre: ${official.center} official, ${ours.center} ours`)
  const a = official.elements
  const b = ours.elements
  if (a.length !== b.length)
    out.push(`elements: ${a.length} official, ${b.length} ours`)
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const o = a[i]!
    const u = b[i]!
    if (o.cls !== u.cls || o.tag !== u.tag) {
      out.push(
        `element ${i}: ${o.tag}.${o.cls} official, ${u.tag}.${u.cls} ours`,
      )
      continue
    }
    if (o.text !== u.text)
      out.push(`${o.cls} ${i}: text "${o.text}" official, "${u.text}" ours`)
    for (const key of new Set([
      ...Object.keys(o.attrs),
      ...Object.keys(u.attrs),
    ])) {
      const x = o.attrs[key]
      const y = u.attrs[key]
      if (x === undefined || y === undefined || !numbersMatch(x, y))
        out.push(`${o.cls} ${i}: ${key} ${x ?? '-'} official, ${y ?? '-'} ours`)
    }
  }
  return out
}

/** Render `source` with our SVG renderer and compare it with the official SVG. */
export function radarMismatches(source: string, officialSvg: string): string[] {
  return radarSvgMismatches(
    parseRadarSvg(officialSvg),
    parseRadarSvg(renderMermaidSVG(source)),
  )
}
