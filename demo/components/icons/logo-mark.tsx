/** @jsxRuntime automatic */
/**
 * The zombie-mermaid brand mark — split out of the original `icons.tsx`
 * (#934). Kept separate from the icon families in this directory because it
 * is a three-colour logotype rather than a single-stroke icon; see
 * {@link LogoMark}'s own doc comment for why it doesn't join {@link ICONS}
 * (registry.ts).
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */

import type { IconProps } from './base.tsx'
import { ICON_VIEW_BOX } from './base.tsx'
import { colorVar } from '../tokens.tsx'

/**
 * The stroke width the wordmark's glyph draws at — 1.6, not
 * `ICON_STROKE_WIDTH`. See {@link LogoMark}.
 */
export const LOGO_STROKE_WIDTH = 1.6

/**
 * The zombie-mermaid mark: two rounded squares over a bracket.
 *
 * CANVAS: every canonical artboard's nav (30px) and footer (22px).
 *
 * Deliberately not part of `ICONS` (registry.ts). It is a three-colour
 * logotype rather than a single-stroke icon — the canvas strokes each of
 * its three elements in a different accent (`--cyan`, `--violet`, `--pink`)
 * and draws it at 1.6 with butt caps — so it satisfies neither the
 * one-colour nor the one-stroke-width rule the rest of the set is built on,
 * and folding it in would mean loosening both. It takes
 * `size`/`className`/`title` but no `color`: recolouring a logotype is not
 * a thing a caller should do.
 */
export function LogoMark({
  size = 30,
  className,
  title,
}: Pick<IconProps, 'size' | 'className' | 'title'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={ICON_VIEW_BOX}
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <rect
        x="2"
        y="2"
        width="9"
        height="9"
        rx="3"
        stroke={colorVar('--cyan')}
        strokeWidth={LOGO_STROKE_WIDTH}
      />
      <rect
        x="13"
        y="2"
        width="9"
        height="9"
        rx="3"
        stroke={colorVar('--violet')}
        strokeWidth={LOGO_STROKE_WIDTH}
      />
      <path
        d="M6.5 11 V16 a2 2 0 0 0 2 2 h7 a2 2 0 0 0 2-2 v-5"
        stroke={colorVar('--pink')}
        strokeWidth={LOGO_STROKE_WIDTH}
        fill="none"
      />
    </svg>
  )
}
