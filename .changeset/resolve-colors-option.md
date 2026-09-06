---
'zombie-mermaid': minor
---

Add `resolveColors` to `RenderOptions` (and `--resolve-colors` to the CLI's `render --svg`): replaces every CSS `var(--…)` and `color-mix(…)` in the emitted SVG with its computed sRGB value, using the same mix percentages the `<style>` block declares, so rasterizers and other non-browser SVG consumers (resvg, librsvg, Inkscape) render the theme instead of black. Off by default — the default output stays a live function of its CSS custom properties. Refs #456.
