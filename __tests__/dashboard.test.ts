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
} from '../dashboard.ts'
import {
  DashboardApp,
  DASHBOARD_PROPS_ELEMENT_ID,
  DASHBOARD_ROOT_ID,
  MetricsSection,
  RepoMetricsCard,
  RescuedTeaser,
  ResponseTimeSection,
} from '../demo/components/dashboard-page.tsx'
import {
  buildDashboardViewModel,
  parseDashboardData,
} from '../demo/dashboard-model.ts'
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
  // Noon UTC, not midnight — see formatDate's own test above on why.
  latestRelease: { tag: 'v1.2.0', publishedAt: '2026-07-15T12:00:00Z' },
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

describe('RepoMetricsCard', () => {
  it("renders every one of a repo's six metrics", () => {
    const html = render(RepoMetricsCard, {
      label: 'zombie-mermaid (this fork)',
      highlight: true,
      entries: [
        ['2 days ago', 'last commit'],
        ['3', 'open issues'],
        ['2', 'open PRs'],
        ['41', 'merged PRs'],
        ['2', 'releases published'],
        ['v1.2.0 (Jul 15, 2026)', 'latest release'],
      ],
    })
    expect(html).toContain('2 days ago') // Aug 1 -> Aug 3
    expect(html).toContain('>3<') // open issues
    expect(html).toContain('>2<') // open PRs, and releases published (same digit)
    expect(html).toContain('>41<') // merged PRs
    expect(html).toContain('releases published')
    expect(html).toContain('v1.2.0 (Jul 15, 2026)') // latest release
  })

  it('renders an em-dash for a repo with no releases', () => {
    const html = render(RepoMetricsCard, {
      label: 'beautiful-mermaid (upstream)',
      highlight: false,
      entries: [
        ['94 days ago', 'last commit'],
        ['50', 'open issues'],
        ['10', 'open PRs'],
        ['5', 'merged PRs'],
        ['0', 'releases published'],
        ['—', 'latest release'],
      ],
    })
    expect(html).toContain('—')
  })

  it('measures "days ago" from the snapshot instant the view model was built with', () => {
    const view = buildDashboardViewModel({
      generatedAt: referenceIso,
      fork: forkStats,
      upstream: upstreamStats,
      rescued: {
        totalFixes: 0,
        upstreamIssuesReferenced: 0,
        upstreamIssuesStillOpen: 0,
        upstreamIssuesClosedIndependently: 0,
        issues: [],
      },
      responseTime: null,
    })
    const html = render(RepoMetricsCard, view.upstream)
    expect(html).toContain('94 days ago') // May 1 -> Aug 3
  })
})

describe('buildDashboardViewModel', () => {
  const view = buildDashboardViewModel({
    generatedAt: referenceIso,
    fork: forkStats,
    upstream: upstreamStats,
    rescued: {
      totalFixes: 0,
      upstreamIssuesReferenced: 0,
      upstreamIssuesStillOpen: 0,
      upstreamIssuesClosedIndependently: 0,
      issues: [],
    },
    responseTime: null,
  })

  it("precomputes each repo's six metric entries, matching the old inline computation", () => {
    expect(view.fork.entries).toEqual([
      ['2 days ago', 'last commit'],
      ['3', 'open issues'],
      ['2', 'open PRs'],
      ['41', 'merged PRs'],
      ['2', 'releases published'],
      ['v1.2.0 (Jul 15, 2026)', 'latest release'],
    ])
    expect(view.upstream.entries).toEqual([
      ['94 days ago', 'last commit'],
      ['50', 'open issues'],
      ['10', 'open PRs'],
      ['5', 'merged PRs'],
      ['0', 'releases published'],
      ['—', 'latest release'],
    ])
  })

  it('marks only the fork highlighted, matching the canvas', () => {
    expect(view.fork.highlight).toBe(true)
    expect(view.upstream.highlight).toBe(false)
  })

  it('formats generatedAtDisplay the same way formatDateTime does', () => {
    expect(view.generatedAtDisplay).toBe(formatDateTime(referenceIso))
  })

  it('passes responseTime through unchanged (no locale-sensitive fields in it)', () => {
    expect(view.responseTime).toBeNull()
  })
})

describe('MetricsSection', () => {
  it("renders both repos' cards", () => {
    const view = buildDashboardViewModel({
      generatedAt: referenceIso,
      fork: forkStats,
      upstream: upstreamStats,
      rescued: {
        totalFixes: 0,
        upstreamIssuesReferenced: 0,
        upstreamIssuesStillOpen: 0,
        upstreamIssuesClosedIndependently: 0,
        issues: [],
      },
      responseTime: null,
    })
    const html = render(MetricsSection, {
      fork: view.fork,
      upstream: view.upstream,
    })
    expect(html).toContain('zombie-mermaid (this fork)')
    expect(html).toContain('beautiful-mermaid (upstream)')
  })
})

describe('DashboardApp / hydration ids (#799)', () => {
  it('DashboardApp renders no DASHBOARD_ROOT_ID and no Nav (Nav stays outside the hydration boundary — see that component doc comment)', () => {
    const view = buildDashboardViewModel(parseDashboardData(dashboardData))
    const html = render(DashboardApp, { viewModel: view })
    expect(html).not.toContain(`id="${DASHBOARD_ROOT_ID}"`)
    expect(html).not.toContain('class="nav-bar"')
    // Sanity: it still renders the page body (metrics section included).
    expect(html).toContain('id="metrics"')
  })

  it('DashboardPage wraps DashboardApp in a plain DASHBOARD_ROOT_ID container and embeds DASHBOARD_PROPS_ELEMENT_ID JSON', () => {
    const data = parseDashboardData(dashboardData)
    const html = renderDashboardHtml(data, '')
    expect(html).toContain(`<div id="${DASHBOARD_ROOT_ID}">`)
    expect(html).toContain(`id="${DASHBOARD_PROPS_ELEMENT_ID}"`)
    expect(DASHBOARD_ROOT_ID).toBe('dashboard-root')
    expect(DASHBOARD_PROPS_ELEMENT_ID).toBe('dashboard-props')
  })
})

/**
 * Strips tags (and therefore their attributes — svg viewBox/path digits
 * included) and decodes the handful of entities `renderToStaticMarkup`
 * emits, leaving only the rendered text. Decoding matters here because
 * React escapes an apostrophe as `&#x27;`, whose hex digits would
 * otherwise register as visible digits to a `/\d/` check.
 */
function textOnly(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

describe('RescuedTeaser', () => {
  it('links to the fork-fixes page without stating a rescued-issue count', () => {
    const html = render(RescuedTeaser, {})
    expect(html).toContain('href="fork-fixes.html"')
    expect(html).toContain('Rescued issues')
    // No digit anywhere in the card's visible copy — the count is
    // deliberately unconfirmed (see the module header comment).
    expect(textOnly(html)).not.toMatch(/\d/)
  })
})

describe('ResponseTimeSection', () => {
  it('renders a fallback note when there is no sample', () => {
    const html = render(ResponseTimeSection, { responseTime: null })
    expect(html).toContain('No recent issue')
  })

  it('renders "<1h" for a sub-hour median instead of a fraction', () => {
    const html = render(ResponseTimeSection, {
      responseTime: { sampleSize: 4, medianHours: 0.3, note: 'a note' },
    })
    expect(html).toContain('&lt;1h')
    expect(html).not.toContain('0.3h')
  })

  it('renders the numeric hour value and escapes the note', () => {
    const html = render(ResponseTimeSection, {
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

  it('renders the shared Nav and Footer instead of a bare back-link', () => {
    const html = renderDashboardHtml(data, '')
    expect(html).toContain('zombie-mermaid')
    expect(html).toContain('npm install zombie-mermaid')
    expect(html).not.toContain('back to the gallery')
    // The footer's copyright line, from footer.tsx's FOOTER_COPYRIGHT default.
    expect(html).toContain('MIT licensed')
  })

  it('renders the global ThemePickerSection (#687)', () => {
    const html = renderDashboardHtml(data, '')
    expect(html).toContain('id="theme-pills"')
    expect(html).toContain('data-theme="dracula"')
  })

  it('inlines a non-empty themeBarScript verbatim in a module script', () => {
    const html = renderDashboardHtml(data, '', 'console.log("theme-bar")')
    expect(html).toContain(
      '<script type="module">console.log("theme-bar")</script>',
    )
  })

  it('defaults themeBarScript to an empty inline script when omitted', () => {
    const html = renderDashboardHtml(data, '')
    expect(html).toContain('<script type="module"></script>')
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

describe('generate output matches the committed snapshot', () => {
  it('renders the real openIssues count for both repos', async () => {
    const html = await generate()
    expect(html).toContain(`>${dashboardData.fork.openIssues}<`)
    expect(html).toContain(`>${dashboardData.upstream.openIssues}<`)
  })

  it('renders the real merged-PR counts for both repos', async () => {
    const html = await generate()
    expect(html).toContain(`>${dashboardData.fork.mergedPRs}<`)
    expect(html).toContain(`>${dashboardData.upstream.mergedPRs}<`)
  })

  it('does not state a specific rescued-issue count anywhere on the page', async () => {
    const html = await generate()
    const rescuedSectionMatch = html.match(
      /<div id="rescued"[\s\S]*?<div id="response"/,
    )
    expect(rescuedSectionMatch).not.toBeNull()
    // Text only: the fragment's raw markup still carries digits in SVG
    // viewBox/path attributes, which aren't visible copy.
    expect(textOnly(rescuedSectionMatch?.[0] ?? '')).not.toMatch(/\d/)
  })
})
