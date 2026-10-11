# Research: `elkjs` as an optional peer dependency vs. the async-entry plan

Status: **answered; recommendation below.** Written for
[#1370](https://github.com/dfadler/zombie-mermaid/issues/1370) (reduce the cost of bundling
`elkjs`, ~1.6 MB `elkjs/lib/elk.bundled.js`). Compares the issue's async-entry proposal
(`zombie-mermaid/async`, injected ELK constructor, retry on a "need layout" signal) against making
`elkjs` an optional peer dependency. Measured on `main` @ `0d61de15`, Node 24, `pnpm run build`.

## TL;DR

- The published `dist/` files **already leave `elkjs` external**. Only
  `packages/svg-renderer/dist/index.js` imports it (one static import). The 1.6 MB cost is paid
  by the consumer's bundler (browser) or `node_modules` (Node), not by our tarballs.
- Making `elkjs` an optional peer wins the **same bytes** the async entry defers, and
  more: a consumer that registers nothing never ships elk at all. Measured (esbuild, minified,
  gzip, browser): `svg-renderer` 516 KB -> 74 KB; umbrella (svg + ascii) 573 KB -> 129 KB.
- Sync `renderMermaidSVG` **keeps working** under the peer design: it needs a registered
  constructor, not an async load. The async plan cannot keep sync working without a retry hack.
- It is a **breaking change** for browser-bundler consumers (they currently get elk for free) and
  for TypeScript consumers (the `.d.ts` files import `elkjs` types). Needs a major.
- Recommendation: **peer + `registerElk()` registration + Node auto-load**, skip the async
  entry. Optionally add a worker/async variant later as a separate, additive issue.

## 1. Who needs elk at runtime

Dispatch table: `packages/svg-renderer/src/registry.ts`. Each type's `layoutForSvg`:

| Diagram type                      | Layout function                            | Reaches `elkLayoutSync`?  | Evidence                                 |
| --------------------------------- | ------------------------------------------ | ------------------------- | ---------------------------------------- |
| flowchart                         | `layoutFlowchartSync` -> `layoutGraphSync` | yes                       | `registry.ts:317`; `layout-engine.ts:72` |
| state (shares flowchart pipeline) | same                                       | yes                       | `registry.ts:306` (flowchart module)     |
| architecture                      | `layoutGraphSync`                          | yes                       | `registry.ts:381`                        |
| class                             | `layoutClassDiagramSync`                   | yes                       | `class/layout.ts:498`                    |
| ER                                | `layoutErDiagramSync`                      | yes                       | `er/layout.ts:214`                       |
| C4                                | `layoutC4DiagramSync`                      | **no** (own frame layout) | `c4/layout.ts:601`, no elk import        |
| sequence                          | `layoutSequenceDiagram`                    | no                        | `sequence/layout.ts:130`                 |
| pie                               | `layoutPieChart`                           | no                        | `pie/layout.ts:114`                      |
| xychart                           | `layoutXYChart`                            | no                        | `xychart/layout.ts:54`                   |

So four elk call sites (`layout-engine.ts:72`, `class/layout.ts:498`, `er/layout.ts:214`, and
architecture/state via `layoutGraphSync`), all through `elkLayoutSync()` in
`packages/svg-renderer/src/elk-instance.ts:231`.

Entry points and dist imports (measured from the built dist files):

| Artifact                                  | raw / gz (bytes)    | imports `elkjs`?                                                  |
| ----------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| `packages/svg-renderer/dist/index.js`     | 178,992 / 53,537    | **yes**, `elkjs/lib/elk.bundled.js` (the only one)                |
| `packages/core/dist/index.js`             | 25,759 / 9,378      | no (types only, see below)                                        |
| `packages/mermaid-parser/dist/index.js`   | 59,620 / 18,643     | no (note at `mermaid-parser/src/index.ts:25`)                     |
| `packages/ascii-renderer/dist/index.js`   | 214,054 / 57,217    | no (`ascii-renderer/src/registry.ts:18` records the #300 fix)     |
| `packages/mcp/dist/index.js`              | 19,150 / 5,947      | no directly; depends on `svg-renderer`                            |
| `dist/index.js` (umbrella), `dist/cli.js` | 717 / 36,490        | no directly; reach it via `svg-renderer` (`src/cli/render.ts:14`) |
| `node_modules/elkjs/lib/elk.bundled.js`   | 1,607,470 / 469,167 | n/a                                                               |

ASCII never touches elk (separate grid router), nor do sequence/pie/xychart/C4 SVG output.
Type-only leaks: `packages/core/src/types.ts:5` (`import type { ElkNode }`) and
`svg-renderer/src/**/*.ts` type imports end up as `import ... from 'elkjs'` in
`packages/core/dist/index.d.ts` and `packages/svg-renderer/dist/index.d.ts`. `core` lists
`elkjs` under `dependencies` (`packages/core/package.json:38`) purely for that type import.
`config/vite.config.lib.ts:94-127` explains why the external matcher needs a prefix test.

## 2. How the peer design works

### Manifest

`packages/svg-renderer/package.json` (and root/umbrella, `core`): move `elkjs` from
`dependencies` to

```json
"peerDependencies": { "elkjs": "^0.11.0" },
"peerDependenciesMeta": { "elkjs": { "optional": true } },
"devDependencies": { "elkjs": "^0.11.0" }
```

`core` should drop it from `dependencies` regardless of this decision (type import only).

### Loading: three options

1. **Static import stays (status quo, peer-declared only).** Does not help bundlers: they still
   see `import ... from 'elkjs/lib/elk.bundled.js'` and inline it. Rejected.
2. **Dynamic `import()` / top-level await.** Cannot satisfy a sync caller, breaks the CJS build
   (`dist/index.cjs`), and bundlers still split-and-include it. Rejected for sync; this is the
   async plan's mechanism.
3. **Registration API (recommended).** `elk-instance.ts` no longer imports elk. It holds a
   module-level constructor slot filled by `registerElk(ELK)`; `ensureElk()` (the
   `elk-instance.ts:166` FakeWorker/setTimeout dance) uses the slot instead of `ELKBundled`.
   Consumer: `import ELK from 'elkjs/lib/elk.bundled.js'; registerElk(ELK)` once. Because the
   FakeWorker bypass in `elk-instance.ts:166-260` only needs the constructor, **sync rendering
   is unchanged**; any constructor from `elkjs/lib/elk.bundled.js` or `elkjs/lib/main.js` works.
4. **Node auto-load (additive to 3).** When the slot is empty and running under Node, fall back
   to `process.getBuiltinModule('module').createRequire(import.meta.url)('elkjs/lib/elk.bundled.js')`
   (Node >= 22.3; repo needs >= 24). Bundlers do not statically analyze that call, so it is never
   inlined; CLI, MCP and server use stay zero-config and sync. Not prototyped here; the CJS
   build would use plain `require`. Must be verified against the CJS output and Bun/Deno before
   committing to it.

### Error without it

Replace the silent assumption with an explicit, typed error thrown from `ensureElk()` when the
slot is empty and auto-load fails, for example:

> `zombie-mermaid: rendering a flowchart/state/class/ER/architecture diagram needs the optional
peer dependency "elkjs". Install it (npm i elkjs) and call registerElk(ELK) with
`import ELK from 'elkjs/lib/elk.bundled.js'`. Sequence, pie, xychart, C4 and ASCII output do
not need it.`

Sequence/pie/xychart/C4 and all ASCII render without it, as today.

### Fallout by surface

- **Umbrella `zombie-mermaid`:** root `package.json:148` lists `elkjs` as a dependency. Keep it
  a regular dependency there? That keeps `npm i zombie-mermaid` installing it (Node auto-load
  works, install size unchanged) but gives bundler users nothing unless the library no longer
  statically imports it, which is the point of option 3. Cleanest: umbrella re-exports
  `registerElk` and keeps `elkjs` as an optional peer too, since the install-size win is the
  goal; see risk 2.
- **CLI (`src/cli.ts` -> `src/cli/render.ts:14`):** rides Node auto-load, or explicitly registers
  at startup (it is a Node program, so a plain `import ELK ...; registerElk(ELK)` in `cli.ts` and
  `packages/mcp` is simplest and testable). Needs elkjs installed alongside; make it a real
  `dependency` of the CLI/MCP bin packages.
- **Demo/site (`demo/*`, `packages/site/*`, bundled via `scripts/vite-bundle.ts` /
  `demo/build-nav-client.ts`):** each browser bundle that renders diagrams must register elk
  (client entry files: `demo/diagram-type-client.tsx`, `demo/components/*-app.tsx`,
  `editor-rendering.ts`). Site SSR scripts (`packages/site/pages.ts`, `blog.ts`, `fork-fixes*.ts`)
  are Node and can register in one shared helper.
- **Tests:** 27 files in `packages/svg-renderer/src` plus `__tests__/visual/helpers`,
  `__tests__/dom/*`, `scripts/{layout-oracle,form-diff,visual-diff}.ts` call sync layout. One
  `registerElk` line in `config/vitest.setup.ts` (already wired at `config/vitest.config.ts:94`)
  covers vitest; scripts need one line each. Add a test that the unregistered error is thrown
  and that sequence/pie/xychart/C4 render with no registration.
- **Types:** `ElkNode` etc. appear in the public `.d.ts` (`svg-renderer/dist/index.d.ts:6-13`).
  Without `elkjs` installed, TS consumers without `skipLibCheck` get errors. Either keep
  `@types`-style access (elkjs ships its own `.d.ts`, so that means the package itself), or
  inline the handful of structural types the API exposes. Inlining is the right long-term fix
  but is the largest hidden task in this plan.
- **Badges/budgets:** `scripts/generate-bundle-badge.ts:64` adds `elkjs/lib/elk.bundled.js` to
  `SVG_DEPS` for the SVG and umbrella badges. Under the peer design the headline number should
  be reported both ways: base (no elk, ~74 KB svg / ~129 KB umbrella by the table below) and
  "with elk"; otherwise the badge keeps advertising the 596 KB that the change removes.
  `__tests__/bundle-badge-entities-exports.test.ts` stays valid. Current badge output on `main`:
  596.2 KB umbrella, 540.5 KB svg-renderer, 82.2 KB ascii (`pnpm run badge:bundle-size`).

## 3. Sizes and who wins

Browser bundle, esbuild minified, gzip (stdin entry re-exporting the public render function;
"peer" = `elkjs/lib/elk.bundled.js` marked external):

| Consumer                         | Today   | Peer design, elk not registered | Peer design, elk registered | Async plan (initial / total)   |
| -------------------------------- | ------- | ------------------------------- | --------------------------- | ------------------------------ |
| `@zombie-mermaid/svg-renderer`   | 516,301 | **73,708**                      | ~516 KB (same)              | ~74 KB initial, ~516 KB total  |
| umbrella (svg + ascii)           | 573,207 | **128,662**                     | ~573 KB (same)              | ~129 KB initial, ~573 KB total |
| `@zombie-mermaid/ascii-renderer` | 72,502  | 72,502                          | 72,502                      | 72,502                         |

(`elkjs` alone is 469,167 B gzip; the rest is our code.)

- **Winners:** browser apps that render only sequence/pie/xychart/C4 or only ASCII (svg-only
  -86%, umbrella -78%); apps that load elk on demand, because registration can sit behind
  their own `await import('elkjs/lib/elk.bundled.js')` at the moment the first graph diagram
  appears. That is the async plan's benefit, available to any consumer with no new entry.
- **Losers:** browser consumers that render flowcharts and relied on zero config (new install +
  one registration line, or a runtime error); TS consumers without `skipLibCheck` until types are
  inlined; the demo/site/tests (mechanical one-liners).
- **Neutral:** Node/CLI/MCP users under auto-load or explicit startup registration.

### Peer vs. async-entry plan

|                         | Optional peer + `registerElk`                                                                                                            | Async entry (`zombie-mermaid/async`)                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Size win                | Elk fully removable, or deferrable by the consumer                                                                                       | Deferred only; elk always shipped in the async chunk                                                                                      |
| Sync `renderMermaidSVG` | Unchanged                                                                                                                                | Cannot run on the async entry; sync path keeps static import, so the existing entry gains nothing                                         |
| Breaking surface        | Yes: bundler consumers + TS types need action -> major                                                                                   | None; additive entry, existing API unchanged                                                                                              |
| Build complexity        | Low: one slot instead of an import; no second entry, no second `.d.ts`/api-extractor pass, no exports-map change                         | High: second self-contained svg-renderer entry, injected constructor, retry on "need layout" signal, really-async `renderMermaidSVGAsync` |
| API changes             | `registerElk` added; error for unregistered graph diagrams                                                                               | New entry; `renderMermaidSVGAsync` semantic change/deprecation                                                                            |
| Worker support          | Consumer-supplied constructor can be elkjs's worker-based `ELK({workerUrl})`; only async layout can use it, so sync path would reject it | First-class goal in the issue                                                                                                             |
| Cache sharing           | One `createLayoutCache` as today                                                                                                         | Must share across two code paths (issue constraint)                                                                                       |
| Identical output        | Same code path, so by construction                                                                                                       | Must be proven by baselines                                                                                                               |

The two are not exclusive: a future async entry would sit cleanly on top of `registerElk` (async
path = same slot plus a worker-capable constructor), which is a reason to land the registration
seam first.

## 4. Recommendation and implementation outline

**Do the optional peer with a registration API and Node auto-load. Do not build the async entry
now.** It gives a larger win (elk removable), keeps sync intact, and is less code, at the cost
of one deliberate breaking change that is cheap to document. Reconsider the async entry only if
real users ask for worker-based layout, as a follow-up issue.

Steps:

1. `elk-instance.ts`: remove the `elkjs/lib/elk.bundled.js` import; add a `let ElkCtor` slot,
   exported `registerElk(ctor)`, Node auto-load fallback, and the clear error in `ensureElk()`.
   Keep `createLayoutCache`/`elkLayoutSync` signatures. Re-export `registerElk` from the
   svg-renderer index (already `export *`) and the umbrella (`src/index.ts:43` area).
2. Manifests: `svg-renderer` and umbrella move `elkjs` to optional `peerDependencies` +
   `devDependencies`; `core` drops it from `dependencies` (type-only); CLI/MCP packages depend on
   it for real.
3. Types: replace `import type ... from 'elkjs'` in the public surface with locally owned
   structural types (or confirm and document `skipLibCheck`). Check api-extractor output
   (`packages/*/dist/*.d.ts`).
4. CLI (`src/cli.ts`), MCP (`packages/mcp`), site SSR scripts: register at startup. Demo client
   bundles: register in their entry files; consider lazy `import()` for graph diagrams.
5. Tests: register in `config/vitest.setup.ts`; add unit tests for the unregistered error,
   the no-elk types (sequence/pie/xychart/C4 render without registration) and a CJS+ESM
   Node auto-load check. Do the sabotage check on the error test.
6. Badges: extend `scripts/generate-bundle-badge.ts` to report base vs. with-elk; update README
   badge text and `docs` that quote ~500 KB.
7. Docs + migration note (README "Using SVG in the browser"), and a `major` changeset for the
   fixed group (`.changeset/config.json` fixes all six packages to move together).

Risk:

1. **Breaking, silently at runtime for browser users** (flowchart now throws until they
   register). Mitigate with an actionable error message and a prominent changelog entry.
2. **Auto-load portability** (CJS output, Bun/Deno, Workers, `process.getBuiltinModule`
   availability). Needs a prototype; fallback is explicit registration everywhere, which is
   still fine.
3. **Types:** exposing elkjs types in `.d.ts` is the main hidden cost (step 3).
4. **Peer resolution under pnpm/yarn PnP:** optional peers are not auto-installed on npm >= 7,
   which is the intent, but `registerElk` consumers must install a compatible `elkjs ^0.11`.
5. The existing `elk-instance.ts` reaches into FakeWorker internals; this plan keeps that
   (as does the status quo). A future elkjs major could break it either way.

Semver: **major** for the fixed group (behavior change for bundler consumers and TS users,
removal of a transitive install). If a major is unwanted now, a softer variant is to ship
`registerElk` + Node auto-load **while keeping the static import as the default entry** and put
the elk-free build behind a new subpath (`zombie-mermaid/no-elk`): additive minor, but that
reintroduces the second-entry cost the peer design avoids.

Decision needed from the maintainer: accept a major (recommended), or the additive-subpath
variant.
