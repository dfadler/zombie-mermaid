/** @jsxRuntime automatic */
/**
 * The homepage hero's code panel + output panel, replacing `<HeroVisual/>`'s
 * single static `hero-visual.svg` `<img>` with a live, interactive pair:
 * {@link HeroCodePanel} (a fresh HTML/CSS rendition of the same fake
 * Mermaid source `public/hero-visual.svg` draws as static shapes, following
 * `fork-fixes-app.tsx`'s `CodePanel` shape — traffic-light dots plus a mono
 * source block) and {@link HeroOutputPanel} (a segmented "SVG / ASCII"
 * toggle switching between a freshly-extracted, inline flowchart SVG — so
 * its `.edge-anim` marching-ants animation actually plays, which a static
 * `<img>` can't drive from the host page's own stylesheet — and the real
 * `renderMermaidASCII()` output, passed in as `asciiHtml` and computed by
 * `index-page.tsx` at build/SSR time; see that file's header comment for why
 * the render call can't live in this client-hydrated file).
 *
 * `public/hero-visual.svg` (and the `HeroVisual`/`hero-visual.tsx`
 * component that renders it) stay untouched — `scripts/generate-hero.ts`
 * still reads that file directly as the README's own hero.svg source of
 * truth, and a static image is the right choice there (GitHub can't run
 * this toggle's JS). {@link HERO_MERMAID_SOURCE} below is a hand-kept-in-sync
 * copy of the same fake source `public/hero-visual.svg` and
 * `scripts/generate-hero.ts` already duplicate between them — a third copy
 * now, the same accepted tradeoff those two already make (see
 * `hero-visual.tsx`'s own header comment).
 */
import { useState, type CSSProperties } from 'react'
import {
  FONT_SIZE,
  LETTER_SPACING,
  RADIUS,
  SPACE,
  colorVar,
} from './tokens.tsx'

/**
 * The Mermaid source {@link HeroCodePanel} displays and — via
 * `index-page.tsx`'s `renderMermaidASCII(HERO_MERMAID_SOURCE, ...)` call —
 * the real string {@link HeroOutputPanel}'s ASCII state renders. Keep in
 * sync with `HeroCodePanel`'s hand-colored display below, and with
 * `public/hero-visual.svg`/`scripts/generate-hero.ts`'s own copies, by
 * hand — nothing derives one from the others.
 */
export const HERO_MERMAID_SOURCE = `graph TD
  Start e1@--> Deploy{Deploy?}
  Deploy e2@-->|yes| Ship[Ship it]
  Deploy e3@-->|no| Iterate[Iterate]
  e1@{ animate: true }
  e2@{ animate: true }
  e3@{ animate: true }
`

/**
 * The traffic-light dots on the code panel's fake title bar — the same
 * canvas literals `fork-fixes-app.tsx`'s `TRAFFIC_LIGHT_COLORS` and
 * `public/hero-visual.svg` use, kept as its own copy here rather than an
 * import across two independently-hydrated client apps.
 */
const TRAFFIC_LIGHT_COLORS = ['#ff6767', '#ffc85c', '#5ee08a']

/**
 * The hero's fake "source code" panel — a fresh HTML/CSS rendition of the
 * same content `public/hero-visual.svg` draws as static SVG shapes, so it
 * can sit beside the real, interactive {@link HeroOutputPanel}.
 */
export function HeroCodePanel() {
  return (
    <div
      className="hero-code-panel"
      style={{
        flex: '0 0 240px',
        minWidth: 0,
        background: colorVar('--panel'),
        border: `1.5px solid ${colorVar('--border')}`,
        borderRadius: `${RADIUS.xl}px`,
        padding: `${SPACE.xl}px ${SPACE['2xl']}px`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${SPACE.sm}px`,
          marginBottom: `${SPACE.md}px`,
        }}
      >
        {TRAFFIC_LIGHT_COLORS.map((color) => (
          <span
            key={color}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: color,
              display: 'inline-block',
            }}
          />
        ))}
      </div>
      <div
        className="mono"
        style={{
          fontSize: `${FONT_SIZE.bodySm}px`,
          lineHeight: 1.9,
          whiteSpace: 'pre',
          fontVariantLigatures: 'none',
        }}
      >
        <div style={{ color: colorVar('--text-faint') }}>graph TD</div>
        <div style={{ color: colorVar('--text-dim') }}>
          {'  Start '}
          <span style={{ color: colorVar('--text-faint') }}>e1@</span>
          {'--> '}
          <span style={{ color: colorVar('--violet') }}>Deploy</span>
          {'{Deploy?}'}
        </div>
        <div style={{ color: colorVar('--text-dim') }}>
          {'  Deploy '}
          <span style={{ color: colorVar('--text-faint') }}>e2@</span>
          {'-->|'}
          <span style={{ color: colorVar('--green') }}>yes</span>
          {'| '}
          <span style={{ color: colorVar('--amber') }}>Ship</span>
          {'[Ship it]'}
        </div>
        <div style={{ color: colorVar('--text-dim') }}>
          {'  Deploy '}
          <span style={{ color: colorVar('--text-faint') }}>e3@</span>
          {'-->|'}
          <span style={{ color: colorVar('--pink') }}>no</span>
          {'| '}
          <span style={{ color: colorVar('--amber') }}>Iterate</span>
          {'[Iterate]'}
        </div>
        <div style={{ color: colorVar('--text-faint') }}>
          {'  e1@{ '}
          <span style={{ color: colorVar('--text-dim') }}>animate</span>
          {': '}
          <span style={{ color: colorVar('--amber') }}>true</span>
          {' }'}
        </div>
        <div style={{ color: colorVar('--text-faint') }}>
          {'  e2@{ '}
          <span style={{ color: colorVar('--text-dim') }}>animate</span>
          {': '}
          <span style={{ color: colorVar('--amber') }}>true</span>
          {' }'}
        </div>
        <div style={{ color: colorVar('--text-faint') }}>
          {'  e3@{ '}
          <span style={{ color: colorVar('--text-dim') }}>animate</span>
          {': '}
          <span style={{ color: colorVar('--amber') }}>true</span>
          {' }'}
        </div>
      </div>
    </div>
  )
}

/**
 * The flowchart only (no code panel), extracted from `public/hero-visual.svg`'s
 * own shapes/coordinates/colors verbatim — every `x`/`y`/`d` literal below is
 * copied unchanged from that file, just without the code-panel rect/text and
 * the connector path that used to bridge the two. The `viewBox` origin
 * (374, 36) matches the shapes' own existing absolute coordinates instead of
 * renumbering them, so nothing here needs new coordinate math.
 *
 * Rendered inline (unlike the static file), so `.edge-anim` — defined once
 * in `index-page.tsx`'s `homePageCss()` — actually animates; `hero-visual.svg`
 * has to restate that animation itself since an `<img>` can't inherit CSS
 * from its host page.
 */
function HeroFlowchartSvg() {
  return (
    <svg
      viewBox="374 36 306 324"
      width="100%"
      style={{ display: 'block' }}
      role="img"
      aria-label="Start leads to a Deploy decision, which leads to Ship it or Iterate"
    >
      <rect
        x="430"
        y="50"
        width="140"
        height="50"
        rx="25"
        fill={colorVar('--blue')}
      />
      <text
        x="500"
        y="80"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#081018"
      >
        Start
      </text>
      <path
        d="M500 100 L500 130"
        stroke={colorVar('--cyan')}
        strokeWidth="2.5"
        fill="none"
        className="edge-anim"
        markerEnd="url(#hero-arrow-cyan)"
      />
      <polygon
        points="500,140 565,175 500,210 435,175"
        fill={colorVar('--violet')}
      />
      <text
        x="500"
        y="180"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill={colorVar('--bg')}
      >
        Deploy?
      </text>
      <path
        d="M435 175 C 390 225 410 265 435 291"
        stroke={colorVar('--green')}
        strokeWidth="2.5"
        fill="none"
        className="edge-anim"
        markerEnd="url(#hero-arrow-green)"
      />
      <text
        x="378"
        y="240"
        fontSize="12"
        fill={colorVar('--green')}
        className="mono"
      >
        yes
      </text>
      <path
        d="M565 175 C 610 225 592 265 602 289"
        stroke={colorVar('--pink')}
        strokeWidth="2.5"
        fill="none"
        className="edge-anim"
        markerEnd="url(#hero-arrow-pink)"
      />
      <text
        x="600"
        y="240"
        fontSize="12"
        fill={colorVar('--pink')}
        className="mono"
      >
        no
      </text>
      <rect
        x="382"
        y="300"
        width="130"
        height="50"
        rx="12"
        fill={colorVar('--green')}
      />
      <text
        x="447"
        y="330"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#081018"
      >
        Ship it
      </text>
      <rect
        x="546"
        y="300"
        width="130"
        height="50"
        rx="12"
        fill={colorVar('--pink')}
      />
      <text
        x="611"
        y="330"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#2a0a18"
      >
        Iterate
      </text>
      <defs>
        <marker
          id="hero-arrow-cyan"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill={colorVar('--cyan')} />
        </marker>
        <marker
          id="hero-arrow-green"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill={colorVar('--green')} />
        </marker>
        <marker
          id="hero-arrow-pink"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill={colorVar('--pink')} />
        </marker>
      </defs>
    </svg>
  )
}

/**
 * The real ASCII output's style — the same property values as
 * `fork-fixes-app.tsx`'s `ASCII_WELL_STYLE` (ligature-free `FONTS.mono`
 * stack via the shared `.mono` class, `fontVariantLigatures: 'none'`
 * defensively on top of that), kept as its own copy here rather than an
 * import across two independently-hydrated client apps — the same
 * "own literal" precedent `HeroInstall`'s divider height comment documents.
 * No background/border of its own; it sits inside the output panel's body,
 * which already has both.
 */
const HERO_ASCII_STYLE: CSSProperties = {
  margin: 0,
  overflowX: 'auto',
  whiteSpace: 'pre',
  fontVariantLigatures: 'none',
  fontSize: `${FONT_SIZE.bodySm}px`,
  lineHeight: 1.5,
  color: colorVar('--text-dim'),
  minWidth: 0,
}

export interface HeroOutputPanelProps {
  /** The real `renderMermaidASCII(HERO_MERMAID_SOURCE, ...)` output, pre-rendered to HTML by `index-page.tsx` at build/SSR time — see this file's header comment for why. */
  asciiHtml: string
}

/**
 * The segmented "SVG / ASCII" toggle and its output body. Local `useState`
 * plus plain click handlers — the same shape `nav.tsx`'s
 * `usePackageManagerInstall` already proves safe inside this hydrated app
 * (via `HeroInstall`), not a new interactivity pattern.
 */
export function HeroOutputPanel({ asciiHtml }: HeroOutputPanelProps) {
  const [mode, setMode] = useState<'svg' | 'ascii'>('svg')

  return (
    <div
      className="hero-output-panel"
      style={{
        flex: '1 1 auto',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${colorVar('--border')}`,
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        background: colorVar('--panel'),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${SPACE.md}px ${SPACE.xl}px`,
          background: colorVar('--panel-2'),
          borderBottom: `1px solid ${colorVar('--border')}`,
        }}
      >
        <span
          style={{
            fontSize: `${FONT_SIZE.micro}px`,
            letterSpacing: LETTER_SPACING.eyebrow,
            textTransform: 'uppercase',
            color: colorVar('--text-faint'),
          }}
        >
          Output
        </span>
        <div
          style={{
            display: 'flex',
            gap: '2px',
            background: colorVar('--panel'),
            borderRadius: `${RADIUS.pill}px`,
            padding: '2px',
          }}
        >
          <button
            type="button"
            className={`output-segment${mode === 'svg' ? ' active' : ''}`}
            aria-pressed={mode === 'svg'}
            onClick={() => setMode('svg')}
          >
            SVG
          </button>
          <button
            type="button"
            className={`output-segment${mode === 'ascii' ? ' active' : ''}`}
            aria-pressed={mode === 'ascii'}
            onClick={() => setMode('ascii')}
          >
            ASCII
          </button>
        </div>
      </div>
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SPACE.xl}px`,
        }}
      >
        {mode === 'svg' ? (
          <HeroFlowchartSvg />
        ) : (
          <pre
            className="mono"
            style={HERO_ASCII_STYLE}
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidASCII() + asciiToHtml() output from index-page.tsx's own HERO_MERMAID_SOURCE; never user input
            dangerouslySetInnerHTML={{ __html: asciiHtml }}
          />
        )}
      </div>
    </div>
  )
}
