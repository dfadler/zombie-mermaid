---
---

No release: fixes the Editor page's nav/hero/breadcrumb not picking up a
visitor's stored theme preference, unlike every other page. #772's
site-chrome re-theming (`demo/chrome-theme-client.ts`'s `initChromeTheme()`)
was wired into `demo/theme-bar-only-client.ts` (Home, the Diagrams hub,
Blog, Fork Fixes, Dashboard) and `demo/diagram-page-client.ts`
(per-diagram-type pages), but never into `editor.ts` — so after picking a
theme elsewhere on the site, the Editor's own chrome stayed on the default
dark palette while its preview pane (which already shares the same
`mermaid-theme` state via `demo/editor-theme-state-bridge.ts`) and every
other page's chrome correctly re-themed, a visible inconsistency between
pages.

`editor.ts` now embeds `window.__themeColors` directly (every other page
gets it for free from `ThemePickerSection`, which the Editor has no
equivalent of) and `demo/editor-client.tsx` now calls `initChromeTheme()`
alongside its existing `hydrateNav()` call.

Also extends `initChromeTheme()` itself: `editor-page.tsx` scopes its whole
design-token palette to a `.zm-shell` class rule instead of `:root` (its own
tool already owns `--bg`/`--border`/`--green` for light/dark mode), and a
rule declared directly on `.zm-shell` shadows anything inherited from
`document.documentElement` — so a root-only override, sufficient on every
other page, was invisible there. `initChromeTheme()` now also applies the
same inline overrides to every `.zm-shell` element present, a no-op
everywhere that class doesn't exist.

Nothing here touches the published `zombie-mermaid` package — this is
demo-site UI only.
