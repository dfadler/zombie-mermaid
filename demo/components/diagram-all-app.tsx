/** @jsxRuntime automatic */
/**
 * The "view all" single-scroll page's (`diagrams/all.html`, zombie-
 * mermaid#1001, implementing docs/decisions/diagram-gallery-layout.md's
 * Direction C — revisited as a *browsing convenience* layered on top of
 * the per-type/per-sample/per-tag pages, not a replacement for them; see
 * pages.ts's generator for the exact framing) *hydrated* content:
 * breadcrumb, header, and every real sample across every diagram type,
 * grouped by type, in one continuously-scrolling page — mirroring the
 * reference site's (agents.craft.do/mermaid) own home page.
 *
 * Bounds the height problem the same way `diagram-type-app.tsx`'s
 * `MoreExamplesSection` already does for a single type's gallery (the
 * direct fix for #708's ~18,000px pages): a fixed-aspect-ratio thumbnail
 * frame per card (`pageCss`'s `.gallery-thumb`), not full-size diagrams
 * stacked end to end. With 86 real samples across six types this page is
 * still long, but each card's *height* is bounded regardless of the
 * diagram's own proportions — the same shape #708 fixed, just applied to
 * a page with more cards on it than any one type page has.
 *
 * No interactivity of its own — this file still follows the same SSR
 * string + `hydrateRoot()` pattern every other page here uses (via
 * `demo/diagram-all-client.tsx`), for the same "architectural uniformity"
 * reasoning `diagram-hub-app.tsx`'s doc comment gives.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { ChevronRightIcon } from './icons.tsx'
import { Card, SectionEyebrow, type Accent } from './primitives.tsx'
import {
  FONT_SIZE,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'
import { HOME_HREF, NAV_HREFS, type GalleryItem } from './diagram-type-app.tsx'

export { HOME_HREF, NAV_HREFS }

function AllBreadcrumb() {
  return (
    <div className="breadcrumb mono">
      <a href={HOME_HREF}>Home</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <a href={NAV_HREFS.diagrams}>Diagrams</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <span style={{ color: colorVar('--text-dim') }}>All diagrams</span>
    </div>
  )
}

/**
 * One card in a type section's grid — the same fixed-aspect-thumbnail
 * shape as `diagram-type-app.tsx`'s `GalleryCard`, reimplemented here
 * rather than imported since that component isn't exported (every other
 * page in this family that needs its own result card builds one locally —
 * see `diagram-tag-app.tsx`'s near-identical card for its `TagResultItem`
 * results). Reuses `pageCss`'s `.gallery-card`/`.gallery-thumb`/
 * `.gallery-label`/`.gallery-title` classes for visual consistency with
 * every type page's own "More examples" section.
 */
function AllCard({ item, accent }: { item: GalleryItem; accent: Accent }) {
  return (
    <Card href={item.href} accent={accent} className="gallery-card">
      <div
        className="gallery-thumb"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG output, never user input (see the file header)
        dangerouslySetInnerHTML={{ __html: item.diagramHtml }}
      />
      <div className="gallery-label">
        <span className="gallery-title">{item.title}</span>
      </div>
    </Card>
  )
}

export interface DiagramAllTypeSection {
  /** URL segment, e.g. "flowchart" — also this section's own in-page anchor id. */
  slug: string
  label: string
  accent: Accent
  /** Every real sample for this type, already rendered — `pages.ts`'s `galleryItems` for the type, reused as-is. */
  items: readonly GalleryItem[]
}

function AllTypeSection({ section }: { section: DiagramAllTypeSection }) {
  return (
    <div
      id={section.slug}
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE['4xl']}px`,
        }}
      >
        <SectionEyebrow accent={section.accent}>
          {`${section.items.length} example${section.items.length === 1 ? '' : 's'}`}
        </SectionEyebrow>
        <h2 style={{ fontSize: '30px', letterSpacing: LETTER_SPACING.heading }}>
          {section.label}
        </h2>
        <div className="gallery-grid">
          {section.items.map((item) => (
            <AllCard key={item.title} item={item} accent={section.accent} />
          ))}
        </div>
      </div>
    </div>
  )
}

export const DIAGRAM_ALL_ROOT_ID = 'diagram-all-root'
export const DIAGRAM_ALL_PROPS_ELEMENT_ID = 'diagram-all-props'

export interface DiagramAllAppProps {
  totalCount: number
  sections: readonly DiagramAllTypeSection[]
}

export function DiagramAllApp({ totalCount, sections }: DiagramAllAppProps) {
  return (
    <>
      <div
        className="section-px"
        style={{
          padding: `${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: `${LAYOUT.maxWidth}px`,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['3xl']}px`,
          }}
        >
          <AllBreadcrumb />
          <h1
            className="page-h1"
            style={{
              fontSize: `${FONT_SIZE.display}px`,
              lineHeight: 1.08,
              letterSpacing: LETTER_SPACING.display,
              maxWidth: '820px',
            }}
          >
            Every diagram, one scroll.
          </h1>
          <p
            style={{
              fontSize: '18px',
              lineHeight: 1.6,
              color: colorVar('--text-dim'),
              maxWidth: '680px',
            }}
          >
            {`All ${totalCount} real examples across every zombie-mermaid diagram type, grouped by type. Click any diagram to open its own page.`}
          </p>
        </div>
      </div>

      {sections.map((section) => (
        <AllTypeSection key={section.slug} section={section} />
      ))}
    </>
  )
}
