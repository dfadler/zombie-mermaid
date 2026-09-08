/** @jsxRuntime automatic */
/**
 * The "what this fork fixes" before/after showcase (fork-fixes.ts →
 * fork-fixes.html) as React components — part of #589's move of every site
 * generator off template-literal HTML.
 *
 * Pure presentation: fork-fixes.ts still does everything that needs I/O or
 * a renderer — extracting each pre-fix source tree, rendering both halves
 * of every pair, converting ASCII output through ascii-html.ts, and
 * checking whether a committed real-terminal screenshot exists. It hands
 * the result here as a `PanelContent` per side, and this file decides only
 * what element each kind becomes.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { Fragment } from 'react'
import { SiteHead } from './site-head.tsx'
import { FORK_URL } from './site-chrome.tsx'

const UPSTREAM_URL = 'https://github.com/lukilabs/beautiful-mermaid'
const CHANGELOG_URL = `${FORK_URL}/blob/main/CHANGELOG.md`

/**
 * What one side of a before/after pair shows.
 *
 * Chosen by fork-fixes.ts (which owns the filesystem checks and the
 * ascii-html.ts conversion); this file only renders the choice.
 */
export type PanelContent =
  /** The render threw — itself a legitimate "before" for a crash fix. */
  | { kind: 'error'; message: string }
  /** The renderer produced nothing at all. */
  | { kind: 'empty' }
  /** A slice of the output markup, for fixes a browser renders forgivingly. */
  | { kind: 'excerpt'; text: string }
  /** A committed real-terminal screenshot (public/fork-fixes-screenshots/). */
  | {
      kind: 'screenshot'
      file: string
      side: 'before' | 'after'
      fixId: string
    }
  /** ascii-html.ts's HTML approximation of terminal output. */
  | { kind: 'ascii'; html: string }
  /** The rendered SVG. */
  | { kind: 'svg'; html: string }

/** One side of a before/after pair. */
export function FixPanel({ content }: { content: PanelContent }) {
  switch (content.kind) {
    case 'error':
      return (
        <div className="fix-error">
          <strong>Threw:</strong> {content.message}
        </div>
      )
    case 'empty':
      return (
        <div className="fix-empty">
          Rendered nothing — the diagram was dropped entirely.
        </div>
      )
    case 'excerpt':
      return <pre className="fix-ascii">{content.text}</pre>
    case 'screenshot':
      return (
        <div className="fix-screenshot">
          <img
            src={`fork-fixes-screenshots/${content.file}`}
            alt={`${content.side} terminal output of \`zombie-mermaid render ${content.fixId}.mmd --ascii\``}
            loading="lazy"
          />
        </div>
      )
    case 'ascii':
      return (
        <pre
          className="fix-ascii"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- ascii-html.ts output for this repo's own build-time render, never user input
          dangerouslySetInnerHTML={{ __html: content.html }}
        />
      )
    case 'svg':
      return (
        <div
          className="fix-svg"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- renderMermaidSVG output for this repo's own build-time render, never user input
          dangerouslySetInnerHTML={{ __html: content.html }}
        />
      )
  }
}

/** The upstream issue link(s) this fix resolves, when any are known. */
export function UpstreamIssues({ numbers }: { numbers?: number[] }) {
  if (!numbers || numbers.length === 0) return null
  return (
    <span className="fix-upstream">
      {/* A Fragment, not a wrapper element: the original template joined the
          links with a bare ", " and any extra element would change the DOM. */}
      {numbers.map((n, i) => (
        <Fragment key={n}>
          {i > 0 ? ', ' : null}
          <a href={`${UPSTREAM_URL}/issues/${n}`}>upstream #{n}</a>
        </Fragment>
      ))}
    </span>
  )
}

export interface FixSectionProps {
  id: string
  title: string
  /** `symptom`, already run through `formatProse`. */
  symptomHtml: string
  /** `lookFor`, already run through `formatProse`. */
  lookForHtml: string
  pr: number
  fixCommit: string
  render: 'svg' | 'ascii'
  upstreamIssues?: number[]
  source: string
  before: PanelContent
  after: PanelContent
}

/** One fix: its metadata, source, and the before/after pair. */
export function FixSection({
  id,
  title,
  symptomHtml,
  lookForHtml,
  pr,
  fixCommit,
  render,
  upstreamIssues,
  source,
  before,
  after,
}: FixSectionProps) {
  return (
    <section className="fix" id={id}>
      <h2>
        <a className="fix-anchor" href={`#${id}`}>
          {title}
        </a>
      </h2>
      <p
        className="fix-symptom"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- formatProse output: demo/fork-fixes-data.ts prose, HTML-escaped first, then backtick/asterisk spans turned into <code>/<em>
        dangerouslySetInnerHTML={{ __html: symptomHtml }}
      />
      <p className="fix-meta">
        <a href={`${FORK_URL}/pull/${pr}`}>PR #{pr}</a>
        <span className="fix-commit">
          fixed in <code>{fixCommit}</code>
        </span>
        <span className="fix-mode">
          {render === 'svg' ? 'SVG' : 'ASCII'} output
        </span>
        <UpstreamIssues numbers={upstreamIssues} />
      </p>
      <pre className="fix-source">{source}</pre>
      <div className="fix-pair">
        <div className="fix-side">
          <h3 className="fix-side-title fix-side-before">Before</h3>
          <FixPanel content={before} />
        </div>
        <div className="fix-side">
          <h3 className="fix-side-title fix-side-after">After</h3>
          <FixPanel content={after} />
        </div>
      </div>
      <p
        className="fix-lookfor"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- formatProse output: demo/fork-fixes-data.ts prose, HTML-escaped first, then backtick/asterisk spans turned into <code>/<em>
        dangerouslySetInnerHTML={{ __html: lookForHtml }}
      />
    </section>
  )
}

export interface ForkFixesPageProps {
  /** demo/styles.css plus demo/fork-fixes.css, inlined into a `<style>`. */
  css: string
  fixes: readonly FixSectionProps[]
}

/** The whole fork-fixes.html document. */
export function ForkFixesPage({ css, fixes }: ForkFixesPageProps) {
  return (
    <html lang="en">
      <head>
        <SiteHead
          title="What this fork fixes — zombie-mermaid"
          description="Before/after renders of bugs zombie-mermaid fixes over upstream beautiful-mermaid."
          css={css}
        />
      </head>
      <body>
        <div className="content-wrapper">
          <header className="fix-header">
            <p className="fix-breadcrumb">
              <a href="index.html">← Back to the gallery</a>
            </p>
            <h1>What this fork fixes</h1>
            <p className="fix-intro">
              Every pair below is rendered by this project's own renderer. The{' '}
              <strong>before</strong> side runs the code as it existed
              immediately before the fix landed — the tree at that commit's
              parent — so nothing here is hand-drawn or reconstructed. The
              generator fails the build if any pair renders identically, because
              a before/after that looks the same would claim a fix it does not
              demonstrate.
            </p>
            <p className="fix-intro">
              {fixes.length} fixes shown. Many more ship in the{' '}
              <a href={CHANGELOG_URL}>changelog</a>.
            </p>
          </header>
          {fixes.map((fix) => (
            <FixSection key={fix.id} {...fix} />
          ))}
          <footer className="fix-footer">
            <p>
              <a href={FORK_URL}>zombie-mermaid</a> — a fork of{' '}
              <a href={UPSTREAM_URL}>beautiful-mermaid</a>.
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
