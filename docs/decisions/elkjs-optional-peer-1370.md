# `elkjs` is an optional peer dependency, loaded through `registerElk()`

Status: implemented

## Context

`@zombie-mermaid/svg-renderer` statically imported `elkjs/lib/elk.bundled.js`
(about 466 KB gzipped), so every browser bundle that imported the SVG renderer
paid for it, including apps that only render sequence, pie, xychart or C4
diagrams, none of which use elk. [#1370](https://github.com/dfadler/zombie-mermaid/issues/1370)
proposed an opt-in async entry (`zombie-mermaid/async`) that loads elk lazily.

## Decision

Make `elkjs` an optional peer dependency of `@zombie-mermaid/svg-renderer` and
have the library stop importing it. The consumer calls `registerElk(ELK)` once;
under Node and Bun the library auto-loads an installed `elkjs` instead. Without
a registered constructor, graph diagrams (flowchart, state, class, ER,
architecture) throw `ElkNotRegisteredError`. Decided in the #1370 research
([`docs/research/1370-elkjs-optional-peer-dep.md`](../research/1370-elkjs-optional-peer-dep.md)),
implemented in [#1444](https://github.com/dfadler/zombie-mermaid/pull/1444)
(merged 2026-10-08, released as 5.0.0, a major). Migration:
[`docs/guides/elkjs-optional-peer.md`](../guides/elkjs-optional-peer.md).

Rejected, with the reasons in the research doc (sections 2 and 3):

- **Async entry (`zombie-mermaid/async`).** It only defers the bytes (elk is
  still shipped in the async chunk), cannot serve the synchronous
  `renderMermaidSVG`, and needs a second entry, an injected constructor and a
  retry hack.
- **Peer declared but static import kept.** Bundlers still inline elk.
- **Dynamic `import()` or top-level await.** Cannot satisfy sync callers and
  breaks the CJS build.
- **Additive `zombie-mermaid/no-elk` subpath (minor).** Avoids the major but
  brings back the second-entry cost.

## Consequences

- Browser and bundler consumers that render graph diagrams must install `elkjs`
  and register it; this is the breaking part. Measured with elk unregistered:
  svg-renderer 518 KB to 74 KB gzip, umbrella 576 KB to 130 KB (#1444 body).
- Sync rendering is unchanged: the constructor slot replaces the import, and
  the FakeWorker bypass in `packages/svg-renderer/src/elk-instance.ts` stays.
  Only the `ELK` class from `elkjs/lib/elk.bundled.js` or `elkjs/lib/main.js`
  works, because the renderer drives the synchronous worker directly.
- `zombie-mermaid` and `@zombie-mermaid/mcp` keep `elkjs` as a regular
  dependency (they ship the CLI and MCP server); `@zombie-mermaid/core` dropped
  it and inlines the `Elk*` types so the published `.d.ts` files do not import
  `elkjs`.
- An async or worker-based layout entry is not ruled out, only deferred: it
  would sit on top of `registerElk()` (research doc, end of section 3).
- A flowchart-only consumer can also skip elk with `layout: 'simple'`
  ([#1685](https://github.com/dfadler/zombie-mermaid/issues/1685), see
  [`simple-layout-1685.md`](simple-layout-1685.md)); that came after this
  decision and does not change it.
- The peer range has since widened to `^0.11.0 || ^0.12.0`
  ([#1907](https://github.com/dfadler/zombie-mermaid/pull/1907)); the research
  doc still says `^0.11.0`.
