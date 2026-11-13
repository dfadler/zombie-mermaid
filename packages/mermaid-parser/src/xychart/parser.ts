import { sanitizeTitle } from '../sanitize-title.ts'
import type { XyChartInitConfig } from '@zombie-mermaid/core'
import type { XYChart, XYAxis, XYChartSeries } from './types.ts'
import {
  decodeMermaidEntities,
  MermaidParseError,
  type Statement,
} from '@zombie-mermaid/core'

// ============================================================================
// XY Chart parser
//
// Parses Mermaid xychart-beta syntax into a typed XYChart structure.
//
// Supported directives:
//   xychart-beta [horizontal]
//   title "Chart Title"
//   x-axis [label1, label2, ...]          — categorical
//   x-axis min --> max                     — numeric range
//   x-axis "Axis Title" [label1, ...]      — with title
//   x-axis "Axis Title" min --> max        — with title
//   y-axis (same patterns)
//   bar [val1, val2, ...]
//   line [val1, val2, ...]
// ============================================================================

/**
 * Parse a Mermaid xychart-beta diagram from preprocessed lines.
 * Lines should already be trimmed and comment-stripped.
 */
export function parseXYChart(
  lines: Statement[],
  config?: XyChartInitConfig,
): XYChart {
  const xAxis: XYAxis = {}
  const yAxis: XYAxis = {}
  const series: XYChartSeries[] = []
  let title: string | undefined
  let horizontal = false

  for (const stmt of lines) {
    const line = stmt.text
    // Header line — detect horizontal
    if (/^xychart(-beta)?\b/i.test(line)) {
      if (/\bhorizontal\b/i.test(line)) horizontal = true
      continue
    }

    // Title
    const titleMatch = line.match(/^title\s+"([^"]+)"/)
    if (titleMatch) {
      title = sanitizeTitle(titleMatch[1]!)
      continue
    }
    // Unquoted: letters, digits and spaces only, spaces dropped (mermaid 12.3.0, #2728)
    const bareTitle = bareText(line, 'title')
    if (bareTitle !== null) {
      title = sanitizeTitle(bareTitle)
      continue
    }

    // x-axis with categories: x-axis "Title" [a, b, c] or x-axis [a, b, c]
    const xCatMatch = line.match(
      /^x-axis\s+(?:"([^"]*)"\s*|([A-Za-z0-9]+)\s*)?\[([^\]]+)\]/,
    )
    if (xCatMatch) {
      if (xCatMatch[1]) xAxis.title = decodeMermaidEntities(xCatMatch[1])
      else if (xCatMatch[2]) xAxis.title = xCatMatch[2]
      xAxis.categories = splitCategoryList(xCatMatch[3]!).map((s) =>
        decodeMermaidEntities(categoryLabel(s.trim(), line, stmt.line)),
      )
      continue
    }

    // x-axis with range: x-axis "Title" min --> max or x-axis min --> max
    const xRangeMatch = line.match(
      /^x-axis\s+(?:"([^"]*)"\s+|([A-Za-z][A-Za-z0-9]*)\s+)?(-?\d+(?:\.\d+)?)\s*-->\s*(-?\d+(?:\.\d+)?)/,
    )
    if (xRangeMatch) {
      if (xRangeMatch[1]) xAxis.title = decodeMermaidEntities(xRangeMatch[1])
      else if (xRangeMatch[2]) xAxis.title = xRangeMatch[2]
      xAxis.range = {
        min: parseFloat(xRangeMatch[3]!),
        max: parseFloat(xRangeMatch[4]!),
      }
      continue
    }

    // y-axis with range: y-axis "Title" min --> max or y-axis min --> max
    const yRangeMatch = line.match(
      /^y-axis\s+(?:"([^"]*)"\s+)?(-?\d+(?:\.\d+)?)\s*-->\s*(-?\d+(?:\.\d+)?)/,
    )
    const yBareRange = yRangeMatch ? null : bareYRange(line)
    if (yRangeMatch || yBareRange) {
      if (yRangeMatch?.[1]) yAxis.title = decodeMermaidEntities(yRangeMatch[1])
      else if (yBareRange) yAxis.title = yBareRange.title
      yAxis.range = {
        min: parseFloat((yRangeMatch?.[2] ?? yBareRange?.min)!),
        max: parseFloat((yRangeMatch?.[3] ?? yBareRange?.max)!),
      }
      continue
    }

    // y-axis with just title (no range)
    const yTitleOnly = line.match(/^y-axis\s+"([^"]+)"\s*$/)
    if (yTitleOnly) {
      yAxis.title = decodeMermaidEntities(yTitleOnly[1]!)
      continue
    }
    const yBareTitle = bareText(line, 'y-axis')
    if (yBareTitle !== null && /^[A-Za-z]/.test(yBareTitle)) {
      yAxis.title = yBareTitle
      continue
    }

    // Bar [...]
    const barMatch = line.match(/^bar\s+\[([^\]]+)\]/)
    if (barMatch) {
      series.push({
        type: 'bar',
        data: parseNumericArray(barMatch[1]!, 'bar', line, stmt.line),
      })
      continue
    }

    // Line [...]
    const lineMatch = line.match(/^line\s+\[([^\]]+)\]/)
    if (lineMatch) {
      series.push({
        type: 'line',
        data: parseNumericArray(lineMatch[1]!, 'line', line, stmt.line),
      })
      continue
    }

    // None of the recognized directive shapes matched. A line that doesn't
    // start with any known xychart-beta keyword at all falls through
    // silently below, same as before — but a line that *does* start with
    // one of the five keyworded directives (x-axis/y-axis/bar/line/title)
    // and still failed every pattern above is almost certainly an attempt
    // at that directive with broken syntax (an unclosed bracket, a missing
    // quote, a malformed range). Previously this was silently dropped —
    // the diagram would render with that axis/series just missing and no
    // indication why. Surface an actionable error instead. See issue #541
    // (parser error-message quality audit — this parser had zero throw
    // sites before this pass).
    const keywordMatch = line.match(/^(x-axis|y-axis|bar|line|title)\b/i)
    if (keywordMatch) {
      throw malformedDirectiveError(
        keywordMatch[1]!.toLowerCase(),
        line,
        stmt.line,
      )
    }
  }

  // Auto-derive y-axis range from data if not specified
  if (!yAxis.range && series.length > 0) {
    const allValues = series.flatMap((s) => s.data)
    let min = Math.min(...allValues)
    let max = Math.max(...allValues)
    // Mermaid uses the raw data extent. Only a flat series (zero span) gets
    // a synthetic range, so the axis has something to draw.
    if (max === min) {
      min -= 0.1
      max += 0.1
    }
    yAxis.range = { min, max }
  }

  // Fallback y-axis range
  if (!yAxis.range) {
    yAxis.range = { min: 0, max: 100 }
  }

  // The init block overrides the header: mermaid's config is merged in after
  // the diagram text sets `orientation` (12.3.0).
  if (config?.chartOrientation)
    horizontal = config.chartOrientation === 'horizontal'
  if (config?.showTitle === false) title = undefined
  if (config?.xAxis?.showTitle === false) delete xAxis.title
  if (config?.yAxis?.showTitle === false) delete yAxis.title
  return { title, horizontal, xAxis, yAxis, series, ...(config && { config }) }
}

/**
 * Split a categorical x-axis bracket's comma-separated contents into raw
 * item strings, treating a comma *inside* a double-quoted item as literal
 * text rather than a delimiter. A naive `.split(',')` would break
 * `["Jan, Feb", "Mar"]` into three pieces instead of two — quoting a value
 * that itself contains a comma is exactly the case quoting exists for. Each
 * returned raw item is still trimmed and unquoted by the caller.
 */
function splitCategoryList(str: string): string[] {
  const items: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of str) {
    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === ',' && !inQuotes) {
      items.push(current)
      current = ''
    } else {
      current += char
    }
  }
  items.push(current)
  return items
}

/**
 * An unquoted `title`/`y-axis` text: letters, digits and spaces, spaces dropped
 * (mermaid 12.3.0, #2728). Plain string steps keep it linear on hostile input.
 */
function bareText(line: string, keyword: string): string | null {
  if (!line.startsWith(keyword)) return null
  const rest = line.slice(keyword.length)
  if (rest.trimStart().length === rest.length) return null // Needs whitespace after the keyword
  const text = rest.trim()
  return /^[A-Za-z0-9\s]+$/.test(text) ? text.replace(/\s+/g, '') : null
}

/** `y-axis Unquoted Title 0 --> 5`: split on `-->`, the last word before it is the minimum. */
function bareYRange(
  line: string,
): { title: string; min: string; max: string } | null {
  if (!line.startsWith('y-axis')) return null
  const arrow = line.indexOf('-->')
  if (arrow < 0) return null
  const left = line.slice('y-axis'.length, arrow).trim()
  const max = line.slice(arrow + 3).trim()
  const cut = Math.max(left.lastIndexOf(' '), left.lastIndexOf('\t'))
  const min = left.slice(cut + 1)
  const raw = cut < 0 ? '' : left.slice(0, cut)
  const title = bareText('y-axis ' + raw, 'y-axis')
  if (title === null || !/^[A-Za-z]/.test(title)) return null
  if (!/^-?\d+(\.\d+)?$/.test(min) || !/^-?\d+(\.\d+)?$/.test(max)) return null
  return { title, min, max }
}

/** Characters mermaid 12.3.0's xychart lexer accepts in an unquoted category (plus whitespace). */
const UNQUOTED_CATEGORY = /^[A-Za-z0-9+=*#_.&\s-]+$/

/**
 * Resolve one category item the way mermaid 12.3.0 does. A `"quoted"` item
 * keeps its text (#1087). An unquoted item may only use letters, digits and
 * `+ = * # _ . & -`; whitespace inside it is dropped, so `New Users` becomes
 * `NewUsers` (#2728). Anything else (`/users`, `:`, `;`, an empty item, a
 * quote in the middle) is a parse error there (#2716).
 */
function categoryLabel(
  value: string,
  line: string,
  lineNumber: number,
): string {
  if (/^"[^"]*"$/.test(value)) return value.slice(1, -1)
  if (UNQUOTED_CATEGORY.test(value)) return value.replace(/\s+/g, '')
  throw new MermaidParseError(
    `Line ${lineNumber}: Invalid x-axis category ${JSON.stringify(value)} in "${line}". Unquoted categories may only contain letters, digits and + = * # _ . & -; wrap other labels in double quotes.`,
    { diagramType: 'xychart' },
  )
}

/**
 * Parse a `bar`/`line` series' comma-separated bracket contents into
 * numbers, throwing on any element that isn't a valid number instead of
 * silently coercing it to `NaN` (which serializes as `null` and can
 * propagate into layout math with no indication anything was wrong — see
 * issue #541's audit finding on this exact parser).
 */
function parseNumericArray(
  str: string,
  seriesType: 'bar' | 'line',
  line: string,
  lineNumber: number,
): number[] {
  return str.split(',').map((raw, index) => {
    const trimmed = raw.trim()
    const value = parseFloat(trimmed)
    if (trimmed.length === 0 || Number.isNaN(value)) {
      throw new MermaidParseError(
        `Line ${lineNumber}: Invalid numeric value ${JSON.stringify(trimmed)} at position ${
          index + 1
        } in "${line}". Every value in a ${seriesType} [...] list must be a number.`,
        { diagramType: 'xychart' },
      )
    }
    return value
  })
}

/** Expected-syntax hint per xychart-beta keyword, for `malformedDirectiveError`. */
const XYCHART_DIRECTIVE_HELP: Record<string, string> = {
  'x-axis':
    'x-axis [A, B, C] (categories) or x-axis 0 --> 100 (numeric range), either optionally preceded by a quoted title',
  'y-axis':
    'y-axis 0 --> 100 (numeric range) or y-axis "Title" (title only), optionally preceded by a quoted title before a range',
  bar: 'bar [10, 20, 30] — a comma-separated numeric array in square brackets',
  line: 'line [10, 20, 30] — a comma-separated numeric array in square brackets',
  title: 'title "Chart Title" — a double-quoted string',
}

/**
 * Build the error for a line that starts with a recognized xychart-beta
 * keyword (x-axis/y-axis/bar/line/title) but doesn't match that keyword's
 * expected syntax in any of the forms this parser supports.
 */
function malformedDirectiveError(
  keyword: string,
  line: string,
  lineNumber: number,
): Error {
  const help = XYCHART_DIRECTIVE_HELP[keyword] ?? keyword
  return new MermaidParseError(
    `Line ${lineNumber}: Malformed xychart-beta "${keyword}" directive: "${line}". Expected: ${help}.`,
    { diagramType: 'xychart' },
  )
}
