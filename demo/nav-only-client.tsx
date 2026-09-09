/** @jsxRuntime automatic */
/**
 * Browser entry point for every page whose *only* hydrated content is
 * `<Nav>` (zombie-mermaid#800): `editor.html`, `index.html`,
 * `fork-fixes.html`, every `blog/*.html`, and every `diagrams/*.html`.
 * `dashboard.html` does not bundle this file — it already has its own
 * entry (`demo/dashboard-client.tsx`), which imports and calls
 * {@link hydrateNav} directly instead, so it ships one bundle rather than
 * two.
 *
 * Bundled by `demo/build-nav-client.ts`'s `bundleNavClient()`, called from
 * each of those five generators the same way `build-theme-bar-client.ts`'s
 * `bundleThemeBarClient()` already is.
 */
import { hydrateNav } from './nav-client.tsx'

hydrateNav()
