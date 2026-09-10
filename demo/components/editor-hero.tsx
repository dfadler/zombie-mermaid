/** @jsxRuntime automatic */
/**
 * The editor page's hero header -- breadcrumb + heading + description, split
 * out of `editor-page.tsx` (zombie-mermaid#935's audit) as an independent
 * presentational component: it takes one prop (`homeHref`), owns no state,
 * and shares nothing with `editor-feature-strip.tsx`'s `EditorFeatureStrip`
 * beyond both being lifted from the same design-canvas artboard -- the same
 * "no shared state between them" pattern #932/#933 split index-app.tsx's/
 * nav.tsx's own presentational components on.
 *
 * `HERO_H1_SIZE`/`HERO_H1_SIZE_MOBILE` are exported (not just used locally)
 * because `editor-page.tsx`'s own `editorPageCss()` needs the same two
 * numbers for its `.page-h1` media-query rules -- one literal, shared here
 * rather than duplicated across both files.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here --
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { ChevronRightIcon } from './icons.tsx'
import {
  FONT_SIZE,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/** The hero h1's desktop size, in px — the mockup's own literal (46), not
 * on tokens.tsx's `FONT_SIZE` scale (its `h1` step is a plainer 38). */
export const HERO_H1_SIZE = 46
/** The hero h1's size at 600px and below — this one does match
 * tokens.tsx's `FONT_SIZE.h1Mobile`, kept literal alongside
 * {@link HERO_H1_SIZE} rather than split across two sources. */
export const HERO_H1_SIZE_MOBILE = 34

/** Breadcrumb + heading + description, lifted from the canvas's page
 * header — the only copy on the editor page that isn't the tool itself. */
export function EditorHero({ homeHref }: { homeHref: string }) {
  return (
    <div
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px ${SPACE['5xl']}px ${LAYOUT.gutter.desktop}px`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <nav
          aria-label="Breadcrumb"
          className="mono"
          style={{
            fontSize: `${FONT_SIZE.bodySm}px`,
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE.xs}px`,
          }}
        >
          <a href={homeHref} style={{ color: colorVar('--text-faint') }}>
            Home
          </a>
          <ChevronRightIcon size={12} strokeWidth={2.4} />
          <span style={{ color: colorVar('--text-dim') }}>Editor</span>
        </nav>
        <h1
          className="page-h1"
          style={{
            fontSize: `${HERO_H1_SIZE}px`,
            lineHeight: 1.1,
            letterSpacing: LETTER_SPACING.display,
            maxWidth: 760,
          }}
        >
          Write Mermaid, watch it render as you type.
        </h1>
        <p
          style={{
            fontSize: `${FONT_SIZE.lead}px`,
            lineHeight: 1.6,
            color: colorVar('--text-dim'),
            maxWidth: 640,
          }}
        >
          A live SVG preview, 15 switchable themes, pan &amp; zoom, and
          one-click SVG export — every diagram you edit here round-trips through
          the URL, so a shared link reproduces the exact view.
        </p>
      </div>
    </div>
  )
}
