---
title: Upgrading from zombie-mermaid 2.x to 5.x
date: 2026-10-10
description: A short checklist for moving an app from 2.x to 5.x. Register elkjs in browsers, check your Node version, stop importing from src/, and prefer renderMermaidSVG.
---

If you last touched zombie-mermaid at 2.x, most of your code keeps working.
Four things may need a change, and for many apps none do. This is the short
version; the full guide, with the same before/after code, is
[`docs/guides/upgrading-2x-to-5x.md`](https://github.com/dfadler/zombie-mermaid/blob/main/docs/guides/upgrading-2x-to-5x.md).

## 1. Browsers and bundlers: register `elkjs` (5.0.0)

`elkjs` is now an optional peer dependency, and the library no longer imports
it. Flowchart, state, class, ER and architecture diagrams need it. Sequence,
pie, xychart, C4 and every ASCII output do not.

```bash
npm install elkjs
```

```ts
import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk, renderMermaidSVG } from 'zombie-mermaid'

registerElk(ELK) // once, before the first render

const svg = renderMermaidSVG('graph TD\n  A --> B') // still synchronous
```

Skip `registerElk` and those diagram types throw `ElkNotRegisteredError`, with a
message that says what to install. Node, Bun, the CLI and the MCP server load
`elkjs` on their own, so they need no change.

The reason to accept the extra step is bundle size. With `elkjs` unregistered,
the SVG renderer is about 74 KB gzipped, down from 518 KB, and the umbrella
`zombie-mermaid` bundle is about 130 KB, down from 576 KB.

## 2. Node version (4.0.0)

4.0.0 changed `engines.node` from `>=22` to `>=24`, and its release notes say
Node 22 is no longer supported. Whether that should stay a consumer
requirement is still an open decision
([#1567](https://github.com/dfadler/zombie-mermaid/issues/1567)).

## 3. `src/` is no longer published (5.0.0)

The npm tarball used to include `src/` next to `dist/`. 5.0.0 drops it, which
makes the tarball smaller; source maps still embed the sources, so debugging
shows the original TypeScript. If you imported from `zombie-mermaid/src/...`,
switch to the package root, `zombie-mermaid/ascii`, `zombie-mermaid/mcp`, or
the `@zombie-mermaid/*` packages.

## 4. Prefer `renderMermaidSVG`

`renderMermaidSVG` and `renderMermaidSVGAsync` are the primary names.
`renderMermaid`, `renderMermaidSync` and `renderMermaidAscii` still work as
deprecated aliases, so this one is optional.

```ts
// before
const svg = await renderMermaid(code)
// after
const svg = renderMermaidSVG(code)
```

## What did not change for library users

The ASCII mockup on this site now uses an exact 7px character cell so box
lines join without gaps. That is site CSS; `renderMermaidASCII` returns the same
text as before. It only matters if you copied the site's `.ascii-output`
styles for your own HTML view.

Release-by-release detail is in the
[CHANGELOG](https://github.com/dfadler/zombie-mermaid/blob/main/CHANGELOG.md).
