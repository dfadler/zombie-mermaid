---
---

Removes the "Pick a look" theme-picker section (`ThemePickerSection`) from
every page that rendered it — the per-diagram-type detail pages, the Blog
index, Fork Fixes, and Dashboard. This reverses the site-wide restoration
closed out by `.changeset/theme-selector-dead-code-docs.md` (#690, part of
the #684 epic).

Deleted the now-fully-dead `demo/components/theme-picker-section.tsx`,
`demo/theme-bar-only-client.ts`, and `demo/build-theme-bar-client.ts`, and
the `themeBarScript`/`themePickerCss()` plumbing that fed them in
`fork-fixes.ts`, `dashboard.ts`, and `blog.ts`. Left `demo/components/
theme-picker.tsx`, `demo/chrome-theme-client.ts`, and `demo/chrome-theme-
data.ts` untouched — all three are still used independently, by the
homepage's separate "Pick a theme. Watch it flow." showcase and/or the
editor page's own theme dropdown. Updated `docs/guides/theming.md`'s "Try
the built-in themes" section accordingly. Nothing here touches the
published `zombie-mermaid` package — demo-site only.
