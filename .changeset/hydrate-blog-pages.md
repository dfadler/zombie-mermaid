---
---

No release: hydrates the blog index and post pages (zombie-mermaid#803),
applying the #799/#800/#801/#802 SSR + hydrate pattern to both
`BlogIndexPage` and `BlogPostPage`. `demo/components/blog-page.tsx` is now
a thin shell for both page types — the hydrated content lives in the new
`demo/components/blog-app.tsx`'s `BlogPostApp`/`BlogIndexApp`, hydrated by
two new client entries (`demo/blog-post-client.tsx`/`demo/blog-index-
client.tsx`), each also hydrating `<NavIsland>` in the same bundle
(replacing the shared `nav-only-client.tsx` bundle both page types used
before).

`<NavIsland>`/`<ThemePickerSection>` (index only — a single post has no
theme picker)/`<Footer>` stay plain siblings of each hydration container,
following the pattern the dashboard double-hydration fix established.

`BlogPostApp`'s `bodyHtml` (marked's Markdown-to-HTML output) round-trips
through the serialized hydration props as a plain string — no
`marked`/shiki re-render in the browser. `BlogIndexApp`'s empty-state
branch (no posts) is verified to hydrate as cleanly as the normal
featured/archive branch.

Verified: full test suite green (including a new
`__tests__/dom/blog-hydration.test.ts` covering both apps' hydration, the
empty-state branch, and Nav's copy button working via real interaction on
both page types — sabotage-checked), golden-DOM fixtures regenerated for
both page types, and a real headless-browser render of the built blog
index + a post page with no hydration-related console errors — the theme
picker interactive on the index. Measured cost: each of the two new
client bundles is ~61-62 KB gzip (react + react-dom/client + that page's
app code + Nav hydration), in line with the #797 epic's ~57.5 KB gzip
floor; confirmed via Rollup's own `moduleIds` that neither resolves any
`react-dom/server` module.

Nothing here touches the published `zombie-mermaid` package.
