/**
 * Unit tests for src/ascii/validate.ts — diagonal-line detection and
 * orphaned-junction detection utilities used to sanity-check ASCII/Unicode
 * diagram output.
 */
import { describe, it, expect } from 'vitest'
import {
  DIAGONAL_CHARS,
  hasDiagonalLines,
  findDiagonalLines,
  assertNoDiagonals,
  findOrphanedJunctions,
  hasOrphanedJunctions,
} from '../ascii/validate.ts'

describe('DIAGONAL_CHARS', () => {
  it('exposes ascii, unicode, and combined character sets', () => {
    expect(DIAGONAL_CHARS.ascii).toEqual(['/', '\\'])
    expect(DIAGONAL_CHARS.unicode).toEqual(['╱', '╲'])
    expect(DIAGONAL_CHARS.all).toEqual(['/', '\\', '╱', '╲'])
  })
})

describe('hasDiagonalLines', () => {
  it('returns true when an ascii diagonal is present', () => {
    expect(hasDiagonalLines('A / B')).toBe(true)
    expect(hasDiagonalLines('A \\ B')).toBe(true)
  })

  it('returns true when a unicode diagonal is present', () => {
    expect(hasDiagonalLines('A ╱ B')).toBe(true)
    expect(hasDiagonalLines('A ╲ B')).toBe(true)
  })

  it('returns false when no diagonal characters are present', () => {
    expect(hasDiagonalLines('┌───┐\n│ A │\n└───┘')).toBe(false)
    expect(hasDiagonalLines('')).toBe(false)
  })
})

describe('findDiagonalLines', () => {
  it('returns an empty array for output with no diagonals', () => {
    expect(findDiagonalLines('┌───┐\n│ A │\n└───┘')).toEqual([])
  })

  it('reports 1-indexed line/col positions for diagonals outside any node', () => {
    const output = 'a / b'
    expect(findDiagonalLines(output)).toEqual([{ line: 1, col: 3, char: '/' }])
  })

  it('reports multiple diagonals across multiple lines', () => {
    const output = 'a / b\nc \\ d'
    expect(findDiagonalLines(output)).toEqual([
      { line: 1, col: 3, char: '/' },
      { line: 2, col: 3, char: '\\' },
    ])
  })

  it('skips diagonal characters inside a node label between box borders', () => {
    const output = '│feature/auth│'
    expect(findDiagonalLines(output)).toEqual([])
  })

  it('still reports a diagonal that is outside the borders on a line that also has a label', () => {
    const output = '│feature/auth│ / stray'
    const found = findDiagonalLines(output)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ char: '/' })
  })

  it('recognizes all supported box-border characters when suppressing label diagonals', () => {
    for (const border of ['│', '┤', '├', '║', '┃', '|']) {
      const output = `${border}a/b${border}`
      expect(findDiagonalLines(output)).toEqual([])
    }
  })

  it('does not suppress a diagonal when only one border is present on the line', () => {
    const output = '│a/b'
    expect(findDiagonalLines(output)).toEqual([{ line: 1, col: 3, char: '/' }])
  })

  it('detects unicode diagonal characters outside of labels', () => {
    const output = 'x ╱ y ╲ z'
    const found = findDiagonalLines(output)
    expect(found).toEqual([
      { line: 1, col: 3, char: '╱' },
      { line: 1, col: 7, char: '╲' },
    ])
  })
})

describe('assertNoDiagonals', () => {
  it('does not throw when there are no diagonals', () => {
    expect(() => assertNoDiagonals('┌───┐\n│ A │\n└───┘')).not.toThrow()
  })

  it('throws with position details when diagonals are found', () => {
    expect(() => assertNoDiagonals('a / b')).toThrow(
      /Diagonal lines detected\. .*Found 1 diagonal character\(s\):\n\s*Line 1, Col 3: '\/'/s,
    )
  })

  it('includes the context string in the error message when provided', () => {
    expect(() => assertNoDiagonals('a / b', 'my-diagram')).toThrow(
      /Diagonal lines detected in "my-diagram"\./,
    )
  })

  it('omits the context clause when no context is provided', () => {
    try {
      assertNoDiagonals('a / b')
      throw new Error('expected assertNoDiagonals to throw')
    } catch (err) {
      expect((err as Error).message).toContain('Diagonal lines detected. ')
      expect((err as Error).message).not.toContain(' in "')
    }
  })
})

describe('findOrphanedJunctions', () => {
  it('returns an empty array when there are no junction characters', () => {
    expect(findOrphanedJunctions('┌───┐\n│ A │\n└───┘')).toEqual([])
  })

  it('flags a ├ with blank cells directly above and below', () => {
    const output = '   \n├──\n   '
    expect(findOrphanedJunctions(output)).toEqual([
      { line: 2, col: 1, char: '├' },
    ])
  })

  it('flags a ┤ with blank cells directly above and below', () => {
    const output = '   \n──┤\n   '
    expect(findOrphanedJunctions(output)).toEqual([
      { line: 2, col: 3, char: '┤' },
    ])
  })

  it('does not flag a ├ that has content above it', () => {
    const output = '│  \n├──\n   '
    expect(findOrphanedJunctions(output)).toEqual([])
  })

  it('does not flag a ├ that has content below it', () => {
    const output = '   \n├──\n│  '
    expect(findOrphanedJunctions(output)).toEqual([])
  })

  it('treats a ├/┤ on the first line as having a blank row above (out of bounds)', () => {
    const output = '├──\n   '
    expect(findOrphanedJunctions(output)).toEqual([
      { line: 1, col: 1, char: '├' },
    ])
  })

  it('treats a ├/┤ on the last line as having a blank row below (out of bounds)', () => {
    const output = '   \n├──'
    expect(findOrphanedJunctions(output)).toEqual([
      { line: 2, col: 1, char: '├' },
    ])
  })

  it('flags a ┬ with blank cells directly left and right', () => {
    const output = ' ┬ '
    expect(findOrphanedJunctions(output)).toEqual([
      { line: 1, col: 2, char: '┬' },
    ])
  })

  it('flags a ┴ with blank cells directly left and right', () => {
    const output = ' ┴ '
    expect(findOrphanedJunctions(output)).toEqual([
      { line: 1, col: 2, char: '┴' },
    ])
  })

  it('does not flag a ┬ that has content to its left', () => {
    const output = '─┬ '
    expect(findOrphanedJunctions(output)).toEqual([])
  })

  it('does not flag a ┴ that has content to its right', () => {
    const output = ' ┴─'
    expect(findOrphanedJunctions(output)).toEqual([])
  })

  it('treats a ┬ at the start of a line as having a blank column to the left (out of bounds)', () => {
    const output = '┬  '
    expect(findOrphanedJunctions(output)).toEqual([
      { line: 1, col: 1, char: '┬' },
    ])
  })

  it('treats a ┴ at the end of a line as having a blank column to the right (out of bounds)', () => {
    const output = '  ┴'
    expect(findOrphanedJunctions(output)).toEqual([
      { line: 1, col: 3, char: '┴' },
    ])
  })

  it('finds multiple orphaned junctions across a multi-line diagram', () => {
    const output = ' ┬ \n   \n ┴ '
    expect(findOrphanedJunctions(output)).toEqual([
      { line: 1, col: 2, char: '┬' },
      { line: 3, col: 2, char: '┴' },
    ])
  })
})

describe('hasOrphanedJunctions', () => {
  it('returns false when there are no orphaned junctions', () => {
    expect(hasOrphanedJunctions('┌───┐\n│ A │\n└───┘')).toBe(false)
  })

  it('returns true when at least one orphaned junction is found', () => {
    expect(hasOrphanedJunctions(' ┬ ')).toBe(true)
  })
})
