import type { XYChart, XYAxis, XYChartSeries } from './types.ts'

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
export function parseXYChart(lines: string[]): XYChart {
  const xAxis: XYAxis = {}
  const yAxis: XYAxis = {}
  const series: XYChartSeries[] = []
  let title: string | undefined
  let horizontal = false

  for (const line of lines) {
    // Header line — detect horizontal
    if (/^xychart(-beta)?\b/i.test(line)) {
      if (/\bhorizontal\b/i.test(line)) horizontal = true
      continue
    }

    // Title
    const titleMatch = line.match(/^title\s+"([^"]+)"/)
    if (titleMatch) {
      title = titleMatch[1]
      continue
    }

    // x-axis with categories: x-axis "Title" [a, b, c] or x-axis [a, b, c]
    const xCatMatch = line.match(/^x-axis\s+(?:"([^"]*)"\s*)?\[([^\]]+)\]/)
    if (xCatMatch) {
      if (xCatMatch[1]) xAxis.title = xCatMatch[1]
      xAxis.categories = xCatMatch[2]!.split(',').map((s) => s.trim())
      continue
    }

    // x-axis with range: x-axis "Title" min --> max or x-axis min --> max
    const xRangeMatch = line.match(
      /^x-axis\s+(?:"([^"]*)"\s+)?(-?\d+(?:\.\d+)?)\s*-->\s*(-?\d+(?:\.\d+)?)/,
    )
    if (xRangeMatch) {
      if (xRangeMatch[1]) xAxis.title = xRangeMatch[1]
      xAxis.range = {
        min: parseFloat(xRangeMatch[2]!),
        max: parseFloat(xRangeMatch[3]!),
      }
      continue
    }

    // y-axis with range: y-axis "Title" min --> max or y-axis min --> max
    const yRangeMatch = line.match(
      /^y-axis\s+(?:"([^"]*)"\s+)?(-?\d+(?:\.\d+)?)\s*-->\s*(-?\d+(?:\.\d+)?)/,
    )
    if (yRangeMatch) {
      if (yRangeMatch[1]) yAxis.title = yRangeMatch[1]
      yAxis.range = {
        min: parseFloat(yRangeMatch[2]!),
        max: parseFloat(yRangeMatch[3]!),
      }
      continue
    }

    // y-axis with just title (no range)
    const yTitleOnly = line.match(/^y-axis\s+"([^"]+)"\s*$/)
    if (yTitleOnly) {
      yAxis.title = yTitleOnly[1]
      continue
    }

    // bar [...]
    const barMatch = line.match(/^bar\s+\[([^\]]+)\]/)
    if (barMatch) {
      series.push({
        type: 'bar',
        data: parseNumericArray(barMatch[1]!, 'bar', line),
      })
      continue
    }

    // line [...]
    const lineMatch = line.match(/^line\s+\[([^\]]+)\]/)
    if (lineMatch) {
      series.push({
        type: 'line',
        data: parseNumericArray(lineMatch[1]!, 'line', line),
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
      throw malformedDirectiveError(keywordMatch[1]!.toLowerCase(), line)
    }
  }

  // Auto-derive y-axis range from data if not specified
  if (!yAxis.range && series.length > 0) {
    const allValues = series.flatMap((s) => s.data)
    let min = Math.min(...allValues)
    let max = Math.max(...allValues)
    const span = max - min || 1
    // Add 10% padding
    min = min - span * 0.1
    max = max + span * 0.1
    // Floor to 0 if all values are positive and min is close to 0
    if (min > 0 && min < span * 0.5) min = 0
    yAxis.range = { min, max }
  }

  // Fallback y-axis range
  if (!yAxis.range) {
    yAxis.range = { min: 0, max: 100 }
  }

  return { title, horizontal, xAxis, yAxis, series }
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
): number[] {
  return str.split(',').map((raw, index) => {
    const trimmed = raw.trim()
    const value = parseFloat(trimmed)
    if (trimmed.length === 0 || Number.isNaN(value)) {
      throw new Error(
        `Invalid numeric value ${JSON.stringify(trimmed)} at position ${
          index + 1
        } in "${line}". Every value in a ${seriesType} [...] list must be a number.`,
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
function malformedDirectiveError(keyword: string, line: string): Error {
  const help = XYCHART_DIRECTIVE_HELP[keyword] ?? keyword
  return new Error(
    `Malformed xychart-beta "${keyword}" directive: "${line}". Expected: ${help}.`,
  )
}
