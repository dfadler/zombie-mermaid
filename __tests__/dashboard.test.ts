import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  daysSince,
  formatDate,
  formatDateTime,
  pluralDays,
  renderCompareTable,
  renderStatCards,
  renderIssueList,
  renderResponseTime,
  generate,
  type RepoStats,
  type RescuedIssue,
  type DashboardData,
} from '../dashboard.ts'
import dashboardData from '../demo/dashboard-data.json' with { type: 'json' }

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">A & B</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;A &amp; B&lt;/a&gt;',
    )
  })

  it('leaves plain text untouched', () => {
    expect(escapeHtml('nothing special here')).toBe('nothing special here')
  })
})

describe('daysSince', () => {
  it('floors a fractional day gap down', () => {
    // 36 hours = 1.5 days
    expect(daysSince('2026-01-01T00:00:00Z', '2026-01-02T12:00:00Z')).toBe(1)
  })

  it('returns 0 for the same instant', () => {
    expect(daysSince('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(0)
  })

  it('uses the module-level snapshot generatedAt when referenceIso is omitted', () => {
    const iso = '2020-01-01T00:00:00Z'
    const expected = daysSince(iso, dashboardData.generatedAt)
    expect(daysSince(iso)).toBe(expected)
  })
})

describe('formatDate', () => {
  it('formats an ISO string as a short US date', () => {
    // Noon UTC, not midnight: formatDate renders in the host's local
    // timezone (no explicit `timeZone` option), so a midnight-UTC input
    // would flip to the previous day in any timezone behind UTC.
    expect(formatDate('2026-03-05T12:00:00Z')).toBe('Mar 5, 2026')
  })
})

describe('formatDateTime', () => {
  it('includes both a date and a time-of-day', () => {
    const out = formatDateTime('2026-03-05T12:00:00Z')
    expect(out).toContain('Mar 5, 2026')
    expect(out).toContain('at')
  })
})

describe('pluralDays', () => {
  it('uses the singular for exactly 1', () => {
    expect(pluralDays(1)).toBe('1 day')
  })

  it('uses the plural for 0 and for values above 1', () => {
    expect(pluralDays(0)).toBe('0 days')
    expect(pluralDays(2)).toBe('2 days')
  })
})

const forkStats: RepoStats = {
  owner: 'dfadler',
  name: 'zombie-mermaid',
  url: 'https://github.com/dfadler/zombie-mermaid',
  lastPushedAt: '2026-08-01T00:00:00Z',
  openIssues: 3,
  openPRs: 2,
  mergedPRs: 41,
  releaseCount: 2,
  latestRelease: { tag: 'v1.2.0', publishedAt: '2026-07-15T00:00:00Z' },
}

const upstreamStats: RepoStats = {
  owner: 'lukilabs',
  name: 'beautiful-mermaid',
  url: 'https://github.com/lukilabs/beautiful-mermaid',
  lastPushedAt: '2026-05-01T00:00:00Z',
  openIssues: 50,
  openPRs: 10,
  mergedPRs: 5,
  releaseCount: 0,
  latestRelease: null,
}

describe('renderCompareTable', () => {
  it("renders both repos' stats and escapes the release tag", () => {
    const html = renderCompareTable(
      {
        ...forkStats,
        latestRelease: { tag: '<v1>', publishedAt: forkStats.lastPushedAt },
      },
      upstreamStats,
    )

    expect(html).toContain('3') // fork open issues
    expect(html).toContain('50') // upstream open issues
    expect(html).toContain('&lt;v1&gt;')
  })

  it('renders an em-dash for a repo with no releases', () => {
    const html = renderCompareTable(forkStats, upstreamStats)
    expect(html).toContain('—')
  })
})

describe('renderStatCards', () => {
  const rescued: DashboardData['rescued'] = {
    totalFixes: 7,
    upstreamIssuesReferenced: 5,
    upstreamIssuesStillOpen: 3,
    upstreamIssuesClosedIndependently: 2,
    issues: [],
  }

  it('renders each count as its own stat card value', () => {
    const html = renderStatCards(rescued)
    expect(html).toContain('>7<')
    expect(html).toContain('>5<')
    expect(html).toContain('>3<')
    expect(html).toContain('>2<')
  })
})

describe('renderIssueList', () => {
  const openIssue: RescuedIssue = {
    number: 10,
    state: 'open',
    fixId: 'fix-a',
    fixTitle: 'Fix <A>',
    forkPr: 100,
  }
  const closedIssue: RescuedIssue = {
    number: 20,
    state: 'closed',
    fixId: 'fix-b',
    fixTitle: 'Fix B',
    forkPr: 101,
  }

  it('escapes the fix title and links to the upstream issue and the fork PR', () => {
    const html = renderIssueList([openIssue])
    expect(html).toContain('Fix &lt;A&gt;')
    expect(html).toContain(
      'https://github.com/lukilabs/beautiful-mermaid/issues/10',
    )
    expect(html).toContain('https://github.com/dfadler/zombie-mermaid/pull/100')
  })

  it('badges an open issue as still open and a closed one as closed upstream', () => {
    const html = renderIssueList([openIssue, closedIssue])
    expect(html).toContain('still open upstream')
    expect(html).toContain('closed upstream')
  })
})

describe('renderResponseTime', () => {
  it('renders a fallback note when there is no sample', () => {
    const html = renderResponseTime(null)
    expect(html).toContain('No recent issue')
  })

  it('renders "<1h" for a sub-hour median instead of a fraction', () => {
    const html = renderResponseTime({
      sampleSize: 4,
      medianHours: 0.3,
      note: 'a note',
    })
    expect(html).toContain('<1h')
    expect(html).not.toContain('0.3h')
  })

  it('renders the numeric hour value and escapes the note', () => {
    const html = renderResponseTime({
      sampleSize: 4,
      medianHours: 5.5,
      note: 'caveat <em>text</em>',
    })
    expect(html).toContain('5.5h')
    expect(html).toContain('n=4')
    expect(html).toContain('caveat &lt;em&gt;text&lt;/em&gt;')
  })
})

describe('generate', () => {
  it('produces a full HTML document embedding the committed snapshot data', async () => {
    const html = await generate()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Maintenance dashboard')
    expect(html).toContain('</html>')
  })
})
