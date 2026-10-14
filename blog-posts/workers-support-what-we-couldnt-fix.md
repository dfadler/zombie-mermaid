---
title: "Workers Support: One Bug Fixed, the Rest Unconfirmed"
date: 2026-10-14
description: Upstream beautiful-mermaid#149 asks for rendering in Web Workers and Cloudflare Workers. We fixed the exact TypeError and reproduced the fix in a Workers-like Node setup, but we have not run a single diagram in workerd, and we cannot yet promise CPU time or startup limits.
---

> **AI-drafted:** this post was drafted with Claude Code for owner review. Nothing here has been run on Cloudflare's runtime. The checks below are Node simulations, and each one says so.

> **Snapshot:** facts about `beautiful-mermaid` and about Cloudflare's limits are as of 2026-10-14.

[lukilabs/beautiful-mermaid#149](https://github.com/lukilabs/beautiful-mermaid/issues/149)
was filed on 2026-09-07 against `beautiful-mermaid@1.1.3`. Rendering a
flowchart, state, class or ER diagram inside a browser Web Worker threw:

```text
TypeError: Cannot set property self of #<WorkerGlobalScope> which has only a getter
```

The reporter also asked for Cloudflare Workers compatibility and tests for both.
Sequence and XY charts already worked. The issue is still open. On 2026-10-06 I
commented that the fork did not fix it yet and asked what the reporter's
actual constraint was; there has been no reply.

This is the follow-up. Short version: the specific TypeError is fixed and I can
reproduce both the failure and the fix in Node. "Works on Cloudflare Workers"
is not something I can claim, because I never ran workerd.

## What breaks, exactly

Layout for flowchart, state, class, ER and architecture diagrams goes through
[elkjs](https://github.com/kieler/elkjs). elkjs's bundled build decides at load
time whether it is in a Web Worker by looking for `self` and the absence of
`document`. When it thinks it is in a worker it takes a different export path
than the renderer wants (the renderer drives ELK's synchronous
`FakeWorker` directly). So `ensureElk()` hid `self` while constructing ELK:

```ts
// before (simplified)
const origSelf = g.self
delete g.self
try { instance = new Ctor() } finally { g.self = origSelf }
```

In a Node process that works. In a browser Web Worker, `self` is a getter-only
accessor on the prototype. `delete` does nothing there, so elkjs still sees
`self`, and the restore line throws the error above. That is the entire report.
Nothing in it is about `eval`, WebAssembly or Node modules.

## What is fixed

[#1524](https://github.com/dfadler/zombie-mermaid/issues/1524) tracked it.
The fix, [#1670](https://github.com/dfadler/zombie-mermaid/pull/1670) (commit
[`0d6711c`](https://github.com/dfadler/zombie-mermaid/commit/0d6711c1c51a57e25ede4c11e360c208ea4b9278),
2026-10-10), shadows `self` with an own `undefined` property during
construction, then restores the original descriptor or deletes the shadow. It
shipped in 5.1.0 (the `svg-renderer` tag is dated 2026-10-11) and is in the
current 5.3.0.

I checked it two ways, both on Node v22.22.1 against the built
`@zombie-mermaid/svg-renderer` 5.3.0 `dist`:

- I defined a getter-only `self` on `Object.prototype`, deleted
  `globalThis.process`, replaced `eval` with a function that throws, and made
  `new Function` throw. No `document` was defined. After `registerElk(ELK)`,
  flowchart, state, class and ER diagrams each rendered, and a second flowchart
  rendered from the cached ELK instance.
- To make sure the harness would have caught the bug, I temporarily patched the
  built file back to the old `delete` and restore logic. The same script then
  threw `Cannot set property self of #<Object> which has only a getter` on every
  ELK diagram. I put the built file back afterwards.

I also grepped the built output of `core`, `mermaid-parser`, `ascii-renderer` and
`svg-renderer`, and `elkjs/lib/elk.bundled.js` 0.11.1. There are no static `node:`
imports, no `new Function`, no `eval(` and no `WebAssembly` anywhere in them. The
only Node-specific code is in the SVG renderer's ELK auto-loader
(`process.getBuiltinModule` plus `createRequire`), and it returns `null` when
`process` is absent, which ends in a clear `ElkNotRegisteredError`, not a crash.

## What works without ELK

Two things need no `elkjs` at all, and both ran in the same stripped-down harness:

- **ASCII output.** `renderMermaidASCII` rendered a flowchart with `process`
  deleted and `eval` disabled. The ASCII renderer has never used ELK. I pointed
  the reporter at this path on #149.
- **`layout: 'simple'`** for flowcharts, added in 5.2.0 (2026-10-13), a built-in
  layered layout. It rendered with no `registerElk()` call. It is flowchart-only
  and ignores `mergeEdges`, `layoutCache` and a subgraph's own direction. State,
  class, ER and architecture diagrams still need ELK. See the
  [API reference](https://github.com/dfadler/zombie-mermaid/blob/main/docs/api-reference.md)
  and [the decision record](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/simple-layout-1685.md)
  for the quality tradeoffs.

Sequence, pie, xychart and C4 diagrams do not touch ELK either.

## The setup I would try, and what it has not proven

Since 5.0.0 `elkjs` is an optional peer dependency
([#1370](https://github.com/dfadler/zombie-mermaid/issues/1370)). The package
never imports it statically, so on a platform without Node's module loader you
register it yourself once at startup:

```ts
import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk, renderMermaidSVG } from 'zombie-mermaid'

registerElk(ELK)

export default {
  fetch() {
    return new Response(renderMermaidSVG('graph TD; A-->B'), {
      headers: { 'content-type': 'image/svg+xml' },
    })
  },
}
```

That is the shape I ran in the Node harness, minus the `Response` wrapper. It is
the registration path I expect to work on Workers. I have not bundled it with
wrangler or run it in workerd, so treat it as unverified there.

## What I could not do or confirm

- **No workerd run.** `wrangler` and `workerd` are not installed here, and
  fetching and running them in one step is something I do not do without
  explicit permission. A getter-only `self` on `Object.prototype` is my
  approximation of `WorkerGlobalScope`, not the real thing. Whoever has wrangler
  can settle this in a few minutes: a Worker that calls `registerElk(ELK)` and
  renders `graph TD; A-->B`.
- **No bundler check.** I do not know whether wrangler's bundler resolves
  `elkjs/lib/elk.bundled.js` and our ESM output cleanly. I did not test it.
- **No bundle-size or CPU measurement on Workers.** `elk.bundled.js` is 1.6 MB
  raw and about 460 KB gzipped (measured with `gzip`); our `svg-renderer` build
  is about 200 KB. Cloudflare's [limits page](https://developers.cloudflare.com/workers/platform/limits/)
  currently states a 64 MiB uncompressed size limit on both plans, a 1 second
  startup limit for top-level code, and 10 ms of CPU time per HTTP request on
  the Free plan. Size is not the problem. Startup and CPU time might be: in
  Node on my laptop, a first ELK render of a five-node flowchart took roughly
  0.7 to 0.8 s over three runs, and the second took 0.1 to 0.2 s, while the
  first `layout: 'simple'` render took about 70 to 220 ms. That machine was busy and
  those are Node numbers, not workerd's, so they prove nothing about the
  Workers limits. They are the reason I will not say ELK fits a free Worker.
- **No real browser Web Worker run.** The fix targets the exact accessor
  behavior, and the Node harness reproduces that behavior, but no Chrome worker
  has rendered a diagram yet.
- **No Workers CI job.** Upstream asked for tests in both environments. We have
  a vitest case for the accessor and nothing that runs workerd. I do not want to
  add a CI job on a runtime I have not run once by hand.

## What this means for someone on Workers

- If you only need terminal text, use `zombie-mermaid/ascii`. That path has no
  ELK, and ran in the harness.
- If you need SVG for flowcharts and can accept a simpler layout, try
  `layout: 'simple'`. It avoids ELK's startup cost entirely.
- If you need ELK layouts on Workers, the `registerElk` setup above is the one to
  try, and I would like to hear whether it works. Open an issue with your
  wrangler version and the error, if there is one.
- On upstream `beautiful-mermaid@1.1.3` the reported TypeError is the thing
  you will hit in a Web Worker. I did not run upstream for this post; the
  failure comes from its issue text and from our reproduction of the same
  `ensureElk()` code path before the fix.
