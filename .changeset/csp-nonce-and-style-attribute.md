---
'zombie-mermaid': minor
---

Strict Content-Security-Policy support (#216). Two new `RenderOptions` plus a helper let a host whose `style-src` has no `'unsafe-inline'` render diagrams with their colours intact:

- `nonce` — stamped as `nonce="…"` (attribute-escaped) on every `<style>` element the render emits, across all diagram types, including the flowchart edge-animation `@keyframes` block and the xychart rules block.
- `styleAttribute: false` — omits the root `<svg style="--bg: …; --fg: …">` attribute, which a nonce can never authorise (nonces apply to elements, not attributes). The host then defines the same custom properties on the SVG or an ancestor from its own stylesheet.
- `themeCssVariables(options)` — returns the exact declaration list that attribute would have carried (`--bg:…;--fg:…;background:var(--bg)`), built by the same function, so the host's rule can't drift from the render.

Output is byte-identical to before when neither option is set.
