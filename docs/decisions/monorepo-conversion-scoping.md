# Monorepo conversion scoping

Status: proposal — answers #416's open questions with a recommendation each,
but the publish-strategy question for `mcp` (see below) needs the repo
owner's product call, not just a technical one. Everything else here is a
technical recommendation ready to drive a follow-up implementation plan.

Out of scope: performing the split. This is scoping only, matching #416's
own "out of scope" note — see that issue for the original proposed package
list and open questions this doc answers.

## Context

`zombie-mermaid` ships today as one package with three subpath exports
(`.`, `./ascii`, `./mcp`) built by `vite.config.lib.ts` from a flat `src/`
tree. Two precedents already exist for carving out a bounded module without
a full package split: the MCP server (`src/mcp/`, #398) and the ASCII
renderer's own export subpath (`./ascii`, #300, added specifically so
ASCII-only consumers skip bundling `elkjs`). #416 proposes going further —
real workspace packages — and lists five open questions plus a proposed
package list (`core`, `mermaid-parser`, `svg-renderer`, `ascii-renderer`,
`svg-parser`, `mcp`, likely `cli`/`demo`).

This doc answers each open question and then sanity-checks the proposed
package list against the actual import graph — grepped directly, not
inferred from the issue's description — because two of the assumed
boundaries turned out to be less clean than #416 states.

## Recommendations

### 1. Workspace tooling: plain pnpm workspaces, no Turborepo/Nx yet

Add a `packages:` list to the `pnpm-workspace.yaml` that already exists in
this repo (currently used only for `pnpm`'s `allowBuilds`/
`minimumReleaseAgeExclude` settings, not for workspace packages — so this is
additive, not new tooling). Use plain `pnpm --filter`/`pnpm -r` for
cross-package scripts; no Turborepo or Nx.

Rationale:

- The repo is already pnpm-native (`packageManager` pinned, `pnpm-workspace.yaml`
  present) — plain workspaces is the smallest change, not a new dependency.
- Package count lands around 6-8 (see the readiness table below), and the
  full test+typecheck+build cycle today runs in a few minutes for a
  single-maintainer repo. Turborepo/Nx earn their keep on remote caching and
  large task graphs across many contributors/CI runners — neither applies
  here yet.
- `vite.config.lib.ts` already builds six environments from one config
  (client/ascii/mcp_es/mcp_cjs/cli/types) with careful, documented
  workarounds for Rolldown's per-environment quirks. That config is a
  ready-made template: each environment becomes roughly one package's own
  `vite.config.ts` once the source physically moves, so the orchestration
  problem a build tool like Turborepo solves (running N packages' builds in
  dependency order, caching unchanged ones) is currently solved by hand, at
  small scale, already.

Revisit if either becomes true: CI wall time for build+test regularly
exceeds ~5 minutes because of redundant rebuilds across packages, or the
package count grows past ~10. Both are concrete, checkable triggers — not
"maybe someday."

### 2. Publish strategy: version-locked via changesets `fixed`, single npm listing

Keep publishing exactly one npm package — `zombie-mermaid` — as today.
Internal packages (`core`, `mermaid-parser`, `svg-renderer`, `ascii-renderer`,
`svg-parser`) become `"private": true` workspace packages, never published
to npm directly. `.changeset/config.json` already has `updateInternalDependencies:
"patch"` and empty `fixed`/`linked` arrays — populate `fixed` with the full
set of workspace package names so they always version together as one
release train, same as today's single-package behavior.

Rationale:

- `RELEASING.md` documents npm trusted publishing (OIDC) as a one-time,
  maintainer-only, per-package manual setup step on npmjs.com. Publishing N
  new packages independently multiplies that manual setup by N and adds a
  release-ordering problem (which package publishes first when several
  change together) for no current consumer benefit — nobody today depends on
  `zombie-mermaid`'s internal modules directly, only on its public exports.
- Version-locking preserves the existing single-CHANGELOG, single-version
  mental model current consumers already have, and needs zero changes to
  `publish.yml` beyond adding the new packages to the pnpm workspace.

**Needs the repo owner's call, not a pure technical answer:** should `mcp`
get its own published npm name (e.g. `zombie-mermaid-mcp`) so it can be
run standalone via `npx` without depending on the umbrella package's SVG/ASCII
export surface? MCP-server tooling conventions often favor a
directly-`npx`-able package name. This is a product/distribution decision
(is a standalone MCP install UX worth maintaining as a second published
artifact) rather than something the import graph or build tooling settles —
flagging it here rather than picking an answer.

### 3. Readiness per proposed package

| Package | Ready now? | Why |
|---|---|---|
| `ascii-renderer` | Yes, mechanically | `src/ascii/**` already never imports `layout-engine/`, `elk-instance.ts`, or any per-type `layout.ts`/`renderer.ts` (confirmed by grep — zero hits). It depends only on `core` modules (below) plus each diagram type's `parser.ts`/`types.ts`. |
| `mcp` | Yes, mechanically | `src/mcp/` is 4 files, ~290 lines total, already documented in #398 as a bounded module. Its only cross-boundary imports are `renderMermaidSVG` (from what becomes `svg-renderer`'s public API), `renderMermaidASCII` (from `ascii-renderer`), `THEMES` (`core`), and `getPackageVersion` (`package-info.ts`, trivially movable to `core` or kept as a tiny shared util). |
| `core` | Needs a scoping pass, not a move | See finding 1 below — the file list is now grep-verified (9 files), but nothing today groups them into one directory; they currently sit at `src/` root interleaved with SVG-renderer-only files. |
| `mermaid-parser` | Needs restructuring | See finding 2 below — `class/`, `er/`, `sequence/`, `xychart/` each currently mix parser-owned files (`parser.ts`, `types.ts`) with renderer-owned files (`layout.ts`, `renderer.ts`) in the same directory. A clean package boundary requires splitting each of these four directories, not just moving them whole. |
| `svg-renderer` | Needs restructuring | Depends on the same split as above (needs the renderer half of each per-type directory), plus moving `renderer.ts` (1,484 lines, currently at `src/` root) and `layout-engine/` + `elk-instance.ts` (confirmed SVG-only) into a real package tree. |
| `svg-parser` | N/A — greenfield | No existing code (confirmed: no `svg` string hits suggesting an ingestion path). "Ready" only in the sense of no legacy debt to migrate; still needs to be designed from scratch, which is out of scope for this scoping pass. |
| `cli` | Defer | Recommend keeping as an app, not a published workspace package, in this first pass — see below. |
| `demo` | Defer | Same as `cli`. |

Cross-cutting prep item, not package-specific: all 140 test files currently
live under `src/__tests__/`, not colocated with the source they test (zero
`.test.ts` files exist under `src/ascii/` or `src/mcp/` themselves, despite
77 and 6 files respectively in `src/__tests__/` matching those names). A
workspace split conventionally wants each package to own its own tests.
Deciding whether to move tests alongside their package or keep a shared
top-level test tree is real prep work for the follow-up plan, not something
this scoping pass resolves.

**Recommend deferring `cli` and `demo`** to real workspace packages in this
first pass, following the precedent #398 already set for the editor
("fine to keep importing internal modules via relative path, same package"
until a monorepo split happens — which is now). Neither is imported as a
library by anyone; converting them into dependency-based packages is pure
migration risk (new install/build indirection) with no current consumer
benefit. Revisit if/when something outside this repo wants to reuse
`demo/components/` or the CLI's argument-parsing/HTML-viewer pieces
independently.

### 4. Migration path: `zombie-mermaid` becomes an umbrella re-export package

Keep the `zombie-mermaid` package name, its `package.json` `exports` map
byte-identical (`.`, `./ascii`, `./mcp`), and its version stream (per the
locked-versioning recommendation above). Internally, `dist/index.js`,
`dist/ascii.js`, and `dist/mcp.js` become thin re-exports of
`@zombie-mermaid/svg-renderer`, `@zombie-mermaid/ascii-renderer`, and
`@zombie-mermaid/mcp` (naming TBD — could stay unscoped internal package
names since they're never published) declared as real `dependencies` in the
umbrella's `package.json`, resolved via the pnpm workspace during
development and as ordinary version-locked deps once published.

Zero breaking change for current consumers: same import specifiers
(`zombie-mermaid`, `zombie-mermaid/ascii`, `zombie-mermaid/mcp`), same
published version numbers, same types (re-exported, not duplicated).
`vite.config.lib.ts`'s existing per-environment structure maps almost
directly onto this: each current environment (`client`, `ascii`, `mcp_es`,
`mcp_cjs`, `cli`, `types`) becomes the corresponding new package's own build
config once its source physically moves — the config isn't thrown away, it
becomes six smaller configs plus one thin umbrella config.

### 5. `layout-engine/` and shared theme/type code

`layout-engine/` (6 files) and `elk-instance.ts` need no split at all —
confirmed by grep that nothing under `src/ascii/` imports either (the one
hit inside `src/ascii/grid.ts` is a code comment referencing
`layout-engine/to-elk.ts` for context, not an import). Both move into
`svg-renderer`'s own tree unmodified.

Root-level "shared theme/type code" is not one undifferentiated pile — a
grep-per-file pass against `src/ascii/**`, the four per-type directories,
and `renderer.ts`/`index.ts`/`parser.ts` splits it cleanly into two groups:

- **True `core`** (imported by `src/ascii/**` and the SVG side both):
  `types.ts`, `theme.ts`, `color-utils.ts`, `text-metrics.ts`,
  `statements.ts`, `multiline-utils.ts`, `diagram-type.ts`,
  `direction-override.ts`, `click-directive.ts`. Nine files — this is now a
  concrete, verifiable list rather than "shared theme/type code" as a vague
  phrase.
- **`svg-renderer`-only** (zero `src/ascii/**` imports): `renderer.ts`,
  `edge-curves.ts`, `elk-instance.ts`, `expanded-shapes.ts`,
  `init-directive.ts`, `layout-engine.ts`, `layout.ts`, `resolve-colors.ts`,
  `shape-clipping.ts`, `style-directives.ts`, `styles.ts`.

## Sanity-check against the actual import graph: two boundaries are less clean than #416 assumes

#416 groups `class/`, `er/`, `sequence/`, `xychart/` under `mermaid-parser`
wholesale ("the per-diagram-type folders"), and implies both renderers only
ever touch a shared model produced by the parser. Grepping the actual
imports shows two things #416 doesn't account for:

**Finding 1 — the per-diagram-type directories are not single-package
units.** Each of `src/class/`, `src/er/`, `src/sequence/`, `src/xychart/`
currently holds both a parser half (`parser.ts`, `types.ts`) and a renderer
half (`layout.ts`, `renderer.ts`) in the same directory. Confirmed: `src/ascii/**`
imports only the parser half of each (e.g. `src/ascii/class-diagram.ts`
imports `parseClassDiagram`/`ClassNode` from `../class/parser.ts`/
`../class/types.ts`, never `../class/layout.ts` or `../class/renderer.ts`).
That's good news for feasibility — the split point already exists at the
file level — but it means moving these directories to their new packages
isn't a mechanical `git mv class/ packages/mermaid-parser/src/class/`. Each
directory has to be split in two: `parser.ts`+`types.ts` go to
`mermaid-parser`, `layout.ts`+`renderer.ts` go to `svg-renderer`. That's real
restructuring work for four directories, not a boundary #416's package list
already respects.

**Finding 2 — `mermaid-parser` is a direct dependency of both renderer
packages, not just a step before a shared "core" model.** For flowchart
diagrams, the pipeline is exactly what #416 assumes: `src/index.ts` and
`src/ascii/index.ts` both call the single `parseMermaid()` function and
consume its generic `MermaidGraph` model. But for class/ER/sequence/xychart
diagrams, `src/index.ts` (the SVG dispatcher) and each of
`src/ascii/class-diagram.ts`/`er-diagram.ts`/`sequence.ts`/`xychart.ts`
independently import and call the same per-type parse function
(`parseClassDiagram`, `parseErDiagram`, `parseSequenceDiagram`,
`parseXYChart`) directly — there is no shared generic model for these four
diagram types the way `MermaidGraph` serves flowcharts. Concretely: `grep`
shows `class/parser.ts` imported from exactly two places,
`src/index.ts` and `src/ascii/class-diagram.ts` — the same fan-out pattern
holds for `er/`, `sequence/`, and `xychart/`. This isn't a blocker (a
diamond dependency — `svg-renderer` and `ascii-renderer` both depending
directly on `mermaid-parser`, in addition to both depending on `core` — is
an ordinary, acyclic workspace shape), but it does mean `mermaid-parser`'s
public package API must export each per-type parse function and its types,
not just a single `parseMermaid()` entry point. A follow-up plan that
assumes `mermaid-parser`'s only public surface is `parseMermaid()` will
under-scope the package's exports.

Neither finding blocks the split. Both are corrections to what "the
existing boundaries" concretely require, worth folding into whatever
follow-up plan actually performs the conversion so that plan doesn't
rediscover them mid-implementation.

## Summary for a follow-up plan

1. Add `packages:` to the existing `pnpm-workspace.yaml`; no Turborepo/Nx.
2. Populate changesets' `fixed` array; keep one published npm package
   (`zombie-mermaid`) as an umbrella re-export; internal packages stay
   private. Confirm with the repo owner whether `mcp` also gets its own
   published name.
3. Extract `ascii-renderer` and `mcp` first — both are mechanically ready
   today with no directory-splitting prerequisite.
4. Before extracting `mermaid-parser`/`svg-renderer`, split each of
   `class/`, `er/`, `sequence/`, `xychart/` into a parser half and a
   renderer half (finding 1); scope `mermaid-parser`'s public API to
   include every per-type parse function and type, not just `parseMermaid()`
   (finding 2).
5. Move `layout-engine/`, `elk-instance.ts`, and the nine `core` files
   listed above without further investigation — their boundaries are
   already grep-confirmed clean.
6. Leave `cli` and `demo` as apps, not packages, in this pass.
7. Decide, alongside step 4, whether tests move to per-package directories
   or stay in a shared top-level tree.
