/**
 * Error-message quality tests for the xychart-beta parser (issue #541).
 *
 * Before this pass, `parseXYChart` had zero `throw`/`Error` statements in
 * the entire file (see docs/parser-error-audit-541.md): every malformed
 * line — an unclosed bracket, a non-numeric value inside a numeric series —
 * was silently dropped or silently coerced to `NaN`, producing a diagram
 * that was missing content or subtly corrupted with no indication why.
 * These tests assert the parser now throws an actionable error instead.
 */
import { describe, it, expect } from 'vitest'
import { parseXYChart } from '@zombie-mermaid/mermaid-parser'

describe('parseXYChart – non-numeric series data', () => {
  it('throws on a non-numeric value in a bar series', () => {
    expect(() =>
      parseXYChart(['xychart-beta', 'x-axis [a, b, c]', 'bar [1, two, 3]']),
    ).toThrow(/Invalid numeric value "two"/)
  })

  it('throws on a quoted non-numeric value in a bar series', () => {
    expect(() =>
      parseXYChart(['xychart-beta', 'x-axis [a, b, c]', 'bar [1, "two", 3]']),
    ).toThrow(/Invalid numeric value/)
  })

  it('throws on a non-numeric value in a line series', () => {
    expect(() =>
      parseXYChart(['xychart-beta', 'x-axis [a, b]', 'line [10, oops]']),
    ).toThrow(/Invalid numeric value "oops"/)
  })

  it('reports the 1-based position of the bad value', () => {
    expect(() =>
      parseXYChart(['xychart-beta', 'bar [1, 2, three, 4]']),
    ).toThrow(/position 3/)
  })

  it('throws on an empty element from a stray comma', () => {
    expect(() => parseXYChart(['xychart-beta', 'bar [1, , 3]'])).toThrow(
      /Invalid numeric value ""/,
    )
  })

  it('still parses a fully numeric series without throwing', () => {
    expect(() =>
      parseXYChart(['xychart-beta', 'x-axis [a, b, c]', 'bar [1, 2, 3]']),
    ).not.toThrow()
  })
})

describe('parseXYChart – malformed directives', () => {
  it('throws on an unclosed x-axis bracket', () => {
    expect(() =>
      parseXYChart(['xychart-beta', 'x-axis [a, b, c', 'bar [1, 2, 3]']),
    ).toThrow(/Malformed xychart-beta "x-axis" directive/)
  })

  it('throws on an unclosed bar bracket', () => {
    expect(() => parseXYChart(['xychart-beta', 'bar [1, 2, 3'])).toThrow(
      /Malformed xychart-beta "bar" directive/,
    )
  })

  it('throws on an unclosed line bracket', () => {
    expect(() => parseXYChart(['xychart-beta', 'line [1, 2, 3'])).toThrow(
      /Malformed xychart-beta "line" directive/,
    )
  })

  it('throws on a title-only x-axis (unsupported form)', () => {
    expect(() =>
      parseXYChart(['xychart-beta', 'x-axis "Just a title"']),
    ).toThrow(/Malformed xychart-beta "x-axis" directive/)
  })

  it('throws on an unquoted title', () => {
    expect(() =>
      parseXYChart(['xychart-beta', 'title Unquoted Title']),
    ).toThrow(/Malformed xychart-beta "title" directive/)
  })

  it('does not throw on an unrecognized line with no known keyword', () => {
    // Unchanged behavior: a line that doesn't even attempt one of the five
    // known directives still falls through silently — only a recognized
    // keyword with broken syntax is now an error.
    expect(() => parseXYChart(['xychart-beta', '###nonsense###'])).not.toThrow()
  })
})
