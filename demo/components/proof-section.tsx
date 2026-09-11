/** @jsxRuntime automatic */
/**
 * Real fork-vs-upstream numbers, and a teaser linking to the full evidence.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ChecklistIcon } from './icons.tsx'
import { Card, CTA, SectionEyebrow } from './primitives.tsx'
import { SlotNumber } from './slot-number.tsx'
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
 * The real fork-vs-upstream snapshot from `demo/dashboard-data.json`
 * (`generatedAt: "2026-09-07T19:17:01.680Z"`), computed the same way
 * `demo/dashboard-model.ts` computes "days since last commit": whole days
 * from a repo's `lastPushedAt` to the snapshot's own `generatedAt`. See the
 * Dashboard page (`dashboard.html`) for the live, refreshed numbers — this
 * snapshot is deliberately captioned as a snapshot, not live data.
 */
const PROOF_SNAPSHOT = {
  asOf: 'Sep 7, 2026',
  fork: { daysSinceCommit: 0, mergedPRs: 334, openPRs: 1 },
  upstream: { daysSinceCommit: 124, mergedPRs: 13, openPRs: 37 },
  rescuedFixCount: 27,
} as const

/**
 * True once the returned ref's element has scrolled into the viewport —
 * flips once and never reverses (the same one-shot contract `demo/index-
 * page-client.ts`'s theme-picker relocation uses for its own
 * `IntersectionObserver`), so scrolling back past the section after the
 * count-up has already played never re-triggers it. Stays `false` forever
 * wherever `IntersectionObserver` isn't available — the same "silently
 * does nothing, stays safe to run unconditionally" fallback that picker
 * relocation uses for its own missing-element case — so a browser without
 * it (or this component's own jsdom hydration test, which has no
 * `IntersectionObserver` either) just keeps the static, already-correct
 * server-rendered numbers instead of animating unprompted.
 */
function useInView<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setInView(true)
          observer.disconnect()
          return
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, inView]
}

/** One repo's stat row: days since last commit, merged PRs, open PRs. */
function StatRow({
  ink,
  daysSinceCommit,
  mergedPRs,
  openPRs,
  animate,
}: {
  ink: string
  daysSinceCommit: number
  mergedPRs: number
  openPRs: number
  /** Whether the slot-reel spin should be playing — see {@link SlotNumber}. */
  animate: boolean
}) {
  const numberStyle = { fontSize: '36px', color: ink } as const

  return (
    <div
      className="stat-row"
      style={{ display: 'flex', justifyContent: 'space-between' }}
    >
      <div>
        <p className="display" style={numberStyle}>
          <SlotNumber value={daysSinceCommit} active={animate} />{' '}
          {daysSinceCommit === 1 ? 'day' : 'days'}
        </p>
        <p style={{ fontSize: '13.5px', color: colorVar('--text-dim') }}>
          since last commit
        </p>
      </div>
      <div>
        <p className="display" style={numberStyle}>
          <SlotNumber value={mergedPRs} active={animate} />
        </p>
        <p style={{ fontSize: '13.5px', color: colorVar('--text-dim') }}>
          merged PRs
        </p>
      </div>
      <div>
        <p className="display" style={numberStyle}>
          <SlotNumber value={openPRs} active={animate} />
        </p>
        <p style={{ fontSize: '13.5px', color: colorVar('--text-dim') }}>
          open PRs
        </p>
      </div>
    </div>
  )
}

export function ProofSection() {
  const [statsRef, statsInView] = useInView<HTMLDivElement>()

  return (
    <div
      id="fixes"
      className="section-px"
      style={{ padding: `${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px` }}
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
        <SectionEyebrow>
          Straight from the live maintenance dashboard
        </SectionEyebrow>
        <h2 style={{ fontSize: '38px', letterSpacing: LETTER_SPACING.heading }}>
          Actively maintained. Not abandoned.
        </h2>
        <p
          style={{
            fontSize: `${FONT_SIZE.lead}px`,
            color: colorVar('--text-dim'),
            maxWidth: `${LAYOUT.proseMaxWidth}px`,
          }}
        >
          beautiful-mermaid stalled — dozens of open PRs, nothing merged in
          months. Here's the same fork, measured against the original as of{' '}
          {PROOF_SNAPSHOT.asOf} — see the{' '}
          <a href="dashboard.html">live dashboard</a> for current numbers.
        </p>
      </div>

      <div
        className="proof-grid"
        ref={statsRef}
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${SPACE['7xl']}px`,
        }}
      >
        <Card
          accent="green"
          padding={36}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['4xl']}px`,
          }}
        >
          <p
            style={{
              fontSize: '15px',
              fontWeight: FONT_WEIGHT.bold,
              color: colorVar('--green'),
              letterSpacing: '0.02em',
            }}
          >
            zombie-mermaid (this fork)
          </p>
          <StatRow
            ink="var(--green)"
            animate={statsInView}
            {...PROOF_SNAPSHOT.fork}
          />
        </Card>

        <Card
          padding={36}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['4xl']}px`,
            opacity: 0.75,
          }}
        >
          <p
            style={{
              fontSize: '15px',
              fontWeight: FONT_WEIGHT.bold,
              color: colorVar('--text-faint'),
              letterSpacing: '0.02em',
            }}
          >
            beautiful-mermaid (upstream)
          </p>
          <StatRow
            ink="var(--text-faint)"
            animate={statsInView}
            {...PROOF_SNAPSHOT.upstream}
          />
        </Card>
      </div>

      <Card
        className="fixes-teaser-card"
        padding={0}
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `${SPACE['6xl']}px auto 0 auto`,
          padding: '32px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: `${SPACE['3xl']}px`,
          background:
            'linear-gradient(90deg, var(--panel) 0%, var(--panel-2) 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE['2xl']}px`,
          }}
        >
          <ChecklistIcon size={34} />
          <div>
            <h3 style={{ fontSize: '19px' }}>What this fork fixes</h3>
            <p
              style={{
                fontSize: `${FONT_SIZE.body}px`,
                color: colorVar('--text-dim'),
              }}
            >
              {PROOF_SNAPSHOT.rescuedFixCount} documented bugs, each shown
              before/after with the actual pre-fix and post-fix code.
            </p>
          </div>
        </div>
        <CTA
          href="fork-fixes.html"
          accent="amber"
          style={{ whiteSpace: 'nowrap' }}
        >
          See the evidence
        </CTA>
      </Card>
    </div>
  )
}
