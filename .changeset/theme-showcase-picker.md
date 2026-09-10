---
---

No release: reinstates a click-to-pick theme selector
(`ThemeShowcasePicker`) on the homepage's theme showcase section, on top
of the ambient 6-diagram auto-cycle #759 shipped — see
`demo/components/index-page.tsx`'s `ThemeShowcase`/`ThemeShowcasePicker`
doc comments for how the two reconcile. Also updates that section's
headline/copy and adds a footnote linking to `docs/theming.md`. Only
touches `demo/**` (the site generator) and its own test coverage
(`__tests__/site-equivalence.test.ts`) — nothing here touches the
published `zombie-mermaid` package or any `packages/*` package.
