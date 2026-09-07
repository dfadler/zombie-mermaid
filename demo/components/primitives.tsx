/** @jsxRuntime automatic */
/**
 * The redesign's four visual primitives — Card, Pill, SectionEyebrow, and
 * CTA (#595, part of the #591 component library, part of the #590 redesign).
 *
 * Like tokens.tsx (#592), every rule and every variant here was lifted from
 * the design canvas linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * not invented. The canvas's sixteen "Diagram-Native Showcase" artboards —
 * eight pages, each in a 1440px desktop and a 390px mobile variant — share
 * one `<helmet><style>` preamble, and its `.card`, `.pill`, and
 * `.section-eyebrow` rules are byte-identical across all sixteen. Those
 * three rules are reproduced verbatim in {@link primitivesCss}; the variants
 * below are the inline-style overrides the artboards actually spell out at
 * their usage sites.
 *
 * That base-class-plus-inline-override split is the canvas's own authoring
 * shape, so the components keep it: each renders the canvas class name and
 * layers only the variant's declarations inline. A page therefore emits
 * `primitivesCss()` once (alongside tokens.tsx's `designBaseCss()`) and gets
 * markup that matches the artboards element for element.
 *
 * Nothing on the site consumes these yet — wiring them into the pages is
 * #598-610's job. Colours, radii, spacing, and type all come from tokens.tsx
 * rather than being retyped, so the palette has exactly one definition.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SPACE,
  colorVar,
  type ColorToken,
} from './tokens.tsx'

/* -----------------------------------------------------------------
 * Accents
 * ----------------------------------------------------------------- */

/**
 * The six accents by bare name, in the canvas's own cycling order.
 *
 * tokens.tsx's `ACCENTS` holds the same six as CSS custom-property names
 * (`'--blue'`); these are the prop-friendly spelling (`'blue'`), and
 * {@link accentToken} maps one to the other. The test file pins the two
 * lists to each other so they cannot drift apart.
 */
export const ACCENT_NAMES = [
  'blue',
  'violet',
  'cyan',
  'pink',
  'amber',
  'green',
] as const

/** One of the six accents a primitive can be tinted with. */
export type Accent = (typeof ACCENT_NAMES)[number]

/** The {@link ColorToken} an accent name refers to, e.g. `'blue'` → `'--blue'`. */
export function accentToken(accent: Accent): ColorToken {
  return `--${accent}`
}

/** `var(--blue)` for an accent name. */
export function accentVar(accent: Accent): string {
  return colorVar(accentToken(accent))
}

/**
 * An accent as `rgba(r, g, b, alpha)`, for the translucent washes the canvas
 * paints behind tinted pills and glowing cards.
 *
 * The artboards spell these out as literals — `rgba(77,141,255,0.14)` for
 * blue, `rgba(163,116,232,0.16)` for violet, and so on — each of which is
 * that accent's hex from tokens.tsx converted to decimal. Deriving them from
 * {@link COLORS} instead of copying the literals keeps one definition of the
 * palette; the test file checks the derivation reproduces the canvas's
 * strings exactly.
 */
export function accentRgba(accent: Accent, alpha: number): string {
  const hex = COLORS[accentToken(accent)]
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Ink for text sitting on a solid accent fill.
 *
 * The canvas's solid pills nearly all set `color:#0a0d16` — the page
 * background, `--bg` — so that is the default here. Two sites in the
 * "rescued" strip darken the ink into the accent's own hue instead
 * (`#241703` on amber, `#04140b` on green); a page reproducing that strip
 * passes the value through `style` rather than this being a seventh token.
 */
const SOLID_INK = colorVar('--bg')

/**
 * A pill's horizontal padding in px.
 *
 * The canvas declares `padding: 12px 22px`. The 12 is tokens.tsx's
 * `SPACE.md`; 22 is not on that scale — no other measurement in the
 * artboards uses it — so it stays a literal here rather than becoming a
 * spacing step nothing else would reference.
 */
const PILL_PADDING_X = 22

/* -----------------------------------------------------------------
 * Base CSS
 * ----------------------------------------------------------------- */

/**
 * The `.card`, `.pill`, `.section-eyebrow`, and `.mono` rules, transcribed
 * from the sixteen showcase artboards' shared style preamble.
 *
 * The values are written through the tokens module rather than retyped, but
 * they resolve to exactly what the canvas declares: a 20px-radius panel with
 * a hairline border, a fully-rounded 12px/22px inline-flex pill at 15px/600,
 * and an uppercase 13px/700 cyan eyebrow tracked out to 0.14em.
 *
 * Emit this once per page, after tokens.tsx's `designBaseCss()` — the rules
 * reference the custom properties that block defines.
 */
export function primitivesCss(): string {
  return `.card {
  background: ${colorVar('--panel')};
  border: 1px solid ${colorVar('--border')};
  border-radius: ${RADIUS.card}px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: ${SPACE.sm}px;
  border-radius: ${RADIUS.pill}px;
  padding: ${SPACE.md}px ${PILL_PADDING_X}px;
  font-size: ${FONT_SIZE.bodyLg}px;
  font-weight: ${FONT_WEIGHT.semibold};
}

.section-eyebrow {
  text-transform: uppercase;
  letter-spacing: ${LETTER_SPACING.eyebrow};
  font-size: ${FONT_SIZE.label}px;
  font-weight: ${FONT_WEIGHT.bold};
  color: ${colorVar('--cyan')};
}

.mono {
  font-family: var(--font-mono);
}`
}

/** {@link primitivesCss} in a `<style>` element, for a page's `<head>`. */
export function PrimitivesStyle() {
  return <style>{primitivesCss()}</style>
}

/** Joins class names, dropping the empty ones. */
function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/* -----------------------------------------------------------------
 * Card
 * ----------------------------------------------------------------- */

/**
 * How a card is filled.
 *
 * - `panel` — the base `.card` fill, `--panel`.
 * - `sunken` — `background:var(--bg)`, the canvas's treatment for a card
 *   holding a code block or a nested panel, so it reads as recessed.
 * - `glow` — a radial wash of the accent fading into `--panel`, which the
 *   artboards put behind every diagram-type icon panel. Needs an `accent`;
 *   without one it renders as `panel`.
 */
export type CardTone = 'panel' | 'sunken' | 'glow'

export interface CardProps {
  /** Tints the border, and colours the wash when `tone` is `glow`. */
  accent?: Accent
  /** Fill treatment. Defaults to the base `.card` panel fill. */
  tone?: CardTone
  /** Interior padding in px — the canvas ranges from 18 to 44. */
  padding?: number
  /**
   * Renders an `<a>` instead of a `<div>`, for the canvas's crosslink
   * cards. Ignored unless set.
   */
  href?: string
  /** Appended to `card`, for a page's own modifier class. */
  className?: string
  /** Merged last, so a page can override any of the above. */
  style?: CSSProperties
  children?: ReactNode
}

/**
 * A rounded panel with a hairline border — the redesign's basic container.
 *
 * ```tsx
 * <Card accent="violet" tone="glow" padding={32}>…</Card>
 * ```
 *
 * renders the canvas's icon-panel treatment: a violet border over a violet
 * wash fading into `--panel` at 68%.
 */
export function Card({
  accent,
  tone = 'panel',
  padding,
  href,
  className,
  style,
  children,
}: CardProps) {
  const cardStyle: CSSProperties = {}
  if (accent) cardStyle.borderColor = accentVar(accent)
  if (tone === 'sunken') cardStyle.background = colorVar('--bg')
  if (tone === 'glow' && accent) {
    cardStyle.background = `radial-gradient(circle at 50% 45%, ${accentRgba(
      accent,
      0.16,
    )} 0%, ${colorVar('--panel')} 68%)`
  }
  if (padding !== undefined) cardStyle.padding = `${padding}px`

  const merged = { ...cardStyle, ...style }
  const classes = classNames('card', className)
  return href === undefined ? (
    <div className={classes} style={merged}>
      {children}
    </div>
  ) : (
    <a className={classes} href={href} style={merged}>
      {children}
    </a>
  )
}

/* -----------------------------------------------------------------
 * Pill
 * ----------------------------------------------------------------- */

/**
 * A pill's fill/border/ink combination. Each is a treatment the showcase
 * artboards actually use:
 *
 * - `solid` — accent fill, `--bg` ink, bumped to 700. The canvas's primary
 *   button and its diagram-type "see examples" links.
 * - `outline` — `--panel` fill, accent border, accent ink. The canvas's
 *   status pills (e.g. a green "all fixes shipped").
 * - `tint` — a 14% accent wash under an accent border and accent ink. The
 *   canvas's uppercase warning badge.
 * - `muted` — `--panel` fill, `--border` border, dimmed ink. The default,
 *   and the only variant that needs no accent.
 */
export type PillVariant = 'solid' | 'outline' | 'tint' | 'muted'

export interface PillProps {
  /** Which accent tints the pill. Required by every variant but `muted`. */
  accent?: Accent
  /** Treatment. Defaults to `muted`, or to `solid` when an accent is given. */
  variant?: PillVariant
  /** Adds `mono`, for the canvas's code-ish pills (`npm install …`). */
  mono?: boolean
  /** Overrides the base 15px. */
  fontSize?: number
  /** Appended to `pill`, for a page's own modifier class. */
  className?: string
  /** Merged last, so a page can override any of the above. */
  style?: CSSProperties
  children?: ReactNode
}

/** Resolves a pill's variant declarations. Shared with {@link CTA}. */
function pillStyle(variant: PillVariant, accent: Accent | undefined) {
  const style: CSSProperties = {}
  if (variant === 'solid' && accent) {
    style.background = accentVar(accent)
    style.color = SOLID_INK
    style.fontWeight = FONT_WEIGHT.bold
  } else if (variant === 'outline' && accent) {
    style.background = colorVar('--panel')
    style.border = `1px solid ${accentVar(accent)}`
    style.color = accentVar(accent)
  } else if (variant === 'tint' && accent) {
    style.background = accentRgba(accent, 0.14)
    style.border = `1px solid ${accentVar(accent)}`
    style.color = accentVar(accent)
  } else {
    style.background = colorVar('--panel')
    style.border = `1px solid ${colorVar('--border')}`
    style.color = colorVar('--text-dim')
  }
  return style
}

/**
 * A fully-rounded tag, badge, or button face.
 *
 * ```tsx
 * <Pill accent="amber" variant="tint" mono fontSize={11}>Upstream bug</Pill>
 * ```
 */
export function Pill({
  accent,
  variant,
  mono = false,
  fontSize,
  className,
  style,
  children,
}: PillProps) {
  const resolved: PillVariant = variant ?? (accent ? 'solid' : 'muted')
  const pill = pillStyle(resolved, accent)
  if (fontSize !== undefined) pill.fontSize = `${fontSize}px`
  return (
    <span
      className={classNames('pill', mono && 'mono', className)}
      style={{ ...pill, ...style }}
    >
      {children}
    </span>
  )
}

/* -----------------------------------------------------------------
 * SectionEyebrow
 * ----------------------------------------------------------------- */

export interface SectionEyebrowProps {
  /**
   * Recolours the label. The base rule is already cyan, so passing `'cyan'`
   * and passing nothing render identically.
   */
  accent?: Accent
  /** Appended to `section-eyebrow`. */
  className?: string
  /** Merged last, so a page can override any of the above. */
  style?: CSSProperties
  children?: ReactNode
}

/**
 * The uppercase, tracked-out label above a section heading.
 *
 * ```tsx
 * <SectionEyebrow accent="blue">Flowchart</SectionEyebrow>
 * ```
 */
export function SectionEyebrow({
  accent,
  className,
  style,
  children,
}: SectionEyebrowProps) {
  const eyebrowStyle: CSSProperties = accent ? { color: accentVar(accent) } : {}
  return (
    <div
      className={classNames('section-eyebrow', className)}
      style={{ ...eyebrowStyle, ...style }}
    >
      {children}
    </div>
  )
}

/* -----------------------------------------------------------------
 * CTA
 * ----------------------------------------------------------------- */

/**
 * A CTA's treatment.
 *
 * - `solid` — accent fill, `--bg` ink. The canvas's primary action.
 * - `ghost` — `--panel` fill under an accent border, accent ink. The
 *   canvas's secondary action.
 */
export type CTAVariant = 'solid' | 'ghost'

export interface CTAProps {
  /** Destination. */
  href: string
  /** Which accent the button is tinted with. Defaults to `violet`, the
   * accent the canvas's hero CTA uses. */
  accent?: Accent
  /** Treatment. Defaults to `solid`. */
  variant?: CTAVariant
  /**
   * Appends the canvas's trailing arrow glyph. On by default, since every
   * CTA in the artboards carries one; pass `false` for a bare label.
   */
  arrow?: boolean
  /** Appended to `pill`. */
  className?: string
  /** Merged last, so a page can override any of the above. */
  style?: CSSProperties
  children?: ReactNode
}

/**
 * The trailing arrow the canvas draws inside every CTA.
 *
 * Stroked with `currentColor` — which the artboards also use elsewhere — so
 * it tracks the button's ink instead of repeating the hex, and so a `style`
 * override of `color` carries the glyph with it.
 */
function CTAArrow() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

/**
 * A call-to-action button — a {@link Pill} rendered as a link, which is
 * exactly what the canvas does (`<a class="pill" …>`).
 *
 * ```tsx
 * <CTA href="#demo" accent="violet">View the live demo</CTA>
 * ```
 *
 * reproduces the home hero's CTA: a violet fill, `--bg` ink at 700, and the
 * trailing arrow.
 */
export function CTA({
  href,
  accent = 'violet',
  variant = 'solid',
  arrow = true,
  className,
  style,
  children,
}: CTAProps) {
  const pill = pillStyle(variant === 'ghost' ? 'outline' : 'solid', accent)
  return (
    <a
      className={classNames('pill', className)}
      href={href}
      style={{ ...pill, ...style }}
    >
      {children}
      {arrow ? <CTAArrow /> : null}
    </a>
  )
}
