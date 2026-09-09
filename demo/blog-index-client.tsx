/** @jsxRuntime automatic */
/**
 * Hydration entry point for blog/index.html (blog.ts) — zombie-mermaid#803,
 * applying the same pattern `blog-post-client.tsx` uses for the post
 * template. `blog.ts` bundles this file via `scripts/vite-bundle.ts`'s
 * `bundleForBrowser` and inlines the result into a `<script
 * type="module">`.
 *
 * Imports {@link BlogIndexApp} from `./components/blog-app.tsx`, *not*
 * `./components/blog-page.tsx` — see `blog-post-client.tsx`'s identical
 * header comment for why.
 *
 * `<NavIsland>` hydrates here too, via {@link hydrateNav}, in the same
 * bundle — see `blog-post-client.tsx`'s header comment for why.
 * `ThemePicker`'s own hydration is unaffected by this issue: it's still
 * `demo/theme-bar-only-client.ts`'s `hydrateThemeBar()`, bundled
 * separately as this page's `themeBarScript`.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  BlogIndexApp,
  BLOG_INDEX_PROPS_ELEMENT_ID,
  BLOG_INDEX_ROOT_ID,
  type BlogIndexAppProps,
} from './components/blog-app.tsx'
import { hydrateNav } from './nav-client.tsx'

function readProps(): BlogIndexAppProps {
  const propsEl = document.getElementById(BLOG_INDEX_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `blog-index-client: no #${BLOG_INDEX_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as BlogIndexAppProps
}

function main(): void {
  const container = document.getElementById(BLOG_INDEX_ROOT_ID)
  if (!container) {
    throw new Error(
      `blog-index-client: no #${BLOG_INDEX_ROOT_ID} element found to hydrate`,
    )
  }
  const props = readProps()
  hydrateRoot(container, createElement(BlogIndexApp, props))
  hydrateNav()
}

main()
