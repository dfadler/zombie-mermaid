/** @jsxRuntime automatic */
/**
 * The home page's feature grid and feature-pillars icons — split out of the
 * original `icons.tsx` (#934) as one family of the icon set (#596, part of
 * the #591 component library and the #590 site redesign).
 *
 * Every path below was lifted verbatim from the design canvas linked in
 * #590's body (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * read through the same route tokens.tsx used — see `icons/index.ts`'s
 * module doc comment for the full canvas-provenance note that used to open
 * this file before the split.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */

import { type IconProps, StrokeIcon } from './base.tsx'

/**
 * Dual output (SVG and ASCII) — two panes over a shared base.
 *
 * CANVAS: Main.dc.html, feature grid, "Dual output", `--blue` at 28px.
 * Deliberately taller and the right pane filled (`currentColor`, the same
 * idiom {@link ThemesIcon} explains) versus the canvas original: at outline
 * scale this pair of short rects reads much lighter than the set's other
 * icons once several sit side by side (the home page's feature-pillars
 * redesign, #895) — the extra height and the filled pane give it the same
 * visual weight without changing the silhouette's basic shape.
 */
export function DualOutputIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--blue">
      <rect x="2" y="3" width="9" height="10" rx="1.5" />
      <rect x="13" y="3" width="9" height="10" rx="1.5" fill="currentColor" />
      <path d="M6.5 13v2a2.5 2.5 0 0 0 2.5 2.5h6a2.5 2.5 0 0 0 2.5-2.5v-2" />
    </StrokeIcon>
  )
}

/**
 * Themes — a painter's palette with three wells.
 *
 * CANVAS: Main.dc.html, feature grid, "15 built-in themes", `--violet` at
 * 28px (and the same drawing at 26px on Editor.dc.html's feature cards).
 * The canvas fills the three wells with the icon's own accent
 * (`fill="var(--violet)"`); `currentColor` here is the canvas's own idiom
 * for the same drawing when it takes its colour from context —
 * TerminalNative.dc.html's copy of this icon writes it that way.
 */
export function ThemesIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--violet">
      <path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h2.3c1.7 0 3.2-1.4 3.2-3.1C20.5 6.6 16.7 2 12 2Z" />
      <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
    </StrokeIcon>
  )
}

/**
 * Shiki compatibility — a pair of code chevrons.
 *
 * CANVAS: Main.dc.html, feature grid, "Full Shiki compatibility", `--cyan`
 * at 28px.
 */
export function ShikiIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      <polyline points="9 6 3 12 9 18" />
      <polyline points="15 6 21 12 15 18" />
    </StrokeIcon>
  )
}

/**
 * Mono mode — a circle filled on one half, the two-colour idea in one mark.
 *
 * CANVAS: Main.dc.html, feature grid, "Mono mode", `--amber` at 28px. The
 * canvas fills the half with the icon's own accent; see {@link ThemesIcon}
 * on why that becomes `currentColor` here.
 */
export function MonoModeIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </StrokeIcon>
  )
}

/**
 * Zero DOM dependencies — a self-contained package solid.
 *
 * CANVAS: Main.dc.html, feature grid, "Zero DOM dependencies", `--pink` at
 * 28px. The top face is filled (`currentColor`, the same idiom
 * {@link ThemesIcon} explains) on top of the canvas's plain outline — a
 * pure hexagon outline reads much lighter than the set's filled icons once
 * several sit side by side (the home page's feature-pillars redesign,
 * #895); the fill adds the same visual weight without changing the
 * silhouette.
 */
export function ZeroDomIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--pink">
      <path d="M12 2 3 7l9 5 9-5Z" fill="currentColor" stroke="none" />
      <path d="M12 2 3 7v10l9 5 9-5V7Z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </StrokeIcon>
  )
}

/**
 * Synchronous rendering — a lightning bolt.
 *
 * CANVAS: Main.dc.html, feature grid, "Synchronous rendering", `--green` at
 * 28px. Blog.dc.html reuses the drawing at 26px for "Why we forked
 * beautiful-mermaid" (`--violet`), and Editor.dc.html for "Live, debounced
 * rendering" (`--blue`) — pass `color` for those. Filled (`currentColor`,
 * the same idiom {@link ThemesIcon} explains) rather than the canvas's
 * plain outline: a hollow bolt reads much lighter than the set's filled
 * icons once several sit side by side (the home page's feature-pillars
 * redesign, #895); the fill adds the same visual weight without changing
 * the silhouette, in every context this icon is reused.
 */
export function SyncRenderIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--green">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" />
    </StrokeIcon>
  )
}

/**
 * Speed — a stopwatch, for the "Ultra-fast" pillar on the home page's
 * feature-pillars section.
 *
 * New for that redesign, not part of the original design canvas.
 */
export function SpeedIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--violet">
      <path d="M9 2h6" />
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" />
    </StrokeIcon>
  )
}

/**
 * Accessibility — a shield with a checkmark, for the "CI-enforced
 * accessibility" pillar on the home page's feature-pillars section.
 *
 * New for that redesign, not part of the original design canvas.
 */
export function AccessibilityIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6Z" />
      <path d="M9 12l2 2 4-4" />
    </StrokeIcon>
  )
}

/**
 * Merge edges — two branches joining a shared trunk, for the `mergeEdges`
 * card in the home page's "Why This Fork Exists" section.
 *
 * New for that redesign, not part of the original design canvas.
 */
export function MergeEdgesIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--green">
      <path d="M6 4v6a4 4 0 0 0 4 4h4" />
      <path d="M18 4v6a4 4 0 0 0-4 4v4" />
      <circle cx="6" cy="4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="4" r="1.5" fill="currentColor" stroke="none" />
    </StrokeIcon>
  )
}
