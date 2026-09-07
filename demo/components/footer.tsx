/** @jsxRuntime automatic */
/**
 * The redesign's shared site Footer (#594, part of the #591 component
 * library, part of the #590 redesign).
 *
 * Like tokens.tsx (#592) and primitives.tsx (#595), every structure, value,
 * and string here was lifted from the design canvas linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * not invented. The canvas's sixteen "Diagram-Native Showcase" artboards —
 * eight pages, each in a 1440px desktop and a 390px mobile variant — carry a
 * byte-identical footer section: the same four-column grid, the same link
 * lists, the same copyright and fork lines, down to the whitespace. (The
 * canvas holds two further artboards, `TerminalNative` and `EditorialProduct`,
 * which are alternate visual directions rather than part of the chosen
 * sixteen; their footers differ and are deliberately *not* the source here.)
 *
 * The canvas authors this section as a `.section-px` wrapper with inline
 * padding, a `.footer-grid` of four columns, and a `.footer-bottom-row`, with
 * the responsive behaviour carried by three `!important` rules in the shared
 * `<helmet><style>` preamble. That split is reproduced exactly: layout that
 * never changes stays inline, and the three rules that must beat an inline
 * `grid-template-columns` / `flex-direction` live in {@link footerCss}.
 *
 * Nothing on the site consumes this yet — wiring it into the pages is
 * #598-610's job. demo/components/site-chrome.tsx has its own, much smaller
 * `SiteFooter` (a copyright span and a GitHub link) which the current static
 * pages still render; this component is its eventual replacement, but
 * swapping them over belongs to the page issues, so site-chrome.tsx is left
 * untouched here.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  BREAKPOINTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/* -----------------------------------------------------------------
 * Content
 * ----------------------------------------------------------------- */

/**
 * One entry in a footer column.
 *
 * `href` is optional because the canvas's Project column mixes the two: "MIT
 * Licensed" is a bare `<span>`, "dfadler/zombie-mermaid" is an `<a>`. An
 * entry without an `href` renders as the span.
 */
export interface FooterLink {
  /** The visible text. */
  label: string
  /** Destination. Omit for a non-interactive entry. */
  href?: string
}

/** A titled column of {@link FooterLink}s. */
export interface FooterColumn {
  /** The uppercase heading above the list. */
  title: string
  /** The column's entries, in order. */
  links: FooterLink[]
}

/**
 * The wordmark text beside the brand mark.
 */
export const FOOTER_WORDMARK = 'zombie-mermaid'

/** The one-line description under the wordmark, verbatim from the canvas. */
export const FOOTER_TAGLINE =
  'An open source library for rendering Mermaid diagrams, designed for the age of AI.'

/**
 * The three link columns, verbatim from the canvas.
 *
 * The `href`s are the artboards' own in-page placeholders (`#diagrams`,
 * `#github`, …) because a mockup has nowhere real to point. They are kept
 * exactly as the canvas spells them so this module stays a faithful
 * transcription; the page issues (#598-610) pass real destinations through
 * {@link FooterProps.columns} when they wire the footer up.
 */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Diagrams', href: '#diagrams' },
      { label: 'Editor', href: '#editor' },
      { label: 'Fork fixes', href: '#fixes' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '#blog' },
      { label: 'GitHub', href: '#github' },
      { label: 'npm package', href: '#npm' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'MIT Licensed' },
      { label: 'dfadler/zombie-mermaid', href: '#github' },
    ],
  },
]

/** The bottom bar's left-hand line, verbatim from the canvas. */
export const FOOTER_COPYRIGHT =
  '© 2026 zombie-mermaid contributors. MIT licensed.'

/** The bottom bar's right-hand line, verbatim from the canvas. */
export const FOOTER_FORK_NOTE = 'Actively maintained fork of beautiful-mermaid.'

/* -----------------------------------------------------------------
 * Literals the token scales do not cover
 * ----------------------------------------------------------------- */

/**
 * The tagline's measure in px. Not on any tokens.tsx scale — it is the one
 * place in the artboards that constrains a paragraph to 320px — so it stays
 * a literal rather than becoming a layout token nothing else references.
 */
const TAGLINE_MAX_WIDTH = 320

/**
 * The tagline's line height. tokens.tsx's `LINE_HEIGHT` carries 1.5 (body)
 * and 1.9 (prose); the canvas sets 1.6 here specifically, so it is spelled
 * out rather than rounded to a neighbouring step.
 */
const TAGLINE_LINE_HEIGHT = 1.6

/**
 * The tracking on a column heading, in em.
 *
 * Deliberately *not* `LETTER_SPACING.eyebrow` (0.14em): the headings look
 * like a section eyebrow but are a distinct treatment in the canvas —
 * `--text-faint` rather than `--cyan`, and tracked out only 0.08em. Using the
 * eyebrow token here would silently restyle them.
 */
const COLUMN_TITLE_TRACKING = '0.08em'

/** The brand mark's stroke weight, as the canvas declares it. */
const MARK_STROKE_WIDTH = '1.6'

/** The brand mark's edge length in px in the footer; the nav draws it at 30. */
const MARK_SIZE = 22

/* -----------------------------------------------------------------
 * CSS
 * ----------------------------------------------------------------- */

/**
 * The footer's responsive rules, transcribed from the showcase artboards'
 * shared `<helmet><style>` preamble.
 *
 * Three rules, and only three — everything else about the footer is inline,
 * exactly as the canvas authors it. Each carries `!important` because it has
 * to beat the inline `grid-template-columns` / `flex-direction` on the
 * element it targets; that is the canvas's own reason for the flag, not a
 * specificity workaround added here.
 *
 * `.section-px` is the canvas's full-bleed gutter hook. It has no base rule
 * anywhere in the artboards — each section sets its own inline padding and
 * `.section-px` only narrows the horizontal half at the two breakpoints — so
 * it is included here to keep {@link Footer} self-contained. A page that
 * emits the same two rules for its other sections produces identical
 * declarations, so the duplication is inert.
 *
 * Emit this once per page, after tokens.tsx's `designBaseCss()`.
 */
export function footerCss(): string {
  return `@media (max-width: ${BREAKPOINTS.tablet}px) {
  .section-px {
    padding-left: ${LAYOUT.gutter.tablet}px !important;
    padding-right: ${LAYOUT.gutter.tablet}px !important;
  }

  .footer-grid {
    grid-template-columns: 1fr 1fr !important;
  }
}

@media (max-width: ${BREAKPOINTS.mobile}px) {
  .section-px {
    padding-left: ${LAYOUT.gutter.mobile}px !important;
    padding-right: ${LAYOUT.gutter.mobile}px !important;
  }

  .footer-grid {
    grid-template-columns: 1fr !important;
  }

  .footer-bottom-row {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: ${SPACE.xs}px !important;
  }
}`
}

/** {@link footerCss} in a `<style>` element, for a page's `<head>`. */
export function FooterStyle() {
  return <style>{footerCss()}</style>
}

/* -----------------------------------------------------------------
 * Brand mark
 * ----------------------------------------------------------------- */

export interface FooterMarkProps {
  /** Edge length in px. Defaults to the footer's 22; the nav draws it at 30. */
  size?: number
}

/**
 * The zombie-mermaid brand mark: two rounded squares over a bracket, in
 * cyan/violet/pink.
 *
 * The canvas draws this identically in the nav (at 30px) and the footer (at
 * 22px) — same `viewBox`, same three shapes, same stroke width — so `size` is
 * the only thing that varies. It lives here rather than in a shared module
 * because #596's icon set is landing in parallel; if that ships a canonical
 * wordmark, both this and #593's Nav should adopt it and drop their copies.
 *
 * Marked `aria-hidden` because the wordmark text beside it already names the
 * project, so announcing the mark would just repeat it.
 */
export function FooterMark({ size = MARK_SIZE }: FooterMarkProps = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="9"
        height="9"
        rx="3"
        stroke={colorVar('--cyan')}
        strokeWidth={MARK_STROKE_WIDTH}
      />
      <rect
        x="13"
        y="2"
        width="9"
        height="9"
        rx="3"
        stroke={colorVar('--violet')}
        strokeWidth={MARK_STROKE_WIDTH}
      />
      <path
        d="M6.5 11 V16 a2 2 0 0 0 2 2 h7 a2 2 0 0 0 2-2 v-5"
        stroke={colorVar('--pink')}
        strokeWidth={MARK_STROKE_WIDTH}
        fill="none"
      />
    </svg>
  )
}

/* -----------------------------------------------------------------
 * Footer
 * ----------------------------------------------------------------- */

/** The shared ink and size for every entry in a link column. */
const LINK_STYLE: CSSProperties = {
  fontSize: `${FONT_SIZE.body}px`,
  color: colorVar('--text-dim'),
}

/** The shared ink and size for both lines of the bottom bar. */
const BOTTOM_LINE_STYLE: CSSProperties = {
  fontSize: `${FONT_SIZE.label}px`,
  color: colorVar('--text-faint'),
}

/** One titled column of links. */
function FooterColumnList({ column }: { column: FooterColumn }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACE.md}px`,
      }}
    >
      <p
        style={{
          fontSize: `${FONT_SIZE.label}px`,
          fontWeight: FONT_WEIGHT.bold,
          color: colorVar('--text-faint'),
          textTransform: 'uppercase',
          letterSpacing: COLUMN_TITLE_TRACKING,
        }}
      >
        {column.title}
      </p>
      {column.links.map((link) =>
        link.href === undefined ? (
          <span key={link.label} style={LINK_STYLE}>
            {link.label}
          </span>
        ) : (
          <a key={link.label} href={link.href} style={LINK_STYLE}>
            {link.label}
          </a>
        ),
      )}
    </div>
  )
}

export interface FooterProps {
  /** The wordmark text. Defaults to {@link FOOTER_WORDMARK}. */
  wordmark?: string
  /** The line under the wordmark. Defaults to {@link FOOTER_TAGLINE}. */
  tagline?: ReactNode
  /**
   * The link columns to the right of the brand block. Defaults to
   * {@link FOOTER_COLUMNS} — the canvas's Product / Resources / Project.
   */
  columns?: readonly FooterColumn[]
  /** The bottom bar's left line. Defaults to {@link FOOTER_COPYRIGHT}. */
  copyright?: ReactNode
  /** The bottom bar's right line. Defaults to {@link FOOTER_FORK_NOTE}. */
  forkNote?: ReactNode
  /** Appended to `section-px`, for a page's own modifier class. */
  className?: string
  /** Merged onto the outer section, so a page can override its padding. */
  style?: CSSProperties
}

/**
 * The site-wide footer: a brand block plus link columns over a bottom bar.
 *
 * ```tsx
 * <Footer />
 * ```
 *
 * renders the canvas's footer exactly — wordmark, tagline, the Product /
 * Resources / Project columns, and the copyright + fork lines. The grid is
 * `2fr` for the brand block and `1fr` per link column, so passing a different
 * number of `columns` widens or narrows the row rather than breaking it.
 *
 * Responsive behaviour comes from {@link footerCss}, which the page must emit:
 * four columns collapse to two at 900px and to one at 600px, where the bottom
 * bar also stacks.
 *
 * The one deliberate departure from the canvas is the outer element: the
 * artboards use a plain `<div class="section-px">`, since a mockup has no
 * landmark semantics to get right, while this renders a `<footer>` carrying
 * the same class. That matches what site-chrome.tsx's existing `SiteFooter`
 * already emits and gives the page a `contentinfo` landmark; it changes no
 * styling, because nothing in the canvas selects on the tag.
 */
export function Footer({
  wordmark = FOOTER_WORDMARK,
  tagline = FOOTER_TAGLINE,
  columns = FOOTER_COLUMNS,
  copyright = FOOTER_COPYRIGHT,
  forkNote = FOOTER_FORK_NOTE,
  className,
  style,
}: FooterProps = {}) {
  const outerStyle: CSSProperties = {
    padding: `${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.tight}px ${LAYOUT.gutter.desktop}px`,
    borderTop: `1px solid ${colorVar('--border')}`,
    background: colorVar('--bg-soft'),
    ...style,
  }
  return (
    <footer
      className={['section-px', className].filter(Boolean).join(' ')}
      style={outerStyle}
    >
      <div
        className="footer-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: `2fr ${columns.map(() => '1fr').join(' ')}`,
          gap: `${SPACE['7xl']}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE.lg}px`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE.sm}px`,
            }}
          >
            <FooterMark />
            <span
              className="display"
              style={{ fontSize: `${FONT_SIZE.lead}px` }}
            >
              {wordmark}
            </span>
          </div>
          <p
            style={{
              fontSize: `${FONT_SIZE.bodySm}px`,
              color: colorVar('--text-dim'),
              maxWidth: `${TAGLINE_MAX_WIDTH}px`,
              lineHeight: TAGLINE_LINE_HEIGHT,
            }}
          >
            {tagline}
          </p>
        </div>

        {columns.map((column) => (
          <FooterColumnList key={column.title} column={column} />
        ))}
      </div>

      <div
        className="footer-bottom-row"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `${SPACE['6xl']}px auto 0 auto`,
          paddingTop: `${SPACE['3xl']}px`,
          borderTop: `1px solid ${colorVar('--border')}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <p style={BOTTOM_LINE_STYLE}>{copyright}</p>
        <p style={BOTTOM_LINE_STYLE}>{forkNote}</p>
      </div>
    </footer>
  )
}
