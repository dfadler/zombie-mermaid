/** @jsxRuntime automatic */
/**
 * The editor page's feature strip below the tool -- split out of
 * `editor-page.tsx` (zombie-mermaid#935's audit) as an independent
 * presentational component: it takes no props, owns no state, and shares
 * nothing with `editor-hero.tsx`'s `EditorHero` beyond both being lifted
 * from the same design-canvas artboard -- the same "no shared state between
 * them" pattern #932/#933 split index-app.tsx's/nav.tsx's own presentational
 * components on.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here --
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import {
  DownloadIcon,
  ShareIcon,
  SyncRenderIcon,
  ThemesIcon,
} from './icons.tsx'
import { Card } from './primitives.tsx'
import {
  FONT_SIZE,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/** One card in the feature strip below the tool. */
interface EditorFeature {
  icon: ReactNode
  title: string
  description: string
}

/** The four features the canvas's editor page calls out, in canvas order —
 * each icon is icons.tsx's own component for that exact feature (see each
 * icon's CANVAS note for the Editor.dc.html reference). */
const EDITOR_FEATURES: readonly EditorFeature[] = [
  {
    icon: <SyncRenderIcon size={26} color={colorVar('--blue')} />,
    title: 'Live, debounced rendering',
    description:
      'Type or paste Mermaid source and the preview re-renders a beat later — no explicit "run" button, no full page reload.',
  },
  {
    icon: <ShareIcon size={26} />,
    title: 'Shareable via URL',
    description:
      'The diagram source and selected theme both round-trip through the URL hash — copy the link, send the exact view.',
  },
  {
    icon: <ThemesIcon size={26} color={colorVar('--violet')} />,
    title: '15 built-in themes',
    description:
      'Switch instantly between all 15 themes right from the toolbar, with no re-parse of your diagram source.',
  },
  {
    icon: <DownloadIcon size={26} />,
    title: 'One-click SVG export',
    description:
      'Download the exact rendered diagram as a clean, standalone SVG file — ready to drop into docs or slides.',
  },
] as const

/** The feature-strip section below the tool: an eyebrow + heading over a
 * four-card grid, one card per {@link EDITOR_FEATURES} entry. */
export function EditorFeatureStrip() {
  return (
    <div
      className="section-px"
      style={{
        padding: `${SPACE['5xl']}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
        background: colorVar('--bg-soft'),
        borderTop: `1px solid ${colorVar('--border')}`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['7xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <span className="section-eyebrow">
          Everything a mermaid.live user expects
        </span>
        <h2
          style={{
            fontSize: `${FONT_SIZE.h2}px`,
            letterSpacing: LETTER_SPACING.heading,
          }}
        >
          Built to be the fast, shareable way to draft a diagram.
        </h2>
      </div>

      <div
        className="editor-features-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: `${SPACE['3xl']}px`,
        }}
      >
        {EDITOR_FEATURES.map((feature) => (
          <Card
            key={feature.title}
            padding={26}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${SPACE.lg}px`,
            }}
          >
            {feature.icon}
            <h3 style={{ fontSize: `${FONT_SIZE.lead}px` }}>{feature.title}</h3>
            <p
              style={{
                fontSize: `${FONT_SIZE.bodySm}px`,
                color: colorVar('--text-dim'),
                lineHeight: 1.5,
              }}
            >
              {feature.description}
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}
