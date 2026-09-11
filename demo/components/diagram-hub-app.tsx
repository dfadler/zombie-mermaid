/** @jsxRuntime automatic */
/**
 * The diagram-type hub's (`diagrams/index.html`) *hydrated* content
 * (zombie-mermaid#805): the page header and every type row. Split out of
 * `diagram-page.tsx` for the same reason `diagram-type-app.tsx` was — see
 * that file's header comment (this page has no live diagram of its own to
 * re-theme, so it's a much simpler split: no `react-dom/server`-importing
 * concern beyond the usual `<NavIsland>`/`<Footer>` siblings every
 * hydrated page keeps out of its own tree).
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  ChevronRightIcon,
  ClassIcon,
  ErIcon,
  FlowchartIcon,
  SequenceIcon,
  StateIcon,
  XyChartIcon,
  type DiagramTypeIconProps,
} from './icons.tsx'
import { Card, CTA, Pill, type Accent, accentVar } from './primitives.tsx'
import {
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'
import { HOME_HREF, type DiagramTypeLink } from './diagram-type-app.tsx'

const HUB_TYPE_ICONS: Record<
  string,
  (props: DiagramTypeIconProps) => ReactNode
> = {
  flowchart: FlowchartIcon,
  state: StateIcon,
  sequence: SequenceIcon,
  class: ClassIcon,
  er: ErIcon,
  'xy-chart': XyChartIcon,
}
const HUB_ICON_SIZE = 200

/**
 * Ink for a solid-accent CTA that needs to darken into the accent's own hue
 * instead of primitives.tsx's default `--bg`. Amber is the one accent the
 * `DiagramGallery` canvas overrides this way (`color:#241703`); see
 * primitives.tsx's `SOLID_INK` doc comment, which names this exact value.
 */
const AMBER_CTA_INK = '#241703'
function HubBreadcrumb() {
  return (
    <div className="breadcrumb mono">
      <a href={HOME_HREF}>Home</a>
      <ChevronRightIcon size={12} strokeWidth={2.4} />
      <span style={{ color: colorVar('--text-dim') }}>Diagrams</span>
    </div>
  )
}
function DiagramTypeRow({
  type,
  index,
  total,
}: {
  type: DiagramTypeLink & { intro: string; accent: Accent; count: number }
  index: number
  total: number
}) {
  // The canvas bands every other row with `--bg-soft` + hairline borders and
  // reverses the icon/text order on the ones in between (see
  // `DiagramGallery.dc.html`'s six `<div id="…">` sections) — one boolean
  // drives both, since a banded row is always the "normal" direction and an
  // unbanded one always "reverse".
  const isBanded = index % 2 === 0
  const isReversed = !isBanded
  const isLast = index === total - 1
  const Icon = HUB_TYPE_ICONS[type.slug]
  const accent = accentVar(type.accent)
  const ctaStyle: CSSProperties | undefined =
    type.accent === 'amber' ? { color: AMBER_CTA_INK } : undefined

  return (
    <div
      id={type.slug}
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px ${
          isLast ? SECTION_SPACE.hero : SECTION_SPACE.default
        }px ${LAYOUT.gutter.desktop}px`,
        background: isBanded ? colorVar('--bg-soft') : undefined,
        borderTop: isBanded ? `1px solid ${colorVar('--border')}` : undefined,
        borderBottom: isBanded
          ? `1px solid ${colorVar('--border')}`
          : undefined,
      }}
    >
      <div
        className={isReversed ? 'type-row reverse' : 'type-row'}
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          flexDirection: isReversed ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: `${SPACE['8xl']}px`,
        }}
      >
        <Card
          accent={type.accent}
          tone="glow"
          className="icon-panel icon-panel-fixed"
          style={{
            flex: '0 0 460px',
            height: '360px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {Icon ? <Icon size={HUB_ICON_SIZE} color={accent} /> : null}
        </Card>
        <div
          style={{
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['2xl']}px`,
          }}
        >
          <span
            className="type-index mono"
            style={{
              color: accent,
              fontSize: `${FONT_SIZE.bodySm}px`,
              fontWeight: FONT_WEIGHT.bold,
              letterSpacing: '0.1em',
            }}
          >
            {String(index + 1).padStart(2, '0')} /{' '}
            {String(total).padStart(2, '0')}
          </span>
          {/* 34px is off tokens.tsx's FONT_SIZE scale (h3/h2 are the
              neighbours, 26/32) -- the canvas's own literal for this
              heading, kept as-is rather than rounded to either step. */}
          <h2
            style={{ fontSize: '34px', letterSpacing: LETTER_SPACING.heading }}
          >
            {type.label}
          </h2>
          <p
            style={{
              fontSize: `${FONT_SIZE.lead}px`,
              lineHeight: 1.65,
              color: colorVar('--text-dim'),
              maxWidth: '640px',
            }}
          >
            {type.intro}
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE.lg}px`,
              marginTop: `${SPACE.xs}px`,
            }}
          >
            <CTA
              href={`${type.slug}.html`}
              accent={type.accent}
              style={{ width: 'fit-content', ...ctaStyle }}
            >
              View examples
            </CTA>
            {/* zombie-mermaid#989's part 3: how many dedicated pages a
                visitor will find behind "View examples" — each type now
                links to a full directory of real per-sample pages (#1003),
                not just a single hero example, so the count is worth
                surfacing here before the click. `variant="muted"`
                (primitives.tsx's neutral treatment) rather than the type's
                own accent: the CTA stays the one accent-colored action in
                this row, this pill is quiet metadata beside it. */}
            <Pill
              mono
              fontSize={FONT_SIZE.bodySm}
              style={{ cursor: 'default' }}
            >
              {`${type.count} example${type.count === 1 ? '' : 's'}`}
            </Pill>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * `diagram-hub-root`: id of the *hydration container* `demo/diagram-hub-
 * client.tsx`'s `hydrateRoot()` call mounts onto — see `diagram-type-
 * app.tsx`'s `DIAGRAM_TYPE_ROOT_ID` doc comment for the same reasoning.
 */
export const DIAGRAM_HUB_ROOT_ID = 'diagram-hub-root'

/**
 * `diagram-hub-props`: the `<script type="application/json">` element
 * `demo/diagram-hub-client.tsx` reads {@link DiagramHubAppProps} out of.
 */
export const DIAGRAM_HUB_PROPS_ELEMENT_ID = 'diagram-hub-props'

export interface DiagramHubAppProps {
  themeCount: number
  types: ReadonlyArray<
    DiagramTypeLink & { intro: string; accent: Accent; count: number }
  >
}

/**
 * Everything inside {@link DIAGRAM_HUB_ROOT_ID}'s hydration boundary: the
 * page header and every type row — the same content `diagram-page.tsx`'s
 * `DiagramHubPage` used to render directly, in the same order. The exact
 * same function runs on both sides of hydration.
 */
export function DiagramHubApp({ themeCount, types }: DiagramHubAppProps) {
  return (
    <>
      {/* ============ PAGE HEADER ============ */}
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
          <HubBreadcrumb />
          <h1
            className="page-h1"
            style={{
              fontSize: `${FONT_SIZE.display}px`,
              lineHeight: 1.08,
              letterSpacing: LETTER_SPACING.display,
              maxWidth: '820px',
            }}
          >
            Every diagram type.
          </h1>
          <p
            style={{
              fontSize: '18px',
              lineHeight: 1.6,
              color: colorVar('--text-dim'),
              maxWidth: '680px',
            }}
          >
            zombie-mermaid renders {types.length} Mermaid diagram types, each
            with a live picker across every one of its {themeCount} built-in
            themes.
          </p>
        </div>
      </div>

      {/* ============ TYPE ROWS ============ */}
      {types.map((type, index) => (
        <DiagramTypeRow
          key={type.slug}
          type={type}
          index={index}
          total={types.length}
        />
      ))}
    </>
  )
}
