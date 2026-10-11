/** @jsxRuntime automatic */
/**
 * The editor toolbar's chrome icons — split out of the original `icons.tsx`
 * (#934) as one family of the icon set (#596).
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */

import { type IconProps, StrokeIcon } from './base.tsx'

/**
 * Zoom in — a magnifier with a plus.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Zoom in"`, `--text-dim` at
 * 16px.
 */
export function ZoomInIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--text-dim">
      <circle cx="10" cy="10" r="7" />
      <line x1="21" y1="21" x2="15.5" y2="15.5" />
      <line x1="10" y1="7" x2="10" y2="13" />
      <line x1="7" y1="10" x2="13" y2="10" />
    </StrokeIcon>
  )
}

/**
 * Zoom out — the same magnifier, minus the vertical stroke.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Zoom out"`, `--text-dim` at
 * 16px.
 */
export function ZoomOutIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--text-dim">
      <circle cx="10" cy="10" r="7" />
      <line x1="21" y1="21" x2="15.5" y2="15.5" />
      <line x1="7" y1="10" x2="13" y2="10" />
    </StrokeIcon>
  )
}

/**
 * Fit to view — four corner brackets.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Fit to view"`, `--text-dim`
 * at 16px. This is the canvas's third viewport control; there is no pan
 * icon anywhere in the canvas, so none is offered here.
 */
export function FitToViewIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--text-dim">
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
      <path d="M4 15v4a1 1 0 0 0 1 1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    </StrokeIcon>
  )
}

/**
 * Share — two chain links, for the URL-hash share link.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Copy share link"`, `--cyan`
 * at 16px; the same drawing at 26px on the "Shareable via URL" feature card.
 */
export function ShareIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.5 19.5" />
    </StrokeIcon>
  )
}

/**
 * Download — an arrow onto a baseline.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Download SVG"`, `--amber` at
 * 16px; the same drawing at 26px on the "One-click SVG export" feature card.
 */
export function DownloadIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </StrokeIcon>
  )
}
