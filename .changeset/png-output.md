---
'zombie-mermaid': minor
---

Add `--png` to the CLI's `render` command: rasterizes to PNG at the SVG's own pixel dimensions (1:1, no scaling) via the optional `@resvg/resvg-js` native dependency, loaded lazily so a normal install/build never pays for it unless `--png` is actually used. Colors are always resolved first (as `--resolve-colors` does for `--svg`), since a rasterizer can't evaluate CSS `var()`/`color-mix()` — skipping that would render the whole theme black. If the optional dependency isn't installed (skipped build, `--no-optional`), `--png` fails with a clear, actionable error instead of a raw stack trace. Refs #456.
