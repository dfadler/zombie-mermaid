/** @jsxRuntime automatic */
/**
 * Hydration entry point for every blog/<slug>.html page (blog.ts) —
 * zombie-mermaid#803, applying the #799/#800 hydration pattern
 * (`dashboard-client.tsx`) to the post template. `blog.ts` bundles this
 * file once via `scripts/vite-bundle.ts`'s `bundleForBrowser` and inlines
 * the *same* built script into every post page's `<script type="module">`
 * — one bundle build, reused across every post, the same way
 * `bundleNavClient()`'s output used to be reused before this issue.
 *
 * Imports {@link BlogPostApp} from `./components/blog-app.tsx`, *not*
 * `./components/blog-page.tsx` — that second file imports `react-dom/
 * server` for its own SSR-only purposes, and importing from it here would
 * drag that whole dependency into this browser bundle for no reason; see
 * `blog-app.tsx`'s header comment.
 *
 * The pattern, unchanged from `dashboard-client.tsx`: read the server-
 * embedded {@link BlogPostAppProps} back out of the DOM
 * ({@link BLOG_POST_PROPS_ELEMENT_ID}), then `hydrateRoot()` the same
 * component ({@link BlogPostApp}) against the same DOM node the server
 * rendered it into ({@link BLOG_POST_ROOT_ID}).
 *
 * `<NavIsland>` hydrates here too, via {@link hydrateNav}, in the same
 * bundle rather than a separate `nav-only-client.tsx` bundle — see
 * `fork-fixes-client.tsx`'s identical header comment for why.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  BlogPostApp,
  BLOG_POST_PROPS_ELEMENT_ID,
  BLOG_POST_ROOT_ID,
  type BlogPostAppProps,
} from './components/blog-app.tsx'
import { hydrateNav } from './nav-client.tsx'

function readProps(): BlogPostAppProps {
  const propsEl = document.getElementById(BLOG_POST_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `blog-post-client: no #${BLOG_POST_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as BlogPostAppProps
}

function main(): void {
  const container = document.getElementById(BLOG_POST_ROOT_ID)
  if (!container) {
    throw new Error(
      `blog-post-client: no #${BLOG_POST_ROOT_ID} element found to hydrate`,
    )
  }
  const props = readProps()
  hydrateRoot(container, createElement(BlogPostApp, props))
  hydrateNav()
}

main()
