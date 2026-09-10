/** @jsxRuntime automatic */
/**
 * The hand-drawn "code → diagram" mock, extracted to `public/hero-visual.svg`
 * (zombie-mermaid#920) rather than living here as inline JSX — this file
 * used to embed every `<rect>`/`<text>`/`<path>` shape directly, which made
 * both this component and the near-duplicate composite in
 * `scripts/generate-hero.ts` unusually long for what is, on the page, one
 * static image.
 *
 * `public/hero-visual.svg` is fully self-contained (its own `:root` colour
 * variables, `.mono` font-family, and `.edge-anim` marching-ants animation,
 * restated in its own `<style>` — see that file's header comment) so it
 * renders identically whether loaded here via `<img>` or embedded in the
 * README, which is why `scripts/generate-hero.ts` now reads it directly as
 * hero.svg's single source of truth instead of rendering this component.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
export function HeroVisual() {
  return (
    <img
      src="hero-visual.svg"
      width="100%"
      style={{ display: 'block' }}
      alt="Raw Mermaid source rendering into a themed, animated diagram, drawn by zombie-mermaid itself"
    />
  )
}
