/** @jsxRuntime automatic */
/**
 * Six diagram types, one engine — each card links to its `/diagrams/`
 * page. Tile illustrations live in `gallery-tiles.tsx`.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import { GALLERY_TILES } from './gallery-tiles.tsx'
import { Card, CTA, SectionEyebrow } from './primitives.tsx'
import {
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  SPACE,
  colorVar,
} from './tokens.tsx'

/** The six diagram types the gallery teaser links to, and their `/diagrams/` routes. */
const GALLERY_TYPES = [
  { slug: 'flowchart', label: 'Flowchart' },
  { slug: 'state', label: 'State' },
  { slug: 'sequence', label: 'Sequence' },
  { slug: 'class', label: 'Class' },
  { slug: 'er', label: 'ER' },
  { slug: 'xy-chart', label: 'XY Chart' },
] as const

export function DiagramGalleryTeaser() {
  return (
    <div
      id="diagrams"
      className="section-px"
      style={{
        padding: '100px 80px',
        background: colorVar('--bg-soft'),
        borderTop: `1px solid ${colorVar('--border')}`,
        borderBottom: `1px solid ${colorVar('--border')}`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['6xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>Six diagram types, one engine</SectionEyebrow>
        <h2 style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}>
          Every shape your system needs to explain itself.
        </h2>
      </div>

      <div
        className="gallery-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: `${SPACE['3xl']}px`,
        }}
      >
        {GALLERY_TYPES.map((type, i) => {
          const Tile = GALLERY_TILES[i]!
          return (
            <Card
              key={type.slug}
              href={`diagrams/${type.slug}.html`}
              padding={18}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: `${SPACE.md}px`,
              }}
            >
              <Tile />
              <p
                style={{
                  fontSize: '13.5px',
                  fontWeight: FONT_WEIGHT.bold,
                  textAlign: 'center',
                  color: colorVar('--text'),
                }}
              >
                {type.label}
              </p>
            </Card>
          )
        })}
      </div>

      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `${SPACE['5xl']}px auto 0 auto`,
          textAlign: 'center',
        }}
      >
        <CTA href="diagrams/" accent="cyan" variant="ghost">
          Browse every diagram type
        </CTA>
      </div>
    </div>
  )
}
