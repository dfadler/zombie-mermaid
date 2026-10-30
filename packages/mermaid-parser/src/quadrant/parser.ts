import {
  MermaidParseError,
  decodeMermaidEntities,
  extractInitConfig,
} from '@zombie-mermaid/core'
import type {
  QuadrantChart,
  QuadrantPoint,
  QuadrantPointStyle,
} from './types.ts'

// ============================================================================
// Quadrant chart parser
//
// Parses Mermaid `quadrantChart` syntax (jison grammar in mermaid-js/mermaid
// packages/mermaid/src/diagrams/quadrant-chart/parser/quadrant.jison, checked
// against mermaid@12.2.0):
//
//   quadrantChart
//   title <text>
//   x-axis <left> [--> <right>]        y-axis <bottom> [--> <top>]
//   quadrant-1 <text> ... quadrant-4 <text>
//   classDef <name> <style>, <style>
//   <label>[:::<class>]: [x, y] [<style>, <style>]
//
// Rules taken from Mermaid:
//   - Coordinates lex as `1` or `0` / `0.<digits>`: anything else (`1.5`,
//     `-0.2`, `.5`, `1.0`) is a syntax error there, so it is one here.
//   - A style is `radius` (digits), `color` / `stroke-color` (3 or 6 hex
//     digits, `#` optional) or `stroke-width` (`<digits>px`); anything else
//     throws with Mermaid's messages.
//   - A point's own styles win over its class's; a class defined after the
//     point still applies.
//   - `x-axis Left -->` with nothing after the arrow appends ` ⟶ ` to the
//     label; `x-axis Left` alone leaves it as written.
//   - Quoted text drops its quotes. Keywords are case-insensitive, the header
//     is not (Mermaid's detector is `/^\s*quadrantChart/`).
//   - A bare `quadrantChart` is valid.
//
// Parsed from the raw text, not `Statement[]`: Mermaid's lexer does not treat
// `;` as a separator here, and a label may contain one. accTitle/accDescr are
// stripped by `extractAccessibility` before the renderers call this; called
// directly, they are accepted and ignored.
// ============================================================================

const SYNTAX_HELP =
  'Expected: title <text>, x-axis <left> --> <right>, y-axis <bottom> --> <top>, quadrant-1..quadrant-4 <text>, classDef <name> <styles>, or <label>: [x, y].'

const HEX = /^#?(?:[\dA-Fa-f]{6}|[\dA-Fa-f]{3})$/
const COORD = /^(?:1|0(?:\.\d+)?)$/

interface PointMatch {
  label: string
  cls?: string
  x: string
  y: string
  rest: string
}

const isSpace = (c: string | undefined) => c === ' ' || c === '\t'
const isWord = (c: string | undefined) => c !== undefined && /\w/.test(c)

/**
 * `<label>[:::<class>]: [x, y] <rest>` without a backtracking regex (user text
 * of any length must stay linear, #2436): try each `:` as the end of the label,
 * moving left to right as the lazy `.+?` it replaces did. `,` and `]` lookups
 * are cached so a line of `:[:[:[...` costs one scan, not one per candidate.
 */
function matchPoint(line: string): PointMatch | undefined {
  let comma = -2
  let close = -2
  const next = (cur: number, ch: string, from: number) =>
    cur >= from || cur === -1 ? cur : line.indexOf(ch, from)
  for (let e = line.indexOf(':', 1); e !== -1; e = line.indexOf(':', e + 1)) {
    let p = e
    let cls: string | undefined
    if (line.startsWith(':::', e)) {
      let q = e + 3
      while (isWord(line[q])) q++
      let r = q
      while (isSpace(line[r])) r++
      if (q > e + 3 && line[r] === ':') {
        cls = line.slice(e + 3, q)
        p = r
      }
    }
    let b = p + 1
    while (isSpace(line[b])) b++
    if (line[b] !== '[') continue
    b++
    comma = next(comma, ',', b)
    close = next(close, ']', b)
    if (comma === -1 || (close !== -1 && close < comma)) continue
    close = next(close, ']', comma + 1)
    if (close === -1) continue
    return {
      label: line.slice(0, e),
      cls,
      x: line.slice(b, comma).trim(),
      y: line.slice(comma + 1, close).trim(),
      rest: line.slice(close + 1).trim(),
    }
  }
  return undefined
}

/** Split `a --> b` on the first `--+>`; linear (no regex backtracking). */
function splitArrow(body: string): [string, string] | undefined {
  for (let i = body.indexOf('--'); i !== -1;) {
    let j = i
    while (body[j] === '-') j++
    if (body[j] === '>') {
      return [body.slice(0, i), body.slice(j + 1)]
    }
    i = body.indexOf('--', j)
  }
  return undefined
}

function fail(line: number, message: string, source: string): never {
  throw new MermaidParseError(
    `Line ${line}: ${message} in "${source.trim()}". ${SYNTAX_HELP}`,
    { diagramType: 'quadrant' },
  )
}

/** Text as Mermaid reads it: trimmed, quotes (and markdown backticks) dropped. */
function text(raw: string): string {
  let t = raw.trim()
  const m = /^"(?:`)?([^"]*?)(?:`)?"$/.exec(t)
  if (m) t = m[1]!.trim()
  return decodeMermaidEntities(t)
}

function withHash(color: string): string {
  return color.startsWith('#') ? color : `#${color}`
}

/** Mermaid's `parseStyles`, with its error messages. */
function parseStyles(
  raw: string,
  line: number,
  source: string,
): QuadrantPointStyle {
  const style: QuadrantPointStyle = {}
  for (const part of raw.split(',')) {
    if (!part.trim()) continue
    const [key = '', value = ''] = part.split(':').map((t) => t.trim())
    const invalid = (type: string): never =>
      fail(
        line,
        `value for ${key} ${value} is invalid, please use a valid ${type}`,
        source,
      )
    if (key === 'radius') {
      if (!/^\d+$/.test(value)) invalid('number')
      style.radius = parseInt(value, 10)
    } else if (key === 'color' || key === 'stroke-color') {
      if (!HEX.test(value)) invalid('hex code')
      style[key === 'color' ? 'color' : 'strokeColor'] = withHash(value)
    } else if (key === 'stroke-width') {
      if (!/^\d+px$/.test(value)) invalid('number of pixels (eg. 10px)')
      style.strokeWidth = value
    } else {
      fail(line, `style named ${key} is not supported.`, source)
    }
  }
  return style
}

/** Parse a Mermaid `quadrantChart` from raw source text. */
export function parseQuadrantChart(source: string): QuadrantChart {
  const chart: QuadrantChart = {
    quadrants: ['', '', '', ''],
    points: [],
    classes: {},
  }
  const raw: { point: QuadrantPoint; own: QuadrantPointStyle }[] = []
  let sawHeader = false
  let multiline = false

  source.split(/\r?\n/).forEach((full, i) => {
    const lineNo = i + 1
    // `%%{init}%%` directives and `%%` comments (to end of line).
    const hash = full.indexOf('%%')
    const line = (hash === -1 ? full : full.slice(0, hash)).trim()
    if (multiline) {
      if (line.includes('}')) multiline = false
      return
    }
    if (!line) return

    if (!sawHeader) {
      if (!/^quadrantChart(?:\s|$)/.test(line)) {
        fail(lineNo, 'Expected "quadrantChart" header', full)
      }
      sawHeader = true
      return
    }

    let m: RegExpExecArray | null
    if (/^acc(?:Title|Descr)\s*:/i.test(line)) return
    if (/^accDescr\s*\{/i.test(line)) {
      multiline = !line.includes('}')
      return
    }
    if ((m = /^title\b(.*)$/i.exec(line))) {
      chart.title = text(m[1]!)
      return
    }
    if ((m = /^(x|y)-axis\b(.*)$/i.exec(line))) {
      const [, axis, body] = m
      const arrow = splitArrow(body!)
      const first = text(arrow ? arrow[0] : body!)
      const second = arrow ? text(arrow[1]) : ''
      if (!first) fail(lineNo, `Missing ${axis}-axis label`, full)
      // `Left -->` with nothing after the arrow keeps the arrow, as Mermaid.
      const a = arrow && !second ? `${first} ⟶` : first
      if (axis!.toLowerCase() === 'x') {
        chart.xAxisLeft = a
        if (second) chart.xAxisRight = second
      } else {
        chart.yAxisBottom = a
        if (second) chart.yAxisTop = second
      }
      return
    }
    if ((m = /^quadrant-([1-4])\b(.*)$/i.exec(line))) {
      chart.quadrants[Number(m[1]) - 1] = text(m[2]!)
      return
    }
    if ((m = /^classDef\s+(\w+)/.exec(line))) {
      chart.classes[m[1]!] = parseStyles(line.slice(m[0].length), lineNo, full)
      return
    }
    const g = matchPoint(line)
    if (g) {
      if (!COORD.test(g.x) || !COORD.test(g.y)) {
        fail(
          lineNo,
          'Point coordinates must be 0, 1 or 0.<digits> (between 0 and 1)',
          full,
        )
      }
      const own = parseStyles(g.rest, lineNo, full)
      raw.push({
        point: {
          label: text(g.label),
          x: Number(g.x),
          y: Number(g.y),
          ...(g.cls ? { className: g.cls } : {}),
        },
        own,
      })
      return
    }
    fail(lineNo, 'Unrecognized statement', full)
  })

  if (!sawHeader) {
    throw new MermaidParseError('Line 1: Expected "quadrantChart" header.', {
      diagramType: 'quadrant',
    })
  }

  for (const { point, own } of raw) {
    const cls = point.className ? chart.classes[point.className] : undefined
    chart.points.push({ ...point, ...cls, ...own })
  }
  const { quadrant, themeVariables } = extractInitConfig(source.split(/\r?\n/))
  if (quadrant) chart.config = quadrant
  if (themeVariables?.quadrant) chart.themeColors = themeVariables.quadrant
  return chart
}
