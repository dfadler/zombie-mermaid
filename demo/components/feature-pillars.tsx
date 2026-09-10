/** @jsxRuntime automatic */
/**
 * "Built for how diagrams get used now" — three named pillars (Output
 * flexibility / Drop-in architecture / Proven at scale), two facts each,
 * from {@link FEATURE_ICONS}/{@link FEATURE_COPY}/{@link PILLAR_GROUPS}.
 * Theming is deliberately absent — see {@link FEATURE_ICONS}'s doc comment
 * (icons.tsx) for why.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import { FEATURE_ICONS, ICONS } from './icons.tsx'
import { Card, SectionEyebrow } from './primitives.tsx'
import {
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/**
 * Feature-pillar copy, paired with {@link FEATURE_ICONS}'s six entries by
 * index and grouped by {@link PILLAR_GROUPS}. Paraphrases the README's own
 * "Features" bullets (dual output, mono mode, zero DOM dependencies,
 * synchronous rendering, ultra-fast, CI-enforced accessible SVG output)
 * rather than inventing marketing copy — see {@link FEATURE_ICONS}'s own
 * doc comment (icons.tsx) for why theming isn't among them.
 */
const FEATURE_COPY = [
  'SVG for rich UIs, ASCII/Unicode for terminals — mermaid.js itself has no real terminal story.',
  'Full diagrams rendered from just two colors, when that’s all you’ve got.',
  'Pure TypeScript. Works in the browser, on the server, or anywhere else.',
  'No async, no flash of unstyled diagram — drops straight into React’s useMemo().',
  'Renders 100+ diagrams in under 500ms — fast enough for every diagram in a CI run.',
  'Every diagram type ships a role-correct, nameable SVG root — checked in CI, not just claimed.',
] as const

/**
 * Groups {@link FEATURE_ICONS}/{@link FEATURE_COPY}'s six entries into the
 * three pillars {@link FeaturePillars} renders, two facts each, in the same
 * order as those two arrays (indices 0-1, 2-3, 4-5).
 */
const PILLAR_GROUPS = [
  { label: 'Output flexibility' },
  { label: 'Drop-in architecture' },
  { label: 'Proven at scale' },
] as const

export function FeaturePillars() {
  return (
    <div
      className="section-px"
      style={{
        padding: `0 ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px`,
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
        <SectionEyebrow>Built for how diagrams get used now</SectionEyebrow>
        <h2 style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}>
          Three ways this stays out of your way.
        </h2>
        <p
          style={{
            maxWidth: '640px',
            fontSize: '15px',
            color: colorVar('--text-faint'),
          }}
        >
          (Theming and the fork's backstory are covered above — this is what you
          actually build with.)
        </p>
      </div>

      <div
        className="pillar-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `${SPACE['3xl']}px auto 0 auto`,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: `${SPACE['3xl']}px`,
        }}
      >
        {PILLAR_GROUPS.map((group, groupIndex) => {
          const first = FEATURE_ICONS[groupIndex * 2]
          const second = FEATURE_ICONS[groupIndex * 2 + 1]
          // Invariant: PILLAR_GROUPS has exactly 3 entries and FEATURE_ICONS
          // exactly 6, so every group's pair is always in bounds — this
          // guard exists only to satisfy strict indexed-access typing.
          if (!first || !second) return null
          const firstCopy = FEATURE_COPY[groupIndex * 2]
          const secondCopy = FEATURE_COPY[groupIndex * 2 + 1]
          if (firstCopy === undefined || secondCopy === undefined) return null
          const items = [
            { feature: first, copy: firstCopy },
            { feature: second, copy: secondCopy },
          ]
          return (
            <Card
              key={group.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: `${SPACE.lg}px`,
                padding: '26px 24px',
              }}
            >
              <h3 style={{ fontSize: '22px' }}>{group.label}</h3>
              {items.map(({ feature, copy }, itemIndex) => {
                const ItemIcon = ICONS[feature.name]
                return (
                  <div
                    key={feature.name}
                    style={
                      itemIndex === 0
                        ? {
                            display: 'flex',
                            gap: `${SPACE.sm}px`,
                            alignItems: 'flex-start',
                            marginTop: `${SPACE.xs}px`,
                          }
                        : {
                            display: 'flex',
                            gap: `${SPACE.sm}px`,
                            alignItems: 'flex-start',
                            paddingTop: `${SPACE.md}px`,
                            borderTop: `1px solid ${colorVar('--border')}`,
                          }
                    }
                  >
                    <div style={{ flexShrink: 0 }}>
                      <ItemIcon size={28} />
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: `${FONT_SIZE.body}px`,
                        color: colorVar('--text-dim'),
                        lineHeight: 1.5,
                      }}
                    >
                      <strong
                        style={{
                          color: colorVar('--text'),
                          fontWeight: FONT_WEIGHT.semibold,
                        }}
                      >
                        {feature.label}.
                      </strong>{' '}
                      {copy}
                    </p>
                  </div>
                )
              })}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
