---
---

No release: refines the pillar-fact bullet icons and "Why This Fork
Exists" card headers shipped in #883/#897 — icon-beside-heading spacing
now uses the `SPACE` token instead of a literal pixel value, the pillar
fact icon grew from 20px to 28px with a `flex-shrink: 0` wrapper so it
can never be squeezed by long copy, and `DualOutputIcon`/`ZeroDomIcon`/
`SyncRenderIcon` gained a filled detail (the same `currentColor` idiom
`ThemesIcon`/`MonoModeIcon` already use) so their line weight matches
the rest of the feature-grid set once several sit side by side.

Nothing here touches the published `zombie-mermaid` package.
