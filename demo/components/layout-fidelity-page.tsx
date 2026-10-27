/** @jsxRuntime automatic */
/**
 * layout-fidelity.html (#1686): the layout-fidelity scorecard as a site page.
 * Static HTML; the only client script is the nav's own hydration. Descriptive
 * only: the scorecard's per-sample floors are shown as data, never as a
 * pass/fail banner. The `@jsxRuntime` pragma is required (see demo/tsconfig.json).
 */
import type { ReactNode } from 'react'
import {
  latestPerType,
  typeName,
  type LabelRun,
  type Section,
  type Table,
  type TypeRun,
} from '../layout-fidelity-model.ts'
import { Document } from './document.tsx'
import { Footer, type FooterColumn } from './footer.tsx'
import { NavMobileMenuScript } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { FORK_URL, HOME_HREF, ROOT_NAV_HREFS } from './site-chrome.tsx'
import { DesignFontLinks } from './tokens.tsx'

const NPM_URL = 'https://www.npmjs.com/package/zombie-mermaid'

const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Diagrams', href: 'diagrams/' },
      { label: 'Editor', href: 'editor.html' },
      { label: 'Fork fixes', href: 'fork-fixes.html' },
      { label: 'Layout fidelity', href: 'layout-fidelity.html' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: 'blog/' },
      { label: 'Upgrade guide', href: 'blog/upgrading-2x-to-5x.html' },
      { label: 'GitHub', href: FORK_URL },
      { label: 'npm package', href: NPM_URL },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'MIT Licensed' },
      { label: 'dfadler/zombie-mermaid', href: FORK_URL },
    ],
  },
]

const pct = (n: number | null) => (n === null ? '-' : `${Math.round(n * 100)}%`)
const fix2 = (n: number) => n.toFixed(2)
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** Inline `code` spans, the only markup the scorecard prose uses. */
function inline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/)
    .map((p, i) =>
      p.startsWith('**') ? (
        <strong key={i}>{p.slice(2, -2)}</strong>
      ) : p.startsWith('`') ? (
        <code key={i}>{p.slice(1, -1)}</code>
      ) : (
        p
      ),
    )
}

/** Column 0 is the row header; columns past `textCols` are right-aligned numbers. */
function DataTable({
  labelledBy,
  header,
  rows,
  textCols = 1,
}: Table & { labelledBy: string; textCols?: number }) {
  return (
    <div
      className="lf-scroll"
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
    >
      <table className="lf-table">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} scope="col" className={i < textCols ? '' : 'lf-num'}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={i} className={i < textCols ? '' : 'lf-num'}>
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface LayoutFidelityPageProps {
  css: string
  sections: readonly Section[]
  runs: readonly TypeRun[]
  labels: readonly LabelRun[]
  clientScript?: string
}

const TREND_ROWS = 20

export function LayoutFidelityPage({
  css,
  sections,
  runs,
  labels,
  clientScript = '',
}: LayoutFidelityPageProps) {
  const [title, ...rest] = sections
  // Rebuilt from the history, the source of record; the markdown contributes
  // the prose and the per-sample tables.
  const fromHistory: Record<string, (id: string) => ReactNode> = {
    'Latest run (means over samples)': (id) => (
      <DataTable
        labelledBy={id}
        header={['Type', 'Samples', 'Vertical', 'Horizontal', 'Containment']}
        rows={latestPerType(runs).map((r) => [
          typeName(r.type),
          String(r.samples),
          pct(r.vertical),
          pct(r.horizontal),
          pct(r.containment),
        ])}
      />
    ),
    [`Trend (last ${TREND_ROWS} recorded runs)`]: (id) => (
      <DataTable
        labelledBy={id}
        textCols={4}
        header={[
          'Date',
          'Commit',
          'Mermaid',
          'Type',
          'Samples',
          'Vertical',
          'Horizontal',
          'Containment',
        ]}
        rows={runs
          .slice(-TREND_ROWS)
          .map((r) => [
            r.date,
            r.commit,
            r.mermaid,
            typeName(r.type),
            String(r.samples),
            pct(r.vertical),
            pct(r.horizontal),
            pct(r.containment),
          ])}
      />
    ),
    'Edge labels (ASCII)': (id) => (
      <DataTable
        labelledBy={id}
        textCols={3}
        header={[
          'Date',
          'Commit',
          'Mermaid',
          'Cases',
          'Official',
          'ASCII',
          'Delta',
        ]}
        rows={labels
          .slice(-TREND_ROWS)
          .map((l) => [
            l.date,
            l.commit,
            l.mermaid,
            String(l.cases),
            fix2(l.officialAlong),
            fix2(l.asciiAlong),
            fix2(l.meanAbsDelta),
          ])}
      />
    ),
  }
  return (
    <Document
      title="Layout fidelity — Zombie Mermaid"
      description="How closely zombie-mermaid's layouts match official mermaid.js, as a descriptive scorecard with its recorded history."
      head={
        <>
          <DesignFontLinks />
          <style>{css}</style>
        </>
      }
    >
      <NavIsland
        sticky
        homeHref={HOME_HREF}
        hrefs={ROOT_NAV_HREFS}
        installSlotKind="empty"
      />
      <main id="main" tabIndex={-1} className="lf-main">
        <h1 className="lf-h1">{title?.title ?? 'Layout fidelity'}</h1>
        {title?.paragraphs.map((p, i) => (
          <p key={i}>{inline(p)}</p>
        ))}
        {rest.map((s, si) => {
          const id = `lf-${slug(s.title)}`
          const Heading = s.level <= 2 ? 'h2' : 'h3'
          const gen = fromHistory[s.title]
          return (
            <section key={si} aria-labelledby={id} className="lf-section">
              <Heading id={id}>{s.title}</Heading>
              {s.paragraphs.map((p, i) => (
                <p key={i}>{inline(p)}</p>
              ))}
              {gen
                ? gen(id)
                : s.tables.map((t, i) => (
                    <DataTable key={i} labelledBy={id} {...t} />
                  ))}
            </section>
          )
        })}
      </main>
      <Footer columns={FOOTER_COLUMNS} />
      <script
        type="module"
        // Nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/layout-fidelity-client.ts bundle, built at build time; never runtime user input
        dangerouslySetInnerHTML={{ __html: clientScript }}
      />
      <NavMobileMenuScript />
    </Document>
  )
}
