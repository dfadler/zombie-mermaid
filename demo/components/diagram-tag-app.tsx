/** @jsxRuntime automatic */
/**
 * The single-tag diagram search page's (`diagrams/tag/<slug>.html`,
 * zombie-mermaid#991, implementing the single-tag portion of
 * docs/decisions/diagram-tag-search.md) *hydrated* content: breadcrumb,
 * header (the construct's real description, from `demo/diagram-tags.ts`'s
 * `TagRule`), and a grid of every real sample across every diagram type
 * that uses the construct.
 *
 * A tag page is cross-type by design — the whole point of tag search over
 * `diagrams/<type>.html`'s type-scoped directory is finding every example
 * of one construct regardless of which diagram type it happens to live
 * in (a dashed edge, say, might appear in a flowchart or a state
 * diagram). So unlike `diagram-type-app.tsx`'s gallery, each card here
 * also shows which type it belongs to.
 *
 * No interactivity of its own — this file still follows the same SSR
 * string + `hydrateRoot()` pattern every other page here uses (via
 * `demo/diagram-tag-client.tsx`), for the same "architectural uniformity"
 * reasoning `diagram-hub-app.tsx`'s doc comment gives, not because
 * anything in this tree needs client state.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { ChevronRightIcon } from './icons.tsx'
import { type Accent, accentVar } from './primitives.tsx'
import {
  FONT_SIZE,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'
import { FORK_URL, HOME_HREF } from './site-chrome.tsx'

export { HOME_HREF }

/**
 * Real destinations relative to `diagrams/tag/<slug>.html` — one level
 * deeper than `diagrams/index.html`, the same depth as
 * `diagrams/<type>/<sample>.html`, so this happens to share
 * `diagram-detail-app.tsx`'s `NAV_HREFS` values — kept as its own copy
 * rather than an import, matching this file family's established
 * "each app file owns its own NAV_HREFS" convention (see that file's
 * identical doc comment for why depth-specific constants aren't shared).
 */
export const NAV_HREFS = {
  diagrams: '../',
  editor: '../../editor',
  forkFixes: '../../fork-fixes.html',
  blog: '../../blog/',
  github: FORK_URL,
} as const

function TagBreadcrumb({ label }: { label: string }) {
  return (
    <div className="breadcrumb mono">
      <a href={HOME_HREF}>Home</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <a href={NAV_HREFS.diagrams}>Diagrams</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <span style={{ color: colorVar('--text-dim') }}>{label}</span>
    </div>
  )
}

export interface TagResultItem {
  title: string
  /** The sample's own type, e.g. "Flowchart" — shown as a small badge since results cross every type. */
  typeLabel: string
  typeAccent: Accent
  /** `../<type-slug>/<sample-slug>.html`, relative to this tag page. */
  href: string
  diagramHtml: string
}

export const DIAGRAM_TAG_ROOT_ID = 'diagram-tag-root'
export const DIAGRAM_TAG_PROPS_ELEMENT_ID = 'diagram-tag-props'

export interface DiagramTagAppProps {
  label: string
  description: string
  results: readonly TagResultItem[]
}

export function DiagramTagApp({
  label,
  description,
  results,
}: DiagramTagAppProps) {
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
          <TagBreadcrumb label={label} />
          <div className="section-eyebrow">Tag</div>
          <h1
            className="page-h1"
            style={{
              fontSize: `${FONT_SIZE.display}px`,
              lineHeight: 1.08,
              letterSpacing: LETTER_SPACING.display,
              maxWidth: '820px',
            }}
          >
            {label}
          </h1>
          <p
            style={{
              fontSize: '18px',
              lineHeight: 1.65,
              color: colorVar('--text-dim'),
              maxWidth: '720px',
            }}
          >
            {description}
          </p>
          <p
            className="mono"
            style={{
              fontSize: `${FONT_SIZE.bodySm}px`,
              color: colorVar('--text-faint'),
            }}
          >
            {`${results.length} example${results.length === 1 ? '' : 's'} across every diagram type`}
          </p>
        </div>
      </div>

      <div
        className="section-px"
        style={{
          padding: `0 ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
        }}
      >
        <div
          style={{
            maxWidth: `${LAYOUT.maxWidth}px`,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
            gap: `${SPACE['2xl']}px`,
          }}
        >
          {results.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="card gallery-card"
              style={{ borderColor: colorVar('--border') }}
            >
              <div
                className="gallery-thumb"
                // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG output, never user input (see the file header)
                dangerouslySetInnerHTML={{ __html: item.diagramHtml }}
              />
              <div className="gallery-label">
                <span
                  className="mono"
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: accentVar(item.typeAccent),
                    marginBottom: `${SPACE.xxs}px`,
                  }}
                >
                  {item.typeLabel}
                </span>
                <span className="gallery-title">{item.title}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
