/**
 * Golden test: the React dashboard (demo/components/dashboard-page.tsx)
 * renders the same DOM as the template-literal generator it replaced —
 * dashboard.ts as of 92ff437, the merge-base of the #423 pilot branch.
 *
 * `__fixtures__/dashboard-pre-react.normalized.txt` was seeded by running
 * THAT generator over `__fixtures__/dashboard-fixture-data.json` with the
 * fixture stylesheet below, and normalising the result with
 * helpers/normalize-html.ts (the same normaliser applied to the React
 * output here) — so the first green run of this test is what proved
 * equivalence. From then on it is an ordinary golden file: an intentional
 * markup change updates it with `pnpm exec vitest -u`, after which it
 * guards the React output against its own last-approved shape rather than
 * against the old template.
 *
 * The fixture data covers the branches the page has: a repo with and
 * without a release, an open and a closed rescued issue (two of them
 * sharing an upstream number), a sub-hour median that renders as `<1h`,
 * and text with `<`, `&`, `"`, and `'` to exercise escaping.
 *
 * `formatDateTime` renders in the host's local timezone, so the one place
 * `generatedAt` appears formatted is replaced by a placeholder on both
 * sides before comparing. Every other date in the fixture is noon UTC,
 * which formats to the same calendar day in any timezone within ±12h.
 */
import { describe, expect, it } from 'vitest'
import { renderDashboardHtml } from '../dashboard.ts'
import { parseDashboardData, formatDateTime } from '../demo/dashboard-model.ts'
import { normalizeHtml } from './helpers/normalize-html.ts'
import fixtureData from './__fixtures__/dashboard-fixture-data.json' with { type: 'json' }

/** Stand-ins for demo/styles.css and demo/dashboard.css — a `>` combinator to prove CSS is not HTML-escaped. */
const FIXTURE_STYLES =
  '/* fixture: stands in for demo/styles.css */\nbody > .content-wrapper { max-width: 60rem; }'
const FIXTURE_EXTRA =
  '/* fixture: stands in for demo/dashboard.css */\n.dash-header { padding: 0; }'

const GENERATED_AT_PLACEHOLDER = '{{GENERATED_AT}}'

describe('dashboard page: React output vs the pre-React template', () => {
  it('normalises to the same DOM', async () => {
    const data = parseDashboardData(fixtureData)
    const html = renderDashboardHtml(
      data,
      `${FIXTURE_STYLES}\n${FIXTURE_EXTRA}`,
    )
    const normalized = normalizeHtml(html).replaceAll(
      formatDateTime(data.generatedAt),
      GENERATED_AT_PLACEHOLDER,
    )
    expect(normalized).toContain(GENERATED_AT_PLACEHOLDER)
    await expect(normalized + '\n').toMatchFileSnapshot(
      './__fixtures__/dashboard-pre-react.normalized.txt',
    )
  })
})
