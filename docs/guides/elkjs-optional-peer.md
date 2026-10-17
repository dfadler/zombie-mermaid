# Migrating: `elkjs` is now an optional peer dependency

**Breaking change** (major release, [#1370](https://github.com/dfadler/zombie-mermaid/issues/1370)).
Design and measurements: [docs/research/1370-elkjs-optional-peer-dep.md](../research/1370-elkjs-optional-peer-dep.md).
Decision record: [elkjs-optional-peer-1370.md](../decisions/elkjs-optional-peer-1370.md).

[`elkjs`](https://github.com/kieler/elkjs) (about 466 KB gzipped) lays out
flowchart, state, class, ER and architecture diagrams. The library no longer
imports it. You supply it, once, with `registerElk()`.

| Diagram type                              | Needs `elkjs`? |
| ----------------------------------------- | -------------- |
| flowchart, state, class, ER, architecture | yes            |
| sequence, pie, xychart, C4                | no             |
| any ASCII output                          | no             |

Browser bundle size (esbuild, minified, gzip):

| Bundle                         | Before | After, elkjs not registered | After, elkjs registered |
| ------------------------------ | ------ | --------------------------- | ----------------------- |
| `@zombie-mermaid/svg-renderer` | 518 KB | 74 KB                       | about 518 KB            |
| `zombie-mermaid` (SVG + ASCII) | 576 KB | 130 KB                      | about 576 KB            |

## What to change

### Browser / bundler apps that render flowcharts, state, class, ER or architecture diagrams

```bash
npm install elkjs
```

```ts
import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk, renderMermaidSVG } from 'zombie-mermaid'

registerElk(ELK) // once, before the first render

const svg = renderMermaidSVG('graph TD\n  A --> B') // still synchronous
```

Without this, rendering those diagram types throws an `ElkNotRegisteredError`
whose message says exactly what to install and call. Only the `ELK` class from
`elkjs/lib/elk.bundled.js` or `elkjs/lib/main.js` works: the renderer drives its
synchronous worker directly.

To keep elk out of your initial bundle, register it lazily when the first graph
diagram appears:

```ts
const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
registerElk(ELK)
```

### Flowcharts only, without `elkjs` in the bundle

If you only render flowcharts and want no `elkjs` at all, pass
`layout: 'simple'` ([#1685](https://github.com/dfadler/zombie-mermaid/issues/1685)):

```ts
import { renderMermaidSVG } from 'zombie-mermaid'

const svg = renderMermaidSVG('graph LR\n  A --> B', { layout: 'simple' }) // no registerElk()
```

It is opt-in, so existing output is unchanged. It costs about 3.5 KB gzipped on
top of the 74 KB "elkjs not registered" bundle above. It covers flowcharts
only: state, class, ER and architecture diagrams still need `elkjs`. Edge routing
is plainer than ELK's, and `mergeEdges`, `layoutCache` and a subgraph's own
`direction` have no effect. Quality numbers and the trade-offs are in
[docs/decisions/simple-layout-1685.md](../decisions/simple-layout-1685.md).

### Node, Bun, CLI, MCP

Nothing to do. `zombie-mermaid` still depends on `elkjs`, and when nothing is
registered the library loads `elkjs` on first use under Node and Bun (ESM and
CJS; verified on Node 24 and Bun). If you use `@zombie-mermaid/svg-renderer`
directly, install `elkjs` yourself (`npm i elkjs`); it is an optional peer.
Auto-load is skipped in browsers and other runtimes without
`process.getBuiltinModule`, where you must call `registerElk()`.

### TypeScript

The published `.d.ts` files no longer import from `elkjs`. The `Elk*` graph
types the API exposes (`ElkNode`, `ElkExtendedEdge`, `LayoutOptions`, ...) are
now exported by `@zombie-mermaid/core`, and are structurally identical to
elkjs's own, so values from either are interchangeable. You no longer need
`skipLibCheck` or `elkjs` installed just to type-check.

### Only sequence, pie, xychart, C4 or ASCII

Nothing to do, and you no longer pay for elk in your bundle.

## Package manifests

- `@zombie-mermaid/svg-renderer`: `elkjs` moved from `dependencies` to
  `peerDependencies` (`^0.11.0 || ^0.12.0`, `peerDependenciesMeta.optional`).
- `@zombie-mermaid/core`: no dependencies (the `elkjs` type import is gone).
- `zombie-mermaid` and `@zombie-mermaid/mcp`: still list `elkjs` under
  `dependencies`, because they ship the CLI and MCP server.

### Removing `elkjs` from `zombie-mermaid`

The umbrella keeps `elkjs` as a regular dependency on purpose, so the CLI and
MCP server work out of the box; only the sub-packages treat it as an optional
peer. If you remove it anyway (for example with an overrides or
`--omit`-style install trick):

- The `zombie-mermaid` CLI fails at startup with `ERR_MODULE_NOT_FOUND`, even
  for ASCII and sequence diagrams, because `dist/cli.js` imports `elkjs`
  statically.
- The library keeps working for diagrams that do not need layout: sequence,
  pie, xychart, C4 and ASCII still render. Flowchart, state, class, ER and
  architecture diagrams throw `ElkNotRegisteredError` unless you call
  `registerElk()`.

Related: [#1685](https://github.com/dfadler/zombie-mermaid/issues/1685)
(lightweight built-in layout) added `layout: 'simple'` for flowcharts.
