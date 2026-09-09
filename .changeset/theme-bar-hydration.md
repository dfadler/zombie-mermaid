---
---

No release: hydrates the global `ThemeBar`/`ThemePicker` (zombie-mermaid#801)
— `demo/components/theme-picker.tsx`'s `ThemePicker` is now a real stateful
React component (`useState`/`useEffect`) instead of static markup wired up
after the fact by the deleted `demo/components/theme-bar-client.ts`'s
`initThemeBar()`. Pill selection, the "More" dropdown (with the #281
`aria-expanded`/`aria-haspopup` sync fix preserved), and keyboard support
(`Escape`/arrows/`Home`/`End`) all live in the component now, driven by
`theme-state.ts`. `demo/components/theme-picker-island.tsx`'s
`ThemePickerIsland` (mirroring #800's `NavIsland`) produces the hydratable
markup, and `demo/theme-bar-client.tsx`'s `hydrateThemeBar()` (mirroring
`hydrateNav()`) hydrates it — reused by every one of the six page types
that already mounted a theme picker (the Diagrams hub, per-diagram-type SEO
pages, Blog, Fork Fixes, Dashboard, and the homepage's theme showcase).
`demo/diagram-page-client.ts`'s `activeThemeKey()` reads `theme-state.ts`'s
`getTheme()` directly now instead of the DOM's `.theme-pill.active` class,
since that class only reflects the visitor's stored preference after the
hydrated component's own post-mount effect runs — a DOM read executed
synchronously right after hydration would otherwise observe the stale
server-rendered default. Nothing here touches the published
`zombie-mermaid` package.
