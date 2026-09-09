/** @jsxRuntime automatic */
/**
 * The "what this fork fixes" before/after showcase (fork-fixes.ts →
 * fork-fixes.html) as React components — restyled for the #590 site
 * redesign (#608), part of #590's larger move onto the shared component
 * library (#591: tokens.tsx, primitives.tsx, icons.tsx, nav.tsx, footer.tsx).
 *
 * #608 is presentation-only: every fact rendered here (the PR/commit/render
 * mode/upstream-issue metadata, the source, and the before/after content
 * itself) still comes from fork-fixes.ts unchanged — extracting each pre-fix
 * source tree, rendering both halves of every pair, converting ASCII output
 * through ascii-html.ts, checking for a committed real-terminal screenshot,
 * and failing the build if any pair renders identically. None of that moved;
 * only how the result is laid out did. See fork-fixes.ts's own header for
 * the guarantees this file must not weaken.
 *
 * Layout, colours, type, and spacing are lifted from the design canvas
 * linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * artboard `ForkFixes.dc.html` — the same canvas tokens.tsx, primitives.tsx,
 * nav.tsx, footer.tsx, and icons.tsx were extracted from. Every measurement
 * that lands on one of those modules' scales uses the token (`SPACE['4xl']`
 * rather than retyping `28`); a handful of the canvas's own values don't
 * land on any scale (e.g. the code panel's 14px radius, the hero's 60px
 * section padding) and stay as commented literals, the same convention
 * nav.tsx's `NAV_LINK_GAP` and footer.tsx's `TAGLINE_MAX_WIDTH` follow for
 * their own off-scale values. One deliberate deviation: the canvas's hero
 * paragraph is a literal 18px, but tokens.tsx already names 17px
 * `FONT_SIZE.lead` for exactly this role ("lead paragraphs under a
 * heading") — the token wins, since the point of extracting one is to stop
 * re-deriving the same role per page.
 *
 * The canvas's own `<style>` only mocks up two illustrative fix cards with
 * hand-drawn placeholder SVGs; the before/after content on every real card
 * here is `fork-fixes.ts`'s actual renders, so this file supplies its own
 * light Mermaid syntax highlighter ({@link tokenizeMermaidSource}) for the
 * source panel — the canvas hard-codes coloured spans per example, which
 * doesn't generalise to 27 different sources across 6 diagram types.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { FORK_URL } from './site-chrome.tsx'
import { Footer, type FooterColumn } from './footer.tsx'
import { Nav, NavCopyScript } from './nav.tsx'
import {
  CheckIcon,
  CommitIcon,
  ExternalLinkIcon,
  FrameIcon,
  PullRequestIcon,
  TerminalIcon,
  WarningIcon,
} from './icons.tsx'
import {
  Card,
  Pill,
  SectionEyebrow,
  accentRgba,
  accentVar,
  type Accent,
} from './primitives.tsx'
import {
  DesignFontLinks,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  RADIUS,
  SPACE,
  colorVar,
} from './tokens.tsx'

const UPSTREAM_URL = 'https://github.com/lukilabs/beautiful-mermaid'
const CHANGELOG_URL = `${FORK_URL}/blob/main/CHANGELOG.md`

/* -----------------------------------------------------------------
 * A light Mermaid syntax highlighter for the code panel
 * ----------------------------------------------------------------- */

/**
 * Diagram-type keywords that open a Mermaid source block.
 *
 * Only checked against the first line's leading word (see
 * {@link tokenizeMermaidSource}) — this is not a Mermaid keyword list, just
 * enough to colour the one word every fix's source opens with, the way the
 * canvas's own hand-coloured examples do.
 */
const DIAGRAM_KEYWORDS = new Set([
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'stateDiagram-v2',
  'stateDiagram',
  'journey',
  'gantt',
  'pie',
  'gitGraph',
  'mindmap',
  'timeline',
  'quadrantChart',
  'xychart-beta',
])

/**
 * Connector/operator tokens this highlighter recognizes, longest first so a
 * greedy left-to-right scan never matches a short prefix of a longer token
 * (e.g. `-->` before the bare `->`).
 */
const CONNECTOR_TOKENS = [
  '<-->',
  '--|>',
  '<|--',
  '..|>',
  '<..',
  '~~~',
  '-->',
  '---',
  '==>',
  '===',
  '--o',
  '--x',
  'o--',
  '*--',
  '..>',
  ':::',
  '->',
  '::',
].sort((a, b) => b.length - a.length)

export type SourceTokenKind = 'keyword' | 'connector' | 'label' | 'text'

export interface SourceToken {
  text: string
  kind: SourceTokenKind
}

const BRACKET_PAIRS: Record<string, string> = { '[': ']', '(': ')', '{': '}' }

/**
 * Finds the end (exclusive) of the bracket opened at `open`, allowing
 * same-type nesting and skipping over quoted substrings so a quote's own
 * bracket-like characters never throw off the depth count.
 *
 * A single non-greedy regex (`\[.*?\]`) can't do this: `["test [] brackets"]`
 * (the literal `quoted-brackets` fix source) has an inner `[]` *inside* the
 * quotes that must not close the outer bracket early. Returns -1 if the
 * line has no matching close.
 */
function matchBracket(line: string, open: number): number {
  const openCh = line[open]
  if (openCh === undefined) return -1
  const closeCh = BRACKET_PAIRS[openCh]
  if (closeCh === undefined) return -1
  let depth = 0
  for (let i = open; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      const close = line.indexOf('"', i + 1)
      if (close === -1) return -1
      i = close
      continue
    }
    if (ch === openCh) depth++
    else if (ch === closeCh) {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}

/** Tokenizes one line; `isFirstLine` gates the diagram-keyword check. */
function tokenizeLine(line: string, isFirstLine: boolean): SourceToken[] {
  const tokens: SourceToken[] = []
  let i = 0
  let textStart = 0

  function flushText(end: number): void {
    if (end > textStart) {
      tokens.push({ text: line.slice(textStart, end), kind: 'text' })
    }
  }

  if (isFirstLine) {
    const match = /^(\s*)(\S+)/.exec(line)
    const leading = match?.[1]
    const word = match?.[2]
    if (word !== undefined && DIAGRAM_KEYWORDS.has(word)) {
      if (leading) tokens.push({ text: leading, kind: 'text' })
      tokens.push({ text: word, kind: 'keyword' })
      i = (leading?.length ?? 0) + word.length
      textStart = i
    }
  }

  while (i < line.length) {
    const ch = line[i]

    if (ch === '"') {
      const close = line.indexOf('"', i + 1)
      const end = close === -1 ? line.length : close + 1
      flushText(i)
      tokens.push({ text: line.slice(i, end), kind: 'label' })
      i = end
      textStart = i
      continue
    }

    if (ch === '|') {
      const close = line.indexOf('|', i + 1)
      if (close !== -1) {
        flushText(i)
        tokens.push({ text: line.slice(i, close + 1), kind: 'label' })
        i = close + 1
        textStart = i
        continue
      }
    }

    if (ch === '[' || ch === '(' || ch === '{') {
      const end = matchBracket(line, i)
      if (end !== -1) {
        flushText(i)
        tokens.push({ text: line.slice(i, end), kind: 'label' })
        i = end
        textStart = i
        continue
      }
    }

    const connector = CONNECTOR_TOKENS.find((token) =>
      line.startsWith(token, i),
    )
    if (connector) {
      flushText(i)
      tokens.push({ text: connector, kind: 'connector' })
      i += connector.length
      textStart = i
      continue
    }

    i++
  }
  flushText(line.length)
  return tokens
}

/**
 * A light, line-oriented tokenizer for the fix-card code panel — not a
 * Mermaid grammar. It recognizes exactly what the design canvas's own
 * hand-coloured code panel highlights: the opening diagram-type keyword,
 * connector/arrow tokens, and bracket- or quote-delimited labels; anything
 * else keeps the panel's default ink. A source line the recognizer doesn't
 * cover (an ER crow's-foot symbol, say) degrades gracefully to plain text
 * rather than throwing or mis-colouring.
 */
export function tokenizeMermaidSource(source: string): SourceToken[][] {
  return source
    .split('\n')
    .map((line, lineIndex) => tokenizeLine(line, lineIndex === 0))
}

const KEYWORD_COLOR = colorVar('--violet')
const CONNECTOR_COLOR = colorVar('--cyan')
const LABEL_COLOR = colorVar('--amber')

function tokenColor(kind: SourceTokenKind): string | undefined {
  if (kind === 'keyword') return KEYWORD_COLOR
  if (kind === 'connector') return CONNECTOR_COLOR
  if (kind === 'label') return LABEL_COLOR
  return undefined
}

function SourceLine({ tokens }: { tokens: SourceToken[] }) {
  return (
    <div>
      {tokens.map((token, i) => {
        const color = tokenColor(token.kind)
        return color === undefined ? (
          <Fragment key={i}>{token.text}</Fragment>
        ) : (
          <span key={i} style={{ color }}>
            {token.text}
          </span>
        )
      })}
    </div>
  )
}

/**
 * The traffic-light dots on the code panel's fake title bar.
 *
 * Canvas literals (`#ff6767`/`#ffc85c`/`#5ee08a`), not on tokens.tsx's
 * accent scale — they're a decorative "editor window" flourish, not one of
 * the six semantic accents.
 */
const TRAFFIC_LIGHT_COLORS = ['#ff6767', '#ffc85c', '#5ee08a']

function CodePanel({ id, source }: { id: string; source: string }) {
  const lines = tokenizeMermaidSource(source)
  return (
    <div
      style={{
        background: colorVar('--bg'),
        border: `1px solid ${colorVar('--border')}`,
        // 14px radius and this padding are the canvas's own literals — not
        // on RADIUS.md (10) or RADIUS.lg (12), and not on SPACE either.
        borderRadius: '14px',
        padding: '22px 26px 26px 26px',
        overflowX: 'auto',
        // A flex item's default min-width is `auto` (its content's
        // intrinsic width), which defeats `overflow-x: auto` — the item
        // just grows to fit a long line instead of scrolling it. This is
        // the fix-card's own flex column, so without this a wide ASCII
        // fix's source line would widen the whole page instead of
        // scrolling inside this panel.
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${SPACE.xs}px`,
          marginBottom: `${SPACE.xl}px`,
        }}
      >
        {TRAFFIC_LIGHT_COLORS.map((color) => (
          <span
            key={color}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: color,
              display: 'inline-block',
            }}
          />
        ))}
        <span
          className="mono"
          style={{
            fontSize: `${FONT_SIZE.caption}px`,
            color: colorVar('--text-faint'),
            marginLeft: `${SPACE.xs}px`,
          }}
        >
          {id}.mmd
        </span>
      </div>
      <div
        className="mono"
        style={{
          fontSize: `${FONT_SIZE.bodySm}px`,
          // 1.8, not LINE_HEIGHT.body (1.5): the canvas's own value for this
          // panel, same off-scale-literal call footer.tsx's tagline makes.
          lineHeight: 1.8,
          color: colorVar('--text-dim'),
          whiteSpace: 'pre',
          fontVariantLigatures: 'none',
        }}
      >
        {lines.map((tokens, i) => (
          <SourceLine key={i} tokens={tokens} />
        ))}
      </div>
    </div>
  )
}

/* -----------------------------------------------------------------
 * Metadata pills
 * ----------------------------------------------------------------- */

/**
 * The small metadata pill (`PR #NN`, a commit hash, the render mode, an
 * upstream issue) — distinct from primitives.tsx's `Pill`, which is sized
 * for a button/badge role rather than this dense, always-`mono` metadata
 * row. Every measurement here matches a tokens.tsx step exactly (the
 * canvas's `8px 16px` padding is `SPACE.xs`/`SPACE.xl`, its `13px` type is
 * `FONT_SIZE.label`), so there's no off-scale literal to call out.
 */
function MetaPill({ href, children }: { href?: string; children: ReactNode }) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: `${SPACE.xs}px`,
    borderRadius: `${RADIUS.pill}px`,
    padding: `${SPACE.xs}px ${SPACE.xl}px`,
    fontSize: `${FONT_SIZE.label}px`,
    fontWeight: FONT_WEIGHT.semibold,
    background: colorVar('--panel-2'),
    border: `1px solid ${colorVar('--border')}`,
    color: colorVar('--text-dim'),
    whiteSpace: 'nowrap',
  }
  return href === undefined ? (
    <span className="mono" style={style}>
      {children}
    </span>
  ) : (
    <a className="mono" href={href} style={style}>
      {children}
    </a>
  )
}

function OutputModePill({ render }: { render: 'svg' | 'ascii' }) {
  return (
    <MetaPill>
      {render === 'svg' ? <FrameIcon size={13} /> : <TerminalIcon size={13} />}
      {render === 'svg' ? 'SVG output' : 'ASCII output'}
    </MetaPill>
  )
}

/** The upstream issue link(s) this fix resolves, one pill per number. */
function UpstreamPills({ numbers }: { numbers?: number[] }) {
  if (!numbers || numbers.length === 0) return null
  return (
    <>
      {numbers.map((n) => (
        <MetaPill key={n} href={`${UPSTREAM_URL}/issues/${n}`}>
          <ExternalLinkIcon size={13} />
          upstream #{n}
        </MetaPill>
      ))}
    </>
  )
}

/* -----------------------------------------------------------------
 * Before / after
 * ----------------------------------------------------------------- */

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

/**
 * The monospace, scrollable well shared by the `ascii`/`excerpt` kinds —
 * `fix-ascii .fix-wide` is a real CSS selector (see demo/fork-fixes.css)
 * because it has to reach a `<span>` ascii-html.ts injects via
 * `dangerouslySetInnerHTML`, which this component has no other way to
 * style.
 */
const ASCII_WELL_STYLE: CSSProperties = {
  margin: 0,
  padding: `${SPACE.xl}px`,
  background: colorVar('--bg'),
  borderRadius: `${RADIUS.md}px`,
  overflowX: 'auto',
  whiteSpace: 'pre',
  fontVariantLigatures: 'none',
  fontSize: `${FONT_SIZE.bodySm}px`,
  lineHeight: 1.5,
  color: colorVar('--text-dim'),
  // See CodePanel's identical comment: without this, a flex/grid item's
  // default min-width (its content's intrinsic width) overrides
  // `overflow-x: auto` and a wide ASCII diagram widens the whole page
  // instead of scrolling inside this well — several fixes on this page
  // exist specifically because a diagram renders wider than its label.
  minWidth: 0,
}

/** One side of a before/after pair. `accent` colours an error/empty note to match the side it's on (amber for before, green for after). */
export function FixPanel({
  content,
  accent,
}: {
  content: PanelContent
  accent: Accent
}) {
  switch (content.kind) {
    case 'error':
      return (
        <div
          className="mono"
          style={{
            padding: `${SPACE.xl}px`,
            fontSize: `${FONT_SIZE.bodySm}px`,
            lineHeight: 1.5,
            color: accentVar(accent),
          }}
        >
          <strong>Threw:</strong> {content.message}
        </div>
      )
    case 'empty':
      return (
        <div
          style={{
            padding: `${SPACE.xl}px`,
            fontSize: `${FONT_SIZE.bodySm}px`,
            fontStyle: 'italic',
            color: colorVar('--text-faint'),
          }}
        >
          Rendered nothing — the diagram was dropped entirely.
        </div>
      )
    case 'excerpt':
      return (
        <pre className="fix-ascii mono" style={ASCII_WELL_STYLE}>
          {content.text}
        </pre>
      )
    case 'screenshot':
      return (
        <img
          src={`fork-fixes-screenshots/${content.file}`}
          alt={`${content.side} terminal output of \`zombie-mermaid render ${content.fixId}.mmd --ascii\``}
          loading="lazy"
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            borderRadius: `${RADIUS.md}px`,
          }}
        />
      )
    case 'ascii':
      return (
        <pre
          className="fix-ascii mono"
          style={ASCII_WELL_STYLE}
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- ascii-html.ts output for this repo's own build-time render, never user input
          dangerouslySetInnerHTML={{ __html: content.html }}
        />
      )
    case 'svg':
      return (
        <div
          className="fix-svg"
          style={{
            background: colorVar('--bg'),
            borderRadius: `${RADIUS.md}px`,
            padding: `${SPACE.xl}px`,
            minWidth: 0,
          }}
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- renderMermaidSVG output for this repo's own build-time render, never user input
          dangerouslySetInnerHTML={{ __html: content.html }}
        />
      )
  }
}

/**
 * The `Before`/`After` label pill above each panel — amber+{@link
 * WarningIcon} on the before side, green+{@link CheckIcon} on the after
 * side, always, regardless of what kind of content that side turns out to
 * hold. That fixed mapping (not "whichever side has the error") is the
 * canvas's own convention (`.ba-label`) and matches the page's premise:
 * before is the broken state, after is the fix, full stop.
 */
function BeforeAfterLabel({ side }: { side: 'before' | 'after' }) {
  const accent: Accent = side === 'before' ? 'amber' : 'green'
  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${SPACE.xs}px`,
        borderRadius: `${RADIUS.pill}px`,
        padding: `${SPACE.xxs}px ${SPACE.lg}px`,
        fontSize: `${FONT_SIZE.caption}px`,
        fontWeight: FONT_WEIGHT.bold,
        // 0.08em, not LETTER_SPACING.eyebrow (0.14em) — the same distinct
        // tracking footer.tsx's column headings use, for the same reason:
        // a look-alike treatment the canvas keeps deliberately different.
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        width: 'fit-content',
        background: accentRgba(accent, 0.14),
        color: accentVar(accent),
      }}
    >
      {side === 'before' ? (
        <WarningIcon size={12} strokeWidth={2.4} />
      ) : (
        <CheckIcon size={12} strokeWidth={2.6} />
      )}
      {side === 'before' ? 'Before' : 'After'}
    </span>
  )
}

function BeforeAfterPanel({
  side,
  content,
}: {
  side: 'before' | 'after'
  content: PanelContent
}) {
  const accent: Accent = side === 'before' ? 'amber' : 'green'
  return (
    <div
      style={{
        borderRadius: `${RADIUS.xl}px`,
        padding: `${SPACE['2xl']}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACE.xl}px`,
        background: colorVar('--panel-2'),
        border: `1px solid ${accentVar(accent)}`,
        // A grid item's default min-width is `auto` (its content's
        // intrinsic width) — the same overflow gotcha CodePanel's and
        // ASCII_WELL_STYLE's comments describe, but for `.ba-grid`'s two
        // `1fr` columns instead of a flex row.
        minWidth: 0,
      }}
    >
      <BeforeAfterLabel side={side} />
      <FixPanel content={content} accent={accent} />
    </div>
  )
}

/* -----------------------------------------------------------------
 * One fix
 * ----------------------------------------------------------------- */

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
    <section id={id}>
      <Card
        padding={44}
        className="fix-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE['4xl']}px`,
          // The fixes-list column below (in ForkFixesPage) is itself a flex
          // column, making every `<section>`/`Card` in it a flex item —
          // same min-width:auto overflow gotcha as CodePanel's comment.
          minWidth: 0,
        }}
      >
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: `${SPACE.sm}px` }}
        >
          <MetaPill href={`${FORK_URL}/pull/${pr}`}>
            <PullRequestIcon size={13} />
            PR #{pr}
          </MetaPill>
          <MetaPill href={`${FORK_URL}/commit/${fixCommit}`}>
            <CommitIcon size={13} />
            {fixCommit}
          </MetaPill>
          <OutputModePill render={render} />
          <UpstreamPills numbers={upstreamIssues} />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE.md}px`,
          }}
        >
          <h3
            style={{
              fontSize: `${FONT_SIZE.h3}px`,
              letterSpacing: LETTER_SPACING.heading,
            }}
          >
            <a
              className="fix-anchor"
              href={`#${id}`}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {title}
            </a>
          </h3>
          <p
            style={{
              // The canvas's own literal (18px would be FONT_SIZE.lead, but
              // this exact hero paragraph draws at 15.5px, between
              // FONT_SIZE.bodyLg (15) and FONT_SIZE.lead (17)).
              fontSize: '15.5px',
              lineHeight: 1.6,
              color: colorVar('--text-dim'),
              maxWidth: '900px',
            }}
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- formatProse output: demo/fork-fixes-data.ts prose, HTML-escaped first, then backtick/asterisk spans turned into <code>/<em>
            dangerouslySetInnerHTML={{ __html: symptomHtml }}
          />
        </div>

        <CodePanel id={id} source={source} />

        <div
          className="ba-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: `${SPACE['4xl']}px`,
          }}
        >
          <BeforeAfterPanel side="before" content={before} />
          <BeforeAfterPanel side="after" content={after} />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE.xs}px`,
          }}
        >
          <SectionEyebrow style={{ fontSize: `${FONT_SIZE.micro}px` }}>
            Look for
          </SectionEyebrow>
          <p
            style={{
              fontSize: `${FONT_SIZE.bodySm}px`,
              lineHeight: 1.6,
              color: colorVar('--text-dim'),
              maxWidth: '46rem',
            }}
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- formatProse output: demo/fork-fixes-data.ts prose, HTML-escaped first, then backtick/asterisk spans turned into <code>/<em>
            dangerouslySetInnerHTML={{ __html: lookForHtml }}
          />
        </div>
      </Card>
    </section>
  )
}

/* -----------------------------------------------------------------
 * The page
 * ----------------------------------------------------------------- */

const NAV_HREFS = {
  diagrams: 'diagrams/',
  editor: 'editor.html',
  forkFixes: '#',
  blog: 'blog/',
  github: FORK_URL,
} as const

const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Diagrams', href: 'diagrams/' },
      { label: 'Editor', href: 'editor.html' },
      { label: 'Fork fixes', href: 'fork-fixes.html' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: 'blog/' },
      { label: 'GitHub', href: FORK_URL },
      {
        label: 'npm package',
        href: 'https://www.npmjs.com/package/zombie-mermaid',
      },
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

export interface ForkFixesPageProps {
  /**
   * The full stylesheet: tokens.tsx's `designBaseCss()`, primitives.tsx's
   * `primitivesCss()`, nav.tsx's `navCss()`, footer.tsx's `footerCss()`, and
   * demo/fork-fixes.css, in that order — see fork-fixes.ts's `generate()`.
   */
  css: string
  fixes: readonly FixSectionProps[]
}

/** The whole fork-fixes.html document. */
export function ForkFixesPage({ css, fixes }: ForkFixesPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>What this fork fixes — zombie-mermaid</title>
        <meta
          name="description"
          content="Before/after renders of bugs zombie-mermaid fixes over upstream beautiful-mermaid."
        />
        <link rel="icon" href="favicon.svg" type="image/svg+xml" />
        <DesignFontLinks />
        <style>{css}</style>
      </head>
      <body>
        <Nav active="forkFixes" homeHref="index.html" hrefs={NAV_HREFS} />

        <header className="section-px" style={{ padding: '88px 80px 72px' }}>
          <div
            style={{
              maxWidth: `${LAYOUT.maxWidth}px`,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: `${SPACE['3xl']}px`,
            }}
          >
            <div
              className="mono"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${SPACE.sm}px`,
                fontSize: `${FONT_SIZE.bodySm}px`,
              }}
            >
              <a href="index.html" style={{ color: colorVar('--text-faint') }}>
                Home
              </a>
              <span style={{ color: colorVar('--text-faint') }}>/</span>
              <span style={{ color: colorVar('--text-dim') }}>Fork fixes</span>
            </div>

            <SectionEyebrow>Real renders, not mockups</SectionEyebrow>

            <h1
              className="page-h1"
              style={{
                fontSize: '48px',
                lineHeight: 1.1,
                letterSpacing: LETTER_SPACING.display,
                maxWidth: '820px',
              }}
            >
              What this fork fixes
            </h1>

            <p
              style={{
                fontSize: `${FONT_SIZE.lead}px`,
                lineHeight: 1.65,
                color: colorVar('--text-dim'),
                maxWidth: '820px',
              }}
            >
              Every pair below is rendered by this project's own renderer. The{' '}
              <strong>before</strong> side runs the code as it existed
              immediately before the fix landed — the tree at that commit's
              parent — so nothing here is hand-drawn or reconstructed. The
              generator fails the build if any pair renders identically, because
              a before/after that looks the same would claim a fix it does not
              demonstrate.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${SPACE.xl}px`,
                marginTop: `${SPACE.xs}px`,
              }}
            >
              <Pill accent="green" variant="outline" mono>
                <CheckIcon size={14} strokeWidth={2.4} />
                {fixes.length} fixes shown
              </Pill>
              <span
                style={{
                  fontSize: `${FONT_SIZE.bodyLg}px`,
                  color: colorVar('--text-dim'),
                }}
              >
                Many more ship in the <a href={CHANGELOG_URL}>changelog</a>.
              </span>
            </div>
          </div>
        </header>

        <main
          className="section-px"
          // 60px bottom padding is the canvas's own literal (between
          // SECTION_SPACE.snug's 64 and .tight's 48).
          style={{ padding: `0 ${LAYOUT.gutter.desktop}px 60px` }}
        >
          <div
            style={{
              maxWidth: `${LAYOUT.maxWidth}px`,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              // 56px, the canvas's own gap between fix cards — off SPACE's
              // scale (7xl is 48, 8xl is 64).
              gap: '56px',
            }}
          >
            {fixes.map((fix) => (
              <FixSection key={fix.id} {...fix} />
            ))}
          </div>
        </main>

        <Footer columns={FOOTER_COLUMNS} />
        <NavCopyScript />
      </body>
    </html>
  )
}
