import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isTrackedTsFile,
  parseChangedLinesFromDiff,
  parseLcovContent,
  computeDiffCoverage,
} from '../check-diff-coverage.ts'

describe('isTrackedTsFile', () => {
  it('accepts a .ts file directly under src/', () => {
    expect(isTrackedTsFile('src/foo.ts')).toBe(true)
  })

  it('accepts a .ts file nested under src/', () => {
    expect(isTrackedTsFile('src/layout-engine/to-elk.ts')).toBe(true)
  })

  it('rejects files under src/__tests__/', () => {
    expect(isTrackedTsFile('src/__tests__/foo.test.ts')).toBe(false)
  })

  it('rejects files outside src/', () => {
    expect(isTrackedTsFile('editor/js/state.js')).toBe(false)
    expect(isTrackedTsFile('README.md')).toBe(false)
    expect(isTrackedTsFile('check-diff-coverage.ts')).toBe(false)
  })

  it('rejects non-.ts files under src/', () => {
    expect(isTrackedTsFile('src/foo.js')).toBe(false)
    expect(isTrackedTsFile('src/foo.tsx')).toBe(false)
  })
})

describe('parseChangedLinesFromDiff', () => {
  it('tracks added lines in a modified tracked file', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      'index 1111111..2222222 100644',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -10 +10,2 @@',
      '-old line',
      '+new line 1',
      '+new line 2',
    ].join('\n')

    const changed = parseChangedLinesFromDiff(diff)
    expect(changed.get('src/foo.ts')).toEqual(new Set([10, 11]))
  })

  it('tracks every line of a wholly new tracked file', () => {
    const diff = [
      'diff --git a/src/new-file.ts b/src/new-file.ts',
      'new file mode 100644',
      'index 0000000..3333333',
      '--- /dev/null',
      '+++ b/src/new-file.ts',
      '@@ -0,0 +1,3 @@',
      '+line 1',
      '+line 2',
      '+line 3',
    ].join('\n')

    const changed = parseChangedLinesFromDiff(diff)
    expect(changed.get('src/new-file.ts')).toEqual(new Set([1, 2, 3]))
  })

  it('handles multiple hunks in the same file independently', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -5 +5 @@',
      '-a',
      '+b',
      '@@ -40 +40,2 @@',
      '-c',
      '+d',
      '+e',
    ].join('\n')

    const changed = parseChangedLinesFromDiff(diff)
    expect(changed.get('src/foo.ts')).toEqual(new Set([5, 40, 41]))
  })

  it('aggregates multiple changed files into separate entries', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1 +1 @@',
      '-x',
      '+y',
      'diff --git a/src/b.ts b/src/b.ts',
      '--- a/src/b.ts',
      '+++ b/src/b.ts',
      '@@ -2 +2 @@',
      '-x',
      '+y',
    ].join('\n')

    const changed = parseChangedLinesFromDiff(diff)
    expect(changed.get('src/a.ts')).toEqual(new Set([1]))
    expect(changed.get('src/b.ts')).toEqual(new Set([2]))
  })

  it('ignores files that are not tracked .ts source (tests, non-src)', () => {
    const diff = [
      'diff --git a/src/__tests__/foo.test.ts b/src/__tests__/foo.test.ts',
      '--- a/src/__tests__/foo.test.ts',
      '+++ b/src/__tests__/foo.test.ts',
      '@@ -1 +1 @@',
      '-x',
      '+y',
      'diff --git a/README.md b/README.md',
      '--- a/README.md',
      '+++ b/README.md',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n')

    const changed = parseChangedLinesFromDiff(diff)
    expect(changed.size).toBe(0)
  })

  it('does not track lines for a deleted file', () => {
    const diff = [
      'diff --git a/src/gone.ts b/src/gone.ts',
      'deleted file mode 100644',
      '--- a/src/gone.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-old 1',
      '-old 2',
    ].join('\n')

    const changed = parseChangedLinesFromDiff(diff)
    expect(changed.size).toBe(0)
  })

  it('returns an empty map for an empty diff', () => {
    expect(parseChangedLinesFromDiff('').size).toBe(0)
  })
})

describe('parseLcovContent', () => {
  it('maps each SF-declared file to its DA line-hit counts', () => {
    const lcov = [
      'SF:src/foo.ts',
      'DA:1,1',
      'DA:2,0',
      'DA:3,5',
      'end_of_record',
    ].join('\n')

    const parsed = parseLcovContent(lcov)
    expect(parsed.get('src/foo.ts')).toEqual(
      new Map([
        [1, 1],
        [2, 0],
        [3, 5],
      ]),
    )
  })

  it('keeps separate files independent', () => {
    const lcov = [
      'SF:src/a.ts',
      'DA:1,1',
      'end_of_record',
      'SF:src/b.ts',
      'DA:1,0',
      'end_of_record',
    ].join('\n')

    const parsed = parseLcovContent(lcov)
    expect(parsed.get('src/a.ts')).toEqual(new Map([[1, 1]]))
    expect(parsed.get('src/b.ts')).toEqual(new Map([[1, 0]]))
  })

  it('ignores unrelated lcov record types', () => {
    const lcov = [
      'TN:',
      'SF:src/foo.ts',
      'FNF:2',
      'FNH:1',
      'DA:1,1',
      'BRF:0',
      'BRH:0',
      'end_of_record',
    ].join('\n')

    const parsed = parseLcovContent(lcov)
    expect(parsed.get('src/foo.ts')).toEqual(new Map([[1, 1]]))
  })

  it('returns an empty map for empty content', () => {
    expect(parseLcovContent('').size).toBe(0)
  })
})

describe('computeDiffCoverage', () => {
  it('computes covered/total per file and in aggregate', () => {
    const changedLines = new Map([
      ['src/a.ts', new Set([1, 2, 3])],
      ['src/b.ts', new Set([10])],
    ])
    const lcov = new Map([
      [
        'src/a.ts',
        new Map([
          [1, 1],
          [2, 0],
          [3, 2],
        ]),
      ],
      ['src/b.ts', new Map([[10, 0]])],
    ])

    const result = computeDiffCoverage(changedLines, lcov)

    expect(result.totalCovered).toBe(2) // lines 1 and 3 of src/a.ts
    expect(result.totalInstrumented).toBe(4)
    expect(result.fileReports).toEqual(
      expect.arrayContaining([
        { file: 'src/a.ts', covered: 2, total: 3 },
        { file: 'src/b.ts', covered: 0, total: 1 },
      ]),
    )
  })

  it('skips a changed file that has no coverage entry at all (type-only file)', () => {
    const changedLines = new Map([['src/types.ts', new Set([1, 2])]])
    const lcov = new Map<string, Map<number, number>>() // no entry for src/types.ts

    const result = computeDiffCoverage(changedLines, lcov)

    expect(result.totalInstrumented).toBe(0)
    expect(result.totalCovered).toBe(0)
    expect(result.fileReports).toEqual([])
  })

  it('skips changed lines that are non-executable (absent from lcov)', () => {
    const changedLines = new Map([['src/a.ts', new Set([1, 2, 3])]])
    // Only line 2 is instrumented — 1 and 3 are blank/comment/brace lines.
    const lcov = new Map([['src/a.ts', new Map([[2, 1]])]])

    const result = computeDiffCoverage(changedLines, lcov)

    expect(result.totalInstrumented).toBe(1)
    expect(result.totalCovered).toBe(1)
    expect(result.fileReports).toEqual([
      { file: 'src/a.ts', covered: 1, total: 1 },
    ])
  })

  it('returns zero totals and no file reports for no changed lines', () => {
    const result = computeDiffCoverage(new Map(), new Map())
    expect(result).toEqual({
      totalCovered: 0,
      totalInstrumented: 0,
      fileReports: [],
    })
  })
})

describe('resolveBaseRef', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.GITHUB_BASE_REF
  })

  afterEach(() => {
    delete process.env.GITHUB_BASE_REF
    vi.doUnmock('node:child_process')
  })

  it('prefers origin/<GITHUB_BASE_REF> when it resolves', async () => {
    process.env.GITHUB_BASE_REF = 'main'
    vi.doMock('node:child_process', () => ({
      execFileSync: vi.fn(() => ''), // every rev-parse succeeds
    }))
    const { resolveBaseRef } = await import('../check-diff-coverage.ts')
    expect(resolveBaseRef()).toBe('origin/main')
  })

  it('falls back to origin/main when GITHUB_BASE_REF does not resolve', async () => {
    process.env.GITHUB_BASE_REF = 'feature-branch'
    vi.doMock('node:child_process', () => ({
      execFileSync: vi.fn((_cmd: string, args: string[]) => {
        if (args.includes('origin/feature-branch')) {
          throw new Error('unknown revision')
        }
        return ''
      }),
    }))
    const { resolveBaseRef } = await import('../check-diff-coverage.ts')
    expect(resolveBaseRef()).toBe('origin/main')
  })

  it('falls back to local main when origin/main does not resolve', async () => {
    vi.doMock('node:child_process', () => ({
      execFileSync: vi.fn((_cmd: string, args: string[]) => {
        if (args.includes('origin/main')) throw new Error('unknown revision')
        return ''
      }),
    }))
    const { resolveBaseRef } = await import('../check-diff-coverage.ts')
    expect(resolveBaseRef()).toBe('main')
  })

  it('returns null when no candidate ref resolves', async () => {
    vi.doMock('node:child_process', () => ({
      execFileSync: vi.fn(() => {
        throw new Error('unknown revision')
      }),
    }))
    const { resolveBaseRef } = await import('../check-diff-coverage.ts')
    expect(resolveBaseRef()).toBeNull()
  })
})
