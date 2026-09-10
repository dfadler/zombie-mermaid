/** @jsxRuntime automatic */
/**
 * "Why This Fork Exists" — the home page's provenance section, named after
 * the README section it mirrors. Deliberately weighted toward
 * zombie-mermaid's own contribution rather than the mermaid.js/beautiful-
 * mermaid history: beautiful-mermaid already solved mermaid.js's
 * aesthetics/theming/terminal-output/dependency problems (see
 * `docs/migrating-from-beautiful-mermaid.md`'s "What is drop-in" section),
 * so restating that in full here would just repeat `FeaturePillars`
 * (`feature-pillars.tsx`) below. What's actually new to this fork — a real
 * CLI binary and the `mergeEdges` render option, both called out as "new to
 * this fork" in that same doc — gets the space instead, plus a link to the
 * fork-fixes page's real, documented before/after bug fixes rather than
 * re-deriving a bug count here (that number already has a home in
 * `ProofSection`'s (`proof-section.tsx`) teaser card below, alongside the
 * fork's actively-maintained-vs-stalled numbers this section deliberately
 * doesn't restate either).
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import { ChecklistIcon, MergeEdgesIcon, TerminalIcon } from './icons.tsx'
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

export function WhyForkExistsSection() {
  return (
    <div
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px`,
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
        <SectionEyebrow>
          The problem with default mermaid rendering
        </SectionEyebrow>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '12.5px',
            color: colorVar('--text-faint'),
          }}
        >
          mermaid.js → beautiful-mermaid →{' '}
          <span style={{ color: colorVar('--text') }}>zombie-mermaid</span>
        </p>
        <h2 style={{ fontSize: '36px', letterSpacing: LETTER_SPACING.heading }}>
          What zombie-mermaid adds on top.
        </h2>
        <p
          style={{
            maxWidth: '760px',
            fontSize: '15.5px',
            lineHeight: 1.5,
            color: colorVar('--text-dim'),
          }}
        >
          beautiful-mermaid already solved mermaid.js's biggest problems —
          aesthetics, theming, terminal output, dependencies. This fork keeps
          all of that, and adds three things beautiful-mermaid never had.
        </p>
      </div>

      <div
        className="why-fork-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `${SPACE['3xl']}px auto 0 auto`,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: `${SPACE['3xl']}px`,
        }}
      >
        <Card
          accent="amber"
          padding={28}
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
            <TerminalIcon size={28} />
            <h3 style={{ fontSize: '19px' }}>A real CLI binary</h3>
          </div>
          <p
            style={{
              fontSize: `${FONT_SIZE.bodySm}px`,
              color: colorVar('--text-dim'),
              lineHeight: 1.5,
            }}
          >
            beautiful-mermaid never shipped one. Pipe Mermaid source in, get SVG
            or ASCII out, straight from the command line.
          </p>
        </Card>

        <Card
          accent="green"
          padding={28}
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
            <MergeEdgesIcon size={28} />
            <h3 style={{ fontSize: '19px', fontFamily: 'var(--font-mono)' }}>
              mergeEdges
            </h3>
          </div>
          <p
            style={{
              fontSize: `${FONT_SIZE.bodySm}px`,
              color: colorVar('--text-dim'),
              lineHeight: 1.5,
            }}
          >
            No beautiful-mermaid equivalent. Bundles fan-out/fan-in edges into a
            shared trunk instead of a tangle of parallel lines.
          </p>
        </Card>

        <Card
          accent="cyan"
          padding={28}
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
            <ChecklistIcon size={28} />
            <h3 style={{ fontSize: '19px' }}>Real bugs, actually fixed</h3>
          </div>
          <p
            style={{
              fontSize: `${FONT_SIZE.bodySm}px`,
              color: colorVar('--text-dim'),
              lineHeight: 1.5,
            }}
          >
            Mermaid syntax beautiful-mermaid shipped with — dropped edges,
            corrupted labels, stray nodes — found and fixed, with the
            before/after code to prove it.
          </p>
        </Card>
      </div>

      <div style={{ textAlign: 'center', marginTop: `${SPACE['3xl']}px` }}>
        <a
          href="fork-fixes.html"
          style={{ fontSize: '14.5px', fontWeight: FONT_WEIGHT.semibold }}
        >
          See every fix, before and after →
        </a>
      </div>
    </div>
  )
}
