/**
 * Wardley agreement against official mermaid.js (#2820), for
 * scripts/wardley-oracle.ts and __tests__/wardley-agreement.test.ts.
 * Browser-free so it can be unit-tested.
 *
 * A Wardley map is a projection of percentages onto a fixed canvas, so every
 * figure is comparable exactly. The SVGs are read as a flat list of drawing
 * elements (`line`, `circle`, `rect`, `path`, `text`) in document order, each
 * with the class of its nearest enclosing group, and only their geometry
 * (`x`, `y`, `x1`..`y2`, `cx`, `cy`, `r`, `width`, `height`, `rx`, `ry`, `d`,
 * `transform`) and text are compared: colours, fonts and the CSS are ours.
 * Numbers match within 0.01 (we round to two decimals); the width of the
 * annotations box depends on measured text, so it gets 10%.
 */
import { renderMermaidSVG } from '../../src/index.ts'

/** Sources scored next to the Wardley gallery samples: the edge cases of the geometry. */
export const WARDLEY_EXTRA_SOURCES: Record<string, string> = {
  'Wardley edge: header only': 'wardley-beta',
  'Wardley edge: title and size':
    'wardley-beta\ntitle A & B <c>\nsize [400, 300]\nanchor A [0.5, 0.5]',
  'Wardley edge: percentages above 1':
    'wardley-beta\ncomponent A [50.0, 25.5]\ncomponent B [100.0, 0.0]\nA -> B',
  'Wardley edge: a value of exactly 1':
    'wardley-beta\ncomponent A [1.0, 1.0]\ncomponent B [0.0, 0.0]\nA -> B',
  'Wardley edge: two stages with boundaries':
    'wardley-beta\nevolution Before@0.3 -> After@1.0\ncomponent A [0.5, 0.5]',
  'Wardley edge: three stages, no boundaries':
    'wardley-beta\nevolution One -> Two -> Three\ncomponent A [0.5, 0.5]',
  'Wardley edge: boundaries on some stages only':
    'wardley-beta\nevolution One@0.3 -> Two -> Three@1.0\ncomponent A [0.5, 0.5]',
  'Wardley edge: second names':
    'wardley-beta\nevolution A / B -> C@0.6 / D -> E\ncomponent X [0.5, 0.5]',
  'Wardley edge: quoted names':
    'wardley-beta\ncomponent "Two words" [0.5, 0.5]\ncomponent \'It is\' [0.2, 0.2]\n"Two words" -> \'It is\'',
  'Wardley edge: names with digits and symbols':
    'wardley-beta\ncomponent R&D (lab) [0.5, 0.5]\ncomponent _3d-x [0.2, 0.7]\nR&D (lab) -> _3d-x',
  'Wardley edge: label offsets':
    'wardley-beta\ncomponent A [0.5, 0.5] label [-30, 12]\ncomponent B [0.3, 0.3] label [10, -4]\ncomponent C [0.8, 0.8] label [0, 0]',
  'Wardley edge: inertia forms':
    'wardley-beta\ncomponent A [0.5, 0.5] inertia\ncomponent B [0.3, 0.3] (inertia)\ncomponent C [0.8, 0.8] (market) inertia\ncomponent D [0.2, 0.2] (outsource) (inertia)',
  'Wardley edge: every flow and arrow':
    "wardley-beta\ncomponent A [0.9, 0.2]\ncomponent B [0.6, 0.4]\ncomponent C [0.3, 0.6]\ncomponent D [0.1, 0.8]\nA -> B\nA --> C\nA > D\nB +> C\nB +< D\nC +<> D\nA -.-> B\nB ->  C +>\nD -> A +<>\nC +'forward'> D\nA +'back'< C\nB +'both'<> D",
  'Wardley edge: link to an unknown name':
    'wardley-beta\ncomponent A [0.5, 0.5]\nA -> Nowhere\nNowhere -> A',
  'Wardley edge: link label wins over nothing':
    "wardley-beta\ncomponent A [0.8, 0.2]\ncomponent B [0.2, 0.8]\nA -> B ;  spaced out  \nB +'on arrow'> A ; and label",
  'Wardley edge: evolve':
    'wardley-beta\ncomponent A [0.5, 0.2]\nevolve A 0.9\nevolve A 0.1\nevolve Nope 0.5\ncomponent B [0.3, 0.8]\nevolve B 0.31',
  'Wardley edge: pipeline with labels and links':
    'wardley-beta\ncomponent P [0.6, 0.3] (buy)\ncomponent Q [0.9, 0.5]\nQ -> P\npipeline P {\n  component One [0.2] label [-10, 15]\n  component Two [0.5]\n}\nP -> One\nOne -> P',
  'Wardley edge: two pipelines':
    'wardley-beta\ncomponent P [0.8, 0.2]\ncomponent Q [0.4, 0.6]\npipeline P {\n component A [0.1]\n component B [0.9]\n}\npipeline Q {\n component C [0.3]\n}',
  'Wardley edge: pipeline components out of order':
    'wardley-beta\ncomponent P [0.5, 0.5] inertia\npipeline P {\n component C [0.9]\n component A [0.1]\n component B [0.5]\n}',
  'Wardley edge: repeated component':
    'wardley-beta\ncomponent A [0.2, 0.2] label [5, 5]\ncomponent A [0.7, 0.7]\nanchor A [0.5, 0.5]',
  'Wardley edge: link by label':
    'wardley-beta\ncomponent "Cup of tea" [0.5, 0.5]\nanchor Me [0.9, 0.5]\nMe -> Cup of tea',
  'Wardley edge: annotations with integers':
    'wardley-beta\nannotations [1, 0]\nannotation 1,[0, 1] "first"\nannotation 3,[0.5, 0.5] "third"\nannotation 2,[0.2, 0.7] "second"',
  'Wardley edge: annotations box clamped to the top left':
    'wardley-beta\nannotations [1.0, 0.0]\nannotation 1,[0.5, 0.5] "clamped"',
  'Wardley edge: annotation without a box':
    'wardley-beta\nannotation 1,[0.5, 0.5] "alone"',
  'Wardley edge: annotations box without annotations':
    'wardley-beta\nannotations [0.5, 0.5]',
  'Wardley edge: notes and arrows':
    'wardley-beta\nnote "A note" [0.5, 0.5]\naccelerator Up [0.2, 0.2]\ndeaccelerator Down [0.8, 0.8]\naccelerator "Two words" [0.4, 0.4]',
  'Wardley edge: comments and blank lines':
    '%% before\nwardley-beta\n\n%% inside\ncomponent A [0.5, 0.5] %% trailing\n\n',
  'Wardley edge: front matter and directive':
    '---\ntitle: ignored\n---\n%%{init: {"theme": "default"}}%%\nwardley-beta\ncomponent A [0.5, 0.5]',
}

export interface WardleyElement {
  /** `class` of the nearest enclosing group, `wardley-links` and so on. */
  group: string
  tag: string
  /** Geometry attributes only. */
  attrs: Record<string, string>
  /** Text content of a `<text>`. */
  text?: string
}

export interface WardleySvg {
  viewBox: string
  elements: WardleyElement[]
}

const GEOMETRY = [
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'width',
  'height',
  'rx',
  'ry',
  'd',
  'transform',
] as const

const TOLERANCE = 0.01
const NUMBER = /-?\d+(?:\.\d+)?(?:e[-+]?\d+)?|NaN|-?Infinity/gi

const unescape = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

/** `s` without each `open` ... `close` block (the definitions and CSS, which carry no drawing). */
function dropBlocks(s: string, open: string, close: string): string {
  let out = ''
  let at = 0
  for (;;) {
    const from = s.indexOf(open, at)
    if (from < 0) return out + s.slice(at)
    const to = s.indexOf(close, from)
    out += s.slice(at, from)
    if (to < 0) return out
    at = to + close.length
  }
}

/** Read the drawing elements, in document order, from an official or our SVG. */
export function parseWardleySvg(svg: string): WardleySvg {
  const viewBox = /viewBox="([^"]*)"/.exec(svg)?.[1] ?? ''
  const body = dropBlocks(
    dropBlocks(svg, '<defs', '</defs>'),
    '<style',
    '</style>',
  )
  const elements: WardleyElement[] = []
  const groups: string[] = []
  for (const m of body.matchAll(
    /<(\/?)(g|circle|rect|line|path|text)\b([^>]*?)(\/?)>(?:([^<]*)<\/text>)?/g,
  )) {
    const [, closing, tag, rest, selfClosing, text] = m
    const attrs: Record<string, string> = {}
    for (const a of (rest as string).matchAll(/([\w:-]+)="([^"]*)"/g))
      attrs[a[1] as string] = a[2] as string
    if (tag === 'g') {
      if (closing) groups.pop()
      else if (!selfClosing) groups.push(attrs.class ?? '')
      continue
    }
    if (closing) continue
    const geometry: Record<string, string> = {}
    for (const key of GEOMETRY)
      if (attrs[key] !== undefined)
        geometry[key] = (attrs[key] as string).replace(/\s+/g, ' ').trim()
    const el: WardleyElement = {
      group: [...groups].reverse().find((g) => g !== '') ?? '',
      tag: tag as string,
      attrs: geometry,
    }
    if (tag === 'text') el.text = unescape(text ?? '')
    elements.push(el)
  }
  return { viewBox, elements }
}

function numbersMatch(a: string, b: string, tolerance: number): boolean {
  // Same commands and separators, numbers within tolerance.
  if (a.replace(NUMBER, '#') !== b.replace(NUMBER, '#')) return false
  const x = a.match(NUMBER) ?? []
  const y = b.match(NUMBER) ?? []
  return x.every((n, i) => {
    const u = Number(n)
    const v = Number(y[i])
    return Object.is(u, v) || Math.abs(u - v) <= tolerance
  })
}

/** Everything in which `ours` differs from the official SVG; empty when they agree. */
export function wardleySvgMismatches(
  official: WardleySvg,
  ours: WardleySvg,
): string[] {
  const out: string[] = []
  if (official.viewBox !== ours.viewBox)
    out.push(`viewBox: ${official.viewBox} official, ${ours.viewBox} ours`)
  const a = official.elements
  const b = ours.elements
  if (a.length !== b.length)
    out.push(`elements: ${a.length} official, ${b.length} ours`)
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const o = a[i] as WardleyElement
    const u = b[i] as WardleyElement
    if (o.group !== u.group || o.tag !== u.tag) {
      out.push(
        `element ${i}: ${o.tag} in ${o.group || '-'} official, ${u.tag} in ${u.group || '-'} ours`,
      )
      continue
    }
    if (o.text !== u.text)
      out.push(`${o.group} ${i}: text "${o.text}" official, "${u.text}" ours`)
    for (const key of new Set([
      ...Object.keys(o.attrs),
      ...Object.keys(u.attrs),
    ])) {
      const x = o.attrs[key]
      const y = u.attrs[key]
      // The box is as wide as its widest text, which we estimate rather than measure.
      const loose =
        o.group === 'wardley-annotations-box' &&
        o.tag === 'rect' &&
        key === 'width'
      if (x === undefined || y === undefined) {
        out.push(
          `${o.group} ${i}: ${key} ${x ?? 'absent'} official, ${y ?? 'absent'} ours`,
        )
      } else if (loose) {
        if (Math.abs(Number(x) - Number(y)) > Number(x) * 0.1)
          out.push(`${o.group} ${i}: ${key} ${x} official, ${y} ours`)
      } else if (!numbersMatch(x, y, TOLERANCE)) {
        out.push(`${o.group} ${i}: ${key} ${x} official, ${y} ours`)
      }
    }
  }
  return out
}

/** Compare our render of `source` with `officialSvg` (mermaid's render of the same). */
export function wardleyMismatches(
  source: string,
  officialSvg: string,
): string[] {
  return wardleySvgMismatches(
    parseWardleySvg(officialSvg),
    parseWardleySvg(renderMermaidSVG(source)),
  )
}
