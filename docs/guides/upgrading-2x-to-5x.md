# Upgrading from 2.x to 5.x

Task-oriented checklist for moving an app from `zombie-mermaid` 2.x to 5.x. Of
the majors since 2.x, 4.0.0 and 5.0.0 carry the changes you may have to act on,
and for many apps they are a no-op. If you are coming from `beautiful-mermaid`
instead, start with [Migrating from beautiful-mermaid](../migrating-from-beautiful-mermaid.md).

This page is only the "what do I change" list. Every release's full notes are in
the [CHANGELOG](../../CHANGELOG.md).

## Do I need to change anything?

| You…                                                                   | Change needed                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| render in a browser or bundler (flowchart/state/class/ER/architecture) | [Register `elkjs`](#browsers-and-bundlers-register-elkjs-500)  |
| use the CLI or the MCP server                                          | none for `elkjs`; check your [Node version](#node-version-400) |
| render only sequence, pie, xychart, C4 or ASCII                        | none for `elkjs`                                               |
| deep-import from `zombie-mermaid/src/...`                              | [Stop](#src-is-no-longer-published-500)                        |
| call `renderMermaid` or `renderMermaidSync`                            | optional: [rename](#prefer-rendermermaidsvg)                   |

## Browsers and bundlers: register `elkjs` (5.0.0)

`elkjs` is now an optional peer dependency and the library no longer imports it.
Before, `zombie-mermaid` bundled it; now you supply it once.

Before (2.x to 4.x):

```ts
import { renderMermaidSVG } from 'zombie-mermaid'

const svg = renderMermaidSVG('graph TD\n  A --> B')
```

After (5.x):

```bash
npm install elkjs
```

```ts
import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk, renderMermaidSVG } from 'zombie-mermaid'

registerElk(ELK) // once, before the first render

const svg = renderMermaidSVG('graph TD\n  A --> B') // still synchronous
```

Without this, flowchart, state, class, ER and architecture diagrams throw
`ElkNotRegisteredError`, whose message names exactly what to install and call.
Sequence, pie, xychart, C4 and all ASCII output never needed `elkjs`.

Under Node and Bun the library loads `elkjs` itself when nothing is registered,
and `zombie-mermaid` and `@zombie-mermaid/mcp` still depend on it, so scripts,
the CLI and the MCP server need no change.

The full guide, including lazy registration to keep `elkjs` out of your initial
bundle, is [Migrating: `elkjs` is an optional peer](elkjs-optional-peer.md).

### What you get for it

Browser bundle size (esbuild, minified, gzip), when `elkjs` is not registered:

| Bundle                         | 4.x    | 5.x    |
| ------------------------------ | ------ | ------ |
| `@zombie-mermaid/svg-renderer` | 518 KB | 74 KB  |
| `zombie-mermaid` (SVG + ASCII) | 576 KB | 130 KB |

If you do register `elkjs` the bundle is about the old size again. These
figures are from [the measurement doc](../research/1370-elkjs-optional-peer-dep.md).

## Node version (4.0.0)

4.0.0 changed `engines.node` in `package.json` from `>=22` to `>=24`
([#1291](https://github.com/dfadler/zombie-mermaid/pull/1291)), and its release
notes say Node 22 is no longer supported. Whether that should stay a
requirement for consumers is an open decision, tracked in
[#1567](https://github.com/dfadler/zombie-mermaid/issues/1567), which also
records what has been tested on other Node versions. Package managers that
enforce `engines` (`engine-strict`, Yarn) act on the declared field as it
stands.

## `src/` is no longer published (5.0.0)

Through 4.x the npm tarball included a `src/` folder next to `dist/`. 5.0.0
stops publishing it
([#1446](https://github.com/dfadler/zombie-mermaid/pull/1446)); the source maps
already embed the sources, so stack traces and debuggers still show the original
TypeScript. The tarball is smaller as a result.

Before:

```ts
import { something } from 'zombie-mermaid/src/internal.ts' // reached into the tarball's src/
```

After: import from the package root, `zombie-mermaid/ascii`, `zombie-mermaid/mcp`,
or the per-concern packages (`@zombie-mermaid/core`, `mermaid-parser`,
`svg-renderer`, `ascii-renderer`). The repository itself keeps its code under
`packages/*`; there is no `src/` library layout to deep-import from. Anything you
need that is not exported is a feature request, not something to reach for in the
tarball.

## Prefer `renderMermaidSVG`

`renderMermaidSVG` (sync) and `renderMermaidSVGAsync` are the primary names.
`renderMermaidSync`, `renderMermaid` and `renderMermaidAscii` still exist as
deprecated aliases of `renderMermaidSVG`, `renderMermaidSVGAsync` and
`renderMermaidASCII`, so nothing breaks, but new code should use the primary
names.

```ts
// Before
import { renderMermaid } from 'zombie-mermaid'
const svg = await renderMermaid(code)

// After
import { renderMermaidSVG } from 'zombie-mermaid'
const svg = renderMermaidSVG(code) // synchronous; renderMermaidSVGAsync if you want a Promise
```

## The 7px ASCII cell: only matters if you copied the site CSS

The 7px cell is a change to the project's own site mockup, not to the library
output. `renderMermaidASCII` returns the same text as before; the site's
`.ascii-output` CSS now uses an exact 7px, odd-width cell so box lines join
without gaps. If you styled your own HTML view of `colorMode: 'html'` ASCII
output by copying that CSS, re-copy it from `demo/styles.css` and see
[Visual regression](../visual-regression.md) for why the cell must be an integral
pixel width. If you did not, there is nothing to do.

## Other changes you may notice in the rendered output

None of these need code changes, but they change what diagrams look like, which
matters if you cache SVG or diff snapshots (the
[CHANGELOG](../../CHANGELOG.md) has the full list):

- 2.0.0: the inert `data-click-callback` attribute is gone. Read
  `parseMermaid(source).interactions` instead
  ([#497](https://github.com/dfadler/zombie-mermaid/pull/497)).
- 4.0.0: ASCII `RL` flowcharts and state diagrams now flow right to left; class
  attributes render as written; SVG state and class layout ordering changed.
- 5.0.0: the published `.d.ts` files no longer import from `elkjs`; the `Elk*`
  graph types are exported by `@zombie-mermaid/core`.

## After upgrading

```bash
npm ls zombie-mermaid elkjs   # one version of each, no peer warnings
```

Render one diagram of each type you use in the browser, since that is where a
missing `registerElk()` shows up.
