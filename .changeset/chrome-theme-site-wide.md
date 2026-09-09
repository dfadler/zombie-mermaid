---
---

No release: makes the global theme selector (#684/#687) re-theme the site
chrome — Nav, Footer, cards — not just rendered diagrams, restoring the
pre-#590-redesign behavior where picking a theme reskinned the whole page.
Adds `demo/components/chrome-theme.ts` (derives `tokens.tsx`'s eight
surface/ink tokens from a theme's `bg`/`fg` via `color-mix()`, the same
technique `packages/core/src/theme.ts` already uses for SVG colors) and
`demo/chrome-theme-client.ts` (applies/removes them as inline overrides on
`document.documentElement`, so "Default" restores the exact original look).
Wired into `demo/theme-bar-only-client.ts` (Home, the Diagrams hub, Blog,
Fork Fixes, Dashboard) and `demo/diagram-page-client.ts` (per-diagram-type
pages). The six named accent tokens (`--blue`/`--violet`/`--cyan`/`--pink`/
`--amber`/`--green`) stay fixed on purpose — each is a per-diagram-type
identity, not a theme mood. Addresses #772. Nothing here touches the
published `zombie-mermaid` package — this is demo-site UI only.
