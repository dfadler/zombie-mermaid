/**
 * Shared "edge scroll-fade" affordance for a horizontally-scrollable panel —
 * extracted (zombie-mermaid#1051, filed from
 * <https://github.com/dfadler/zombie-mermaid/pull/1043#discussion_r3998111334>)
 * from three near-identical copies that grew independently as the fade
 * pattern spread: `hero-output-panel.tsx`'s `useHorizontalScrollFade`/
 * `codeFadeMask` (#1031, the original), `diagram-detail-app.tsx`'s
 * `useAsciiScrollFade`/`asciiFadeMask` (added for the diagram output panel's
 * ASCII view, commit 86682f1), and `fork-fixes-app.tsx`'s
 * `useScrollFadeVisibility` (predates both, #802). All three tracked the
 * exact same thing — which edge(s) of a scrollable element still have more
 * content past them — with the same 1px-slop scroll/resize listener; only
 * the *rendering* of that state differed (see {@link scrollFadeMask}'s doc
 * comment for why that half stays a separate, optional export rather than
 * being folded into this hook).
 */
import { useEffect, useState, type RefObject } from 'react'

/**
 * Tracks which edge(s) of a scrollable element still have more content
 * scrolled out of view: `right` is true while there's more content to
 * scroll *into* (including at rest, whenever the element overflows at all),
 * `left` once scrolled away from the start. An element that doesn't
 * overflow shows neither. Both start `false` to match a pre-hydration SSR
 * render (no layout to measure yet), then the effect fills them in once
 * mounted and keeps them current on scroll/resize.
 *
 * `enabled` (default `true`) lets a caller gate tracking off entirely —
 * `diagram-detail-app.tsx`'s `DetailOutputPanel` needs this for its SVG
 * state (no fade there) and its fullscreen pan/zoom viewport (which moves
 * content via `transform`, not native scroll, so there's nothing to
 * measure); a caller that's always relevant (`HeroCodePanel`, `AsciiWell`)
 * just omits it.
 */
export function useScrollFade<T extends Element>(
  ref: RefObject<T | null>,
  enabled = true,
): {
  left: boolean
  right: boolean
} {
  const [left, setLeft] = useState(false)
  const [right, setRight] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) {
      setLeft(false)
      setRight(false)
      return
    }

    // 1px slop absorbs sub-pixel scrollLeft/scrollWidth rounding at a true
    // edge, which would otherwise flicker the fade on/off spuriously.
    function update() {
      if (!el) return
      setLeft(el.scrollLeft > 1)
      setRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [ref, enabled])

  return { left, right }
}

/** Default width, in px, of {@link scrollFadeMask}'s fade at each edge — the value every existing mask-based caller (`hero-output-panel.tsx`'s `HeroCodePanel`, `diagram-detail-app.tsx`'s `DetailOutputPanel`) already used before this extraction. */
export const DEFAULT_SCROLL_FADE_WIDTH = 32

/**
 * Builds the `mask-image`/`-webkit-mask-image` value that fades a scrollable
 * element's rendered pixels to real transparency at whichever edge(s)
 * {@link useScrollFade} reports as still having more content past them —
 * see <https://stackoverflow.com/q/9525215> for the technique. `undefined`
 * (no mask at all) when neither edge needs one, matching
 * {@link useScrollFade}'s "content that doesn't overflow shows no fade"
 * behavior — callers apply this to both `WebkitMaskImage` and `maskImage`
 * so `undefined` clears any previously-set mask, same as the property being
 * unset.
 *
 * Not every caller of {@link useScrollFade} wants this rendering: this is
 * the mask-based approach `hero-output-panel.tsx`/`diagram-detail-app.tsx`
 * use; `fork-fixes-app.tsx`'s `AsciiWell` instead paints an absolutely
 * positioned overlay `<div>` per edge (its own `AsciiWellFade`), a
 * deliberate difference — that well's content is already dim `--text-dim`
 * text, and a mask (which only affects opacity, painted *behind* nothing)
 * read as barely-there there, where a solid overlay painted *over* the
 * content is visibly a fade. `index-page.tsx`'s `.theme-showcase-ascii-fade`
 * is a third rendering again (a plain CSS class toggled by vanilla JS, since
 * that section never hydrates via React — see `index-page-client.ts`'s
 * `updateAsciiFade`) for the same reason `AsciiWellFade` chose an overlay.
 * Only the two mask-based callers share this function; the other two share
 * {@link useScrollFade}'s tracking logic but keep their own, differently
 * motivated rendering.
 *
 * Two earlier approaches to this rendering were tried and dropped (kept
 * here since both mask-based callers used to duplicate this reasoning):
 *
 * 1. A painted overlay `<div>` fading `transparent` to an opaque color —
 *    `transparent` is `rgba(0,0,0,0)`, transparent *black*, and gradients
 *    interpolate each rgba channel independently rather than premultiplied,
 *    so fading it into an opaque *white* background middled out through a
 *    visibly muddy gray/black band. Swapping in `rgba(255,255,255,0)` as the
 *    transparent stop fixed that, but still required the overlay's opaque
 *    end-color to exactly match whatever's beneath it — a mask fades to
 *    *actual* transparency instead, needing no matching color at all, on
 *    any background.
 * 2. That overlay rendered as a child of the scrollable element itself — an
 *    absolutely positioned child of the *same* element that scrolls is
 *    positioned within that element's own scrolled coordinate space, so a
 *    plain `right: 0` drifted left with `scrollLeft` instead of staying
 *    pinned to the visible edge. A mask applied directly to the scrollable
 *    element sidesteps this too: like a `background-image` without
 *    `background-attachment: local`, a mask is positioned/sized relative to
 *    the masked element's own border box, not the scrolled content inside
 *    it, so it stays pinned to the true visible edges without needing a
 *    separate non-scrolling wrapper element at all.
 */
export function scrollFadeMask(
  left: boolean,
  right: boolean,
  width: number = DEFAULT_SCROLL_FADE_WIDTH,
): string | undefined {
  if (!left && !right) return undefined
  const stops = [
    left ? 'transparent 0' : 'black 0',
    ...(left ? [`black ${width}px`] : []),
    ...(right ? [`black calc(100% - ${width}px)`] : []),
    right ? 'transparent 100%' : 'black 100%',
  ]
  return `linear-gradient(to right, ${stops.join(', ')})`
}
