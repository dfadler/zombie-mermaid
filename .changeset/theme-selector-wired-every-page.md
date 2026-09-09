---
---

No release: wires the global theme selector (#684) onto every page —
Home, the Diagrams hub, Blog, Fork Fixes, and Dashboard — via a new shared
`ThemePickerSection` component and `demo/theme-bar-only-client.ts` bundle
entry, both routed through the shared `demo/theme-state.ts` module (#685)
and `demo/components/theme-bar-client.ts` controller (#686). Also
reconciles `demo/diagram-page-client.ts` (the per-diagram-type SEO pages'
client script) off its own duplicate pill-click/dropdown/`localStorage`
handling onto those same shared modules, so a theme picked on any page now
persists and is honored on every other page. Addresses #687. Nothing here
touches the published `zombie-mermaid` package — this is demo-site UI only.
