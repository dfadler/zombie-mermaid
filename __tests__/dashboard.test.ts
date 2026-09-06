import { describe, it, expect } from 'vitest'
import {
  createElement,
  type ComponentProps,
  type FunctionComponent,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  daysSince,
  formatDate,
  formatDateTime,
  pluralDays,
  generate,
  renderDashboardHtml,
  type RepoStats,
  type RescuedIssue,
  type DashboardData,
} from '../dashboard.ts'
import {
  CompareTable,
  StatCards,
  IssueList,
  ResponseTime,
} from '../demo/components/dashboard-page.tsx'
import { parseDashboardData } from '../demo/dashboard-model.ts'
import dashboardData from '../demo/dashboard-data.json' with { type: 'json' }

/** Renders one component to its static markup, the way dashboard.ts renders the page. */
function render<P extends object>(
  component: FunctionComponent<P>,
  props: ComponentProps<FunctionComponent<P>>,
): string {
  return renderToStaticMarkup(createElement(component, props))
}

describe('daysSince', () => {
  it('floors a fractional day gap down', () => {
    // 36 hours = 1.5 days
    expect(daysSince('2026-01-01T00:00:00Z', '2026-01-02T12:00:00Z')).toBe(1)
  })

  it('returns 0 for the same instant', () => {
    expect(daysSince('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(0)
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

const referenceIso = '2026-08-03T00:00:00Z'

describe('CompareTable', () => {
  it("renders both repos' stats and escapes the release tag", () => {
    const html = render(CompareTable, {
      fork: {
        ...forkStats,
        latestRelease: { tag: '<v1>', publishedAt: forkStats.lastPushedAt },
      },
      upstream: upstreamStats,
      referenceIso,
    })

    expect(html).toContain('3') // fork open issues
    expect(html).toContain('50') // upstream open issues
    expect(html).toContain('&lt;v1&gt;')
    expect(html).not.toContain('<v1>')
  })

  it('measures "days ago" from the snapshot instant it is given', () => {
    const html = render(CompareTable, {
      fork: forkStats,
      upstream: upstreamStats,
      referenceIso,
    })
    expect(html).toContain('2 days ago') // fork: Aug 1 → Aug 3
    expect(html).toContain('94 days ago') // upstream: May 1 → Aug 3
  })

  it('renders an em-dash for a repo with no releases', () => {
    const html = render(CompareTable, {
      fork: forkStats,
      upstream: upstreamStats,
      referenceIso,
    })
    expect(html).toContain('—')
  })
})

describe('StatCards', () => {
  const rescued: DashboardData['rescued'] = {
    totalFixes: 7,
    upstreamIssuesReferenced: 5,
    upstreamIssuesStillOpen: 3,
    upstreamIssuesClosedIndependently: 2,
    issues: [],
  }

  it('renders each count as its own stat card value', () => {
    const html = render(StatCards, { rescued })
    expect(html).toContain('>7<')
    expect(html).toContain('>5<')
    expect(html).toContain('>3<')
    expect(html).toContain('>2<')
  })

  it('accents the fixed and still-open counts only', () => {
    const html = render(StatCards, { rescued })
    expect(html).toContain('class="dash-stat-value dash-accent">7<')
    expect(html).toContain('class="dash-stat-value">5<')
  })
})

describe('IssueList', () => {
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

  it('escapes the fix title and links to the upstream issue, the fork PR, and the fork-fixes anchor', () => {
    const html = render(IssueList, { issues: [openIssue] })
    expect(html).toContain('Fix &lt;A&gt;')
    expect(html).toContain(
      'https://github.com/lukilabs/beautiful-mermaid/issues/10',
    )
    expect(html).toContain('https://github.com/dfadler/zombie-mermaid/pull/100')
    expect(html).toContain('href="fork-fixes.html#fix-a"')
  })

  it('badges an open issue as still open and a closed one as closed upstream', () => {
    const html = render(IssueList, { issues: [openIssue, closedIssue] })
    expect(html).toContain('dash-open">still open upstream')
    expect(html).toContain('dash-closed">closed upstream')
  })
})

describe('ResponseTime', () => {
  it('renders a fallback note when there is no sample', () => {
    const html = render(ResponseTime, { responseTime: null })
    expect(html).toContain('No recent issue')
  })

  it('renders "<1h" for a sub-hour median instead of a fraction', () => {
    const html = render(ResponseTime, {
      responseTime: { sampleSize: 4, medianHours: 0.3, note: 'a note' },
    })
    // The template-literal generator emitted a raw `<1h`; React escapes the
    // `<`. Both parse to the same text node.
    expect(html).toContain('&lt;1h')
    expect(html).not.toContain('0.3h')
  })

  it('renders the numeric hour value and escapes the note', () => {
    const html = render(ResponseTime, {
      responseTime: {
        sampleSize: 4,
        medianHours: 5.5,
        note: 'caveat <em>text</em>',
      },
    })
    expect(html).toContain('5.5h')
    expect(html).toContain('n=4')
    expect(html).toContain('caveat &lt;em&gt;text&lt;/em&gt;')
  })
})

describe('parseDashboardData', () => {
  it('accepts the committed snapshot', () => {
    expect(() => parseDashboardData(dashboardData)).not.toThrow()
  })

  it('rejects a snapshot whose shape the page cannot render', () => {
    const broken = {
      ...dashboardData,
      rescued: {
        ...dashboardData.rescued,
        issues: [{ ...dashboardData.rescued.issues[0], state: 'merged' }],
      },
    }
    expect(() => parseDashboardData(broken)).toThrow(/state/)
  })
})

describe('renderDashboardHtml', () => {
  const data = parseDashboardData(dashboardData)

  it('produces a complete document with the doctype React omits', () => {
    const html = renderDashboardHtml(data, '')
    expect(html.startsWith('<!DOCTYPE html>\n<html lang="en">')).toBe(true)
    expect(html.endsWith('</html>')).toBe(true)
  })

  it('inlines the stylesheet verbatim — no HTML escaping inside <style>', () => {
    const css = '.a > .b::before { content: "x & y"; }'
    const html = renderDashboardHtml(data, css)
    expect(html).toContain(`<style>${css}</style>`)
  })
})

describe('generate', () => {
  it('produces a full HTML document embedding the committed snapshot data', async () => {
    const html = await generate()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Maintenance dashboard')
    expect(html).toContain(formatDateTime(dashboardData.generatedAt))
    expect(html).toContain('</html>')
  })
})
