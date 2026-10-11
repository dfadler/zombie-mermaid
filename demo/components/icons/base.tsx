/** @jsxRuntime automatic */
/**
 * The shared stroke style and the one `<svg>` wrapper every icon in the set
 * renders through — split out of the original `icons.tsx` (#934) as the leaf
 * module every other file under `demo/components/icons/` depends on.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */

import type { ReactNode } from 'react'

import { type ColorToken, colorVar } from '../tokens.tsx'

/**
 * Every icon draws in a 24×24 user-space box, whatever it renders at.
 *
 * The canvas is unanimous on this: all 49 distinct icons across all eighteen
 * artboards use `viewBox="0 0 24 24"`, and vary only the `width`/`height`
 * they present it at (12px through 34px).
 */
export const ICON_VIEW_BOX = '0 0 24 24'

/**
 * The stroke width the whole set draws at.
 *
 * 1.8 is the canonical artboards' value for a *drawn* icon — every one of the
 * six feature-grid icons, both 34px teaser icons, and the editor's four
 * feature-card icons use it. The canvas then optically compensates smaller
 * instances of its incidental chrome (2 at 13–16px, 2.4–2.6 at 12–14px)
 * rather than treating stroke width as a set-wide constant. This module does
 * treat it as one — a single value is what makes the set read as one family
 * — and exposes {@link IconProps.strokeWidth} for a caller that needs the
 * canvas's optical bump back at a small size.
 */
export const ICON_STROKE_WIDTH = 1.8

/** `stroke-linecap`/`stroke-linejoin` — round on every stroke icon in the canvas. */
export const ICON_LINE_CAP = 'round'

/** The size, in px, an icon renders at when the caller doesn't say. */
export const ICON_DEFAULT_SIZE = 24

/** The props every icon in this module accepts. */
export interface IconProps {
  /**
   * Rendered width and height in px. Defaults to
   * {@link ICON_DEFAULT_SIZE}; the drawing scales, the stroke does not
   * thin (SVG strokes scale with the viewBox, so a 12px render of a 1.8
   * stroke is proportionally the same weight as a 34px one).
   */
  size?: number
  /**
   * Stroke colour. Defaults to the accent the canvas assigns this icon —
   * see each component's `CANVAS` note — expressed through tokens.tsx's
   * {@link colorVar}, so it resolves against the `:root` block
   * `designTokensCss()` publishes. Pass `'currentColor'` to inherit from
   * the surrounding text instead.
   */
  color?: string
  /**
   * Stroke width. Defaults to {@link ICON_STROKE_WIDTH}; override only to
   * restore the canvas's optical compensation at a small render size.
   */
  strokeWidth?: number
  /** Class on the `<svg>`, for layout or an animation hook (#597). */
  className?: string
  /**
   * Accessible name. Given one, the icon becomes `role="img"` with a
   * `<title>`; without one it is `aria-hidden` — the right default, since
   * most of these sit beside a text label that already names them.
   */
  title?: string
}

/** An icon's own props plus the paths it draws — the base component's input. */
interface StrokeIconProps extends IconProps {
  /** The colour token the canvas uses for this icon. */
  defaultColor: ColorToken | 'currentColor'
  /** The icon's paths, in canvas order. */
  children: ReactNode
}

/**
 * The one `<svg>` wrapper every icon renders through.
 *
 * Centralising the open tag is what actually enforces the set's consistency:
 * an individual icon supplies only its paths and its canvas accent, and
 * cannot drift the viewBox, the stroke joins, or the fill rule.
 */
export function StrokeIcon({
  size = ICON_DEFAULT_SIZE,
  color,
  strokeWidth = ICON_STROKE_WIDTH,
  className,
  title,
  defaultColor,
  children,
}: StrokeIconProps) {
  const stroke =
    color ??
    (defaultColor === 'currentColor' ? 'currentColor' : colorVar(defaultColor))
  return (
    <svg
      width={size}
      height={size}
      viewBox={ICON_VIEW_BOX}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={ICON_LINE_CAP}
      strokeLinejoin={ICON_LINE_CAP}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}
