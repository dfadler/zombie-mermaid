import { describe, expect, it } from 'vitest'
import { issueRefs, report } from '../scripts/doc-migration-report'

describe('doc-migration-report', () => {
  it('reads issue numbers from the text and from the file name', () => {
    expect(
      issueRefs(
        'queued-major-prs-1940.md',
        'see #977 and /issues/1757, not #7',
      ),
    ).toEqual([977, 1757, 1940])
    expect(issueRefs('614-docker-font-parity.md', 'no refs')).toEqual([614])
    expect(issueRefs('lockstep-versioning.md', 'none')).toEqual([])
  })

  it('lists every doc with --all and only the longer ones otherwise', () => {
    const all = report(80, true)
    const long = report(80, false)
    expect(all.length).toBeGreaterThan(long.length)
    expect(long.every((r) => r.lines > 80)).toBe(true)
    expect(long.map((r) => r.lines)).toEqual(
      [...long.map((r) => r.lines)].sort((a, b) => b - a),
    )
    expect(all.every((r) => /^docs\/(research|decisions)\//.test(r.path))).toBe(
      true,
    )
  })
})
