# Monorepo conversion scoping

Status: proposal — answers #416's open questions with a recommendation each,
but the publish-strategy question for `mcp` (see below) needs the repo
owner's product call, not just a technical one. Everything else here is a
technical recommendation ready to drive a follow-up implementation plan.

Out of scope: performing the split. This is scoping only, matching #416's
own "out of scope" note — see that issue for the original proposed package
list and open questions this doc answers. Execution is tracked in the
follow-up plan at #620, broken into sub-issues #621-#627.

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

| Package          | Ready now?                       | Why                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ascii-renderer` | Yes, mechanically                | `src/ascii/**` already never imports `layout-engine/`, `elk-instance.ts`, or any per-type `layout.ts`/`renderer.ts` (confirmed by grep — zero hits). It depends only on `core` modules (below) plus each diagram type's `parser.ts`/`types.ts`.                                                                                                                           |
| `mcp`            | Yes, mechanically                | `src/mcp/` is 4 files, ~290 lines total, already documented in #398 as a bounded module. Its only cross-boundary imports are `renderMermaidSVG` (from what becomes `svg-renderer`'s public API), `renderMermaidASCII` (from `ascii-renderer`), `THEMES` (`core`), and `getPackageVersion` (`package-info.ts`, trivially movable to `core` or kept as a tiny shared util). |
| `core`           | Needs a scoping pass, not a move | See finding 1 below — the file list is now grep-verified (9 files), but nothing today groups them into one directory; they currently sit at `src/` root interleaved with SVG-renderer-only files.                                                                                                                                                                         |
| `mermaid-parser` | Needs restructuring              | See finding 2 below — `class/`, `er/`, `sequence/`, `xychart/` each currently mix parser-owned files (`parser.ts`, `types.ts`) with renderer-owned files (`layout.ts`, `renderer.ts`) in the same directory. A clean package boundary requires splitting each of these four directories, not just moving them whole.                                                      |
| `svg-renderer`   | Needs restructuring              | Depends on the same split as above (needs the renderer half of each per-type directory), plus moving `renderer.ts` (1,484 lines, currently at `src/` root) and `layout-engine/` + `elk-instance.ts` (confirmed SVG-only) into a real package tree.                                                                                                                        |
| `svg-parser`     | N/A — greenfield                 | No existing code (confirmed: no `svg` string hits suggesting an ingestion path). "Ready" only in the sense of no legacy debt to migrate; still needs to be designed from scratch, which is out of scope for this scoping pass.                                                                                                                                            |
| `cli`            | Defer                            | Recommend keeping as an app, not a published workspace package, in this first pass — see below.                                                                                                                                                                                                                                                                           |
| `demo`           | Defer                            | Same as `cli`.                                                                                                                                                                                                                                                                                                                                                            |

> **Superseded in part.** The two "Yes, mechanically" rows mean _no
> directory-splitting prerequisite_, not _no dependency prerequisite_ —
> attempting the extraction under #623 showed neither package can be
> extracted before `core` and `mermaid-parser` exist. See
> [the #623 addendum](#addendum-623--what-attempting-the-extraction-found)
> at the end of this doc, which also corrects three file classifications
> below.

Cross-cutting prep item, not package-specific: all 140 test files currently
live under `src/__tests__/`, not colocated with the source they test (zero
`.test.ts` files exist under `src/ascii/` or `src/mcp/` themselves, despite
77 and 6 files respectively in `src/__tests__/` matching those names). A
workspace split conventionally wants each package to own its own tests.
Deciding whether to move tests alongside their package or keep a shared
top-level test tree is real prep work for the follow-up plan, not something
this scoping pass resolves. **Resolved since, in
[`monorepo-test-layout-627.md`](./monorepo-test-layout-627.md)** (#627):
tests move with their package into `<package>/src/__tests__/`, discovered by
one root `vitest.config.ts`, with coverage staying a single run against a
single threshold set — and each extraction issue moves its own tests in the
same commit as its source rather than deferring to a separate sweep.

**Recommend deferring `cli` and `demo`** to real workspace packages in this
first pass, following the precedent #398 already set for the editor
("fine to keep importing internal modules via relative path, same package"
until a monorepo split happens — which is now). Neither is imported as a
library by anyone; converting them into dependency-based packages is pure
migration risk (new install/build indirection) with no current consumer
benefit. Revisit if/when something outside this repo wants to reuse
`demo/components/` or the CLI's argument-parsing/HTML-viewer pieces
independently.

This recommendation is now settled and recorded separately, with a fresh
verification of the import graph, in
[`cli-and-demo-stay-apps.md`](cli-and-demo-stay-apps.md) (#626).

### 4. Migration path: `zombie-mermaid` becomes an umbrella re-export package

Keep the `zombie-mermaid` package name, its `package.json` `exports` map
byte-identical (`.`, `./ascii`, `./mcp`), and its version stream (per the
locked-versioning recommendation above). Internally, `dist/index.js`,
`dist/ascii.js`, and `dist/mcp.js` become thin re-exports of
`@zombie-mermaid/svg-renderer`, `@zombie-mermaid/ascii-renderer`, and
`@zombie-mermaid/mcp`, declared as real `dependencies` in the umbrella's
`package.json`, resolved via the pnpm workspace during development.

These must actually be published under the org-controlled `@zombie-mermaid/`
scope, not left unscoped — an unscoped internal package name is claimable by
anyone on the public registry, letting a third party's code run during
install or import of `zombie-mermaid` itself. They must also genuinely be
published (version-locked alongside the umbrella via the changesets `fixed`
array from the locked-versioning recommendation above), not merely built
and left private: a published `zombie-mermaid` that declares an unpublished
private workspace package as a runtime `dependency` would fail to install
outside the workspace, since npm has nothing to resolve that name to. Both
constraints together mean the sub-packages are real, publicly-published,
scope-protected packages — invisible to consumers only in the sense that
nothing but the umbrella imports them directly, not in the sense of being
absent from the registry.

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

`#416` groups `class/`, `er/`, `sequence/`, `xychart/` under `mermaid-parser`
wholesale ("the per-diagram-type folders"), and implies both renderers only
ever touch a shared model produced by the parser. Grepping the actual
imports shows two things `#416` doesn't account for:

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

## Follow-up plan

Tracked as umbrella issue #620, split into one sub-issue per work item so
each can be picked up and closed independently:

- #621 — workspace tooling (recommendation 1)
- #622 — publish strategy (recommendation 2)
- #623 — extract `ascii-renderer` and `mcp` first, no prerequisites
  (recommendation 3)
- #624 — split `class/`/`er/`/`sequence/`/`xychart/` into parser/renderer
  halves and scope `mermaid-parser`'s public API (findings 1-2)
- #625 — move `layout-engine/`, `elk-instance.ts`, and the `core` files
  (recommendation 5)
- #626 — leave `cli`/`demo` as apps (recommendation 3 table); decided, see
  [`cli-and-demo-stay-apps.md`](cli-and-demo-stay-apps.md)
- #627 — decide test layout (per-package vs. shared) — **decided**, see
  [`monorepo-test-layout-627.md`](./monorepo-test-layout-627.md)

Recommended order: #623 first, then #624 before #625, #622/#621 for
workspace/publish plumbing, #626 as needed. #627 was originally listed here
as "as needed" but its decision turned out to be a precondition on #623
rather than a follow-up to it — #623 moves `src/ascii/**`, which breaks all
88 `from '../ascii/…'` specifiers in `src/__tests__/` whether or not the
tests themselves move, so where those tests land has to be settled before
#623 rewrites them. It is settled now (link above); nothing blocks #623 on
this axis.

**This order is wrong — see the addendum below.** #623 was attempted first,
per this line, and cannot complete before #625 and #624.

## Addendum (#623) — what attempting the extraction found

Written while working #623, against the tree at that point rather than the
tree this doc was written against. Three corrections, in descending order of
how much they change the plan.

### Correction 1: #623 cannot run first — the order is #625, #624, then #623

The readiness table's "Yes, mechanically" for `ascii-renderer` and `mcp` is a
statement about _directory shape_: neither needs a directory split first, the
way `class/`/`er/`/`sequence/`/`xychart/` do. It is not a statement about
_dependencies_, and the recommended order reads it as one.

Walking the real module graph from `src/ascii/index.ts` (now enforced as a
test — `src/__tests__/ascii-package-boundary.test.ts`) shows the ASCII entry
reaching 19 modules outside `src/ascii/` at runtime and 6 more at build time
through `import type`. Every one of them belongs to `core` (#625) or
`mermaid-parser` (#624). So a `@zombie-mermaid/ascii-renderer` extracted
today has nothing to declare a dependency on, and only three ways to resolve
those imports, all bad:

- reach back into the umbrella with `../../../src/…` — a directory with a
  `package.json`, not a package: unresolvable outside this repo, and it moves
  every one of those paths twice as #624/#625 land;
- depend on `zombie-mermaid` and import its internals — which requires adding
  ~19 public subpath exports to the umbrella, directly contradicting
  recommendation 4's "`exports` map byte-identical"; or
- create `core` and `mermaid-parser` first — i.e. do #625 and #624 first.

`mcp` is in the same position and worse: `src/mcp/tools/check-sequence-activations.ts`
imports `src/sequence/activation-check.ts` and `src/sequence/parser.ts`,
neither of which `src/index.ts` re-exports, so `mcp` cannot get them from
`zombie-mermaid`'s public API even in principle. It also imports
`renderMermaidSVG` from `src/index.ts` — the umbrella's own main entry, i.e.
what becomes `svg-renderer` (#625).

Revised order: **#625 (`core` + `svg-renderer`) → #624 (`mermaid-parser`) →
#623 (`ascii-renderer` + `mcp`) → #621/#622 → #626/#627.** #623 keeps its
"no prerequisite restructuring" property — it stays a move, not a
redesign — but it is the _last_ package extraction, not the first.

### Correction 2: `src/diagram-registry.ts` was an import cycle (fixed under #623)

`src/diagram-registry.ts` (#533) landed after this doc's grep and is on
neither the `core` list nor the `svg-renderer`-only list in recommendation 5.
It held both renderers' entries in one `DiagramModule`, so it imported
`renderXYChartAscii`/`renderErAscii` out of `src/ascii/` while
`src/ascii/index.ts` imported `diagramRegistry` back out of `src/` — a cycle,
benign inside one package and fatal across a package boundary.

It also had a cost already shipping: `dist/ascii.js` began with
`import "elkjs/lib/elk.bundled.js"`, because the registry dragged
`src/er/layout.ts` → `src/elk-instance.ts` into the ASCII entry's graph. That
is exactly what the `./ascii` subpath export (#300) exists to prevent, and
nothing caught it.

#623 split the table by renderer: `src/ascii/registry.ts` owns the ASCII half,
`src/diagram-registry.ts` keeps the SVG half and no longer names anything
under `src/ascii/`. Both directions are one-way now, `dist/ascii.js` has no
`elkjs` import, and `src/__tests__/ascii-package-boundary.test.ts` fails if
either edge comes back. This part of `ascii-renderer`'s prerequisites is
done regardless of what order the rest runs in.

### Correction 3: three file classifications in recommendation 5 / finding 1

Both lists in recommendation 5 were built from _direct_ `src/ascii/**`
imports. Transitively:

- **`expanded-shapes.ts`, `init-directive.ts`, `style-directives.ts` are not
  `svg-renderer`-only.** All three are imported by `src/parser.ts` — the
  flowchart parser _both_ front doors call — so the ASCII entry reaches them
  and they are in `dist/ascii.js` today. They belong with `mermaid-parser`.
  Left on the `svg-renderer` list, #625 would make `svg-renderer` a
  dependency of `ascii-renderer`.
- **Finding 1's per-type split is per-file, not per-half-pair.**
  `class/format.ts`, `xychart/colors.ts` and `sequence/box-color.ts` are in
  neither the `parser.ts`+`types.ts` half nor the `layout.ts`+`renderer.ts`
  half, and the ASCII side needs all three. `sequence/activation-check.ts`
  is a fourth such file, needed by `mcp`.
- **`core` is not type-clean.** `src/types.ts` (on the `core` list) carries
  `import type { LayoutCache } from './elk-instance.ts'`, and
  `elk-instance.ts` is on the `svg-renderer`-only list. Erased at compile
  time, so it costs the ASCII bundle nothing, but a `core` package that
  type-references `svg-renderer` is still a cycle in the type graph. #625
  has to move `LayoutCache`, re-home the field that uses it, or take the
  edge deliberately.

The boundary test carries all three as explicit, commented lists, so #624 and
#625 get a failing assertion rather than a rediscovery.

## Addendum (#625) — what performing the `core` / `svg-renderer` move found

Written while working #625, which created `packages/core/` and
`packages/svg-renderer/` and moved the files there. Recommendation 5's two
lists were built from _direct_ `src/ascii/**` imports; re-derived from the
full module graph (both front doors, plus `src/parser.ts`, which both
call), they need four corrections. #623's own addendum found three of them
independently — this is the same finding arrived at from the other side,
plus one it did not reach.

### `core` gained three files, `svg-renderer` lost four

| File                  | Recommendation 5 said | Actually                                                                                                                                     |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `init-directive.ts`   | `svg-renderer`-only   | `core` — `src/parser.ts` imports it, so the ASCII entry reaches it, _and_ `core`'s `types.ts` type-imports `InitConfig`/`CurveStyle` from it |
| `style-directives.ts` | `svg-renderer`-only   | `core` — imported by `src/parser.ts` and `src/class/*` (parser side) as well as `renderer.ts` (SVG side)                                     |
| `expanded-shapes.ts`  | `svg-renderer`-only   | neither — `src/parser.ts` is its only importer, so it stays in `src/` for #624 to take to `mermaid-parser`                                   |
| `elk-instance.ts`     | `svg-renderer`-only   | correct for the module, but its `LayoutCache` interface had to move to `core` (below)                                                        |

Left as scoped, the first two would have made `svg-renderer` a dependency of
whatever package ends up owning `parser.ts` — and, via `renderer.ts`'s own
imports of them, of the umbrella. That is the cycle this split exists to
avoid, and it would only have surfaced at #623.

### Two symbols had to move, not just files

Both are cases where a file's _location_ was right but one export in it
pointed the wrong way across the new boundary:

- **`isDirection`** was defined in `src/parser.ts` and used by
  `direction-override.ts`, which is `core` and reached from the ASCII entry.
  Left there, `core` would import `mermaid-parser`. It now lives in
  `packages/core/src/direction.ts`; `parser.ts`, `cli/parse-args.ts` and the
  parser's own tests import it from `core`.
- **`LayoutCache`** was declared in `elk-instance.ts` (`svg-renderer`) and
  referenced by `RenderOptions.layoutCache` in `types.ts` (`core`) — the
  type-graph cycle #623's addendum flagged as "#625 has to move
  `LayoutCache`, re-home the field that uses it, or take the edge
  deliberately". The interface moved to `core`'s `types.ts` (its only
  external reference is a type-only `ElkNode`, erased before bundling) and
  `elk-instance.ts` re-exports it, so every function that builds or reads a
  cache stays in `svg-renderer`.

`src/__tests__/workspace-package-boundaries.test.ts` walks what both
packages actually import and fails if either edge returns, so #623 and #624
get an assertion rather than a rediscovery.

### One deferral, deliberate

The two packages are `"private": true` and are bundled into the umbrella's
`dist/` (they are absent from `vite.config.lib.ts`'s `isExternal`), so they
are not runtime `dependencies` of the published `zombie-mermaid` and
recommendation 4's "they must genuinely be published" constraint does not
bind yet — it binds the moment the umbrella's entries become thin
re-exports rather than bundles. Until then the umbrella declares them as
`devDependencies`, and api-extractor is told to inline their declarations
(`bundledPackages` plus a `paths` override pointing at the per-file `.d.ts`
this build already emits, since nothing builds these packages yet). #621 and
#622 are where that becomes real; `writeDctsTwins` fails the build if a
`@zombie-mermaid/*` specifier ever survives into a published `.d.ts` in the
meantime.

## Addendum (#624) — what performing the `mermaid-parser` split found

Written while working #624, which created `packages/mermaid-parser/` and
split each of `class/`, `er/`, `sequence/`, `xychart/` into it (the parser
half) and `packages/svg-renderer/` (the renderer half, joining the files
#625 already put there). Finding 1's per-file list (not per-half-pair) held
exactly as documented — `class/format.ts`, `xychart/colors.ts`,
`sequence/box-color.ts` went to `mermaid-parser` alongside each directory's
`parser.ts`/`types.ts`, and `sequence/activation-check.ts` (needed by `mcp`,
per #623's addendum correction 3) joined them for the same reason.

### A third symbol had to move: `toDirection`

Same shape as `isDirection`'s move under #625, one level down the
dependency chain: `toDirection` lived in `src/parser.ts` with that file as
its only caller, until `er/parser.ts` — now in `mermaid-parser` — became a
second caller that cannot import the umbrella's `src/parser.ts` without
`mermaid-parser` depending on one of its own consumers. It moved to
`packages/core/src/direction.ts` alongside `isDirection`; `src/parser.ts`
re-exports it for backward compatibility. Neither `expanded-shapes.ts` nor
`src/parser.ts` itself needed to move — #624's scope is the four per-type
directories only (finding 1), and flowcharts already have the
shared-`MermaidGraph`-model shape finding 2 contrasts them against.

### `svg-renderer` gained one dependency, deliberately

`layout.ts`/`renderer.ts` in each of the four types used to reach their
directory's own `types.ts` (for `Positioned*` types), and `class/layout.ts`
additionally reached `format.ts` (`formatClassMember`) and
`xychart/renderer.ts` reached `colors.ts` (`getSeriesColor`,
`CHART_ACCENT_FALLBACK`) — all by relative import within the same
now-split directory. Every one of those became a type-only or value import
from `@zombie-mermaid/mermaid-parser` instead. This is the "ordinary,
acyclic dependency" finding 2 predicted (`svg-renderer` and the future
`ascii-renderer` both depend on `mermaid-parser`, neither depends on the
other) rather than a new cycle — `src/__tests__/workspace-package-boundaries.test.ts`
now asserts `mermaid-parser` stays a sink exactly like `core`, and that
`svg-renderer`'s only workspace dependencies are `core` and
`mermaid-parser`.

## Addendum (#767) — the `ascii-renderer`/`mcp` move #623 closed without doing

#623 was closed via [PR #644](https://github.com/dfadler/zombie-mermaid/pull/644),
but that PR only did the cycle-removal prerequisite described in its own
"Correction 2" above (splitting `src/diagram-registry.ts` so the umbrella's
SVG dispatch and `src/ascii/index.ts` stopped importing each other) — the
actual package move never happened. #767 tracked that discrepancy and
performs the move this addendum documents: `src/ascii/**` to
`packages/ascii-renderer/`, `src/mcp/**` to `packages/mcp/`, following the
revised order Correction 1 above settled on (last, after `core`,
`mermaid-parser`, and `svg-renderer` existed to depend on).

Both packages mirror the sibling three exactly: `"private": true`,
`exports: { ".": "./src/index.ts" }`, `files: ["src/"]`. Actual publishing
stays out of scope (#769), same as it does for `core`/`mermaid-parser`/
`svg-renderer` today.

**Two relative back-references into the un-packaged umbrella, both
deliberate, both already documented before this move landed.** Neither
`src/parser.ts` (the flowchart/state parser) nor `src/expanded-shapes.ts`
became a workspace package under #624 — see that issue's addendum above —
and `src/index.ts`'s own `renderMermaidSVG` dispatch never did either. Three
imports cross the new package boundary by relative path rather than a bare
`@zombie-mermaid/*` specifier, unavoidably:

- `packages/ascii-renderer/src/flowchart.ts` imports `parseMermaid` from
  `../../../src/parser.ts` (previously `../parser.ts`, before the move).
  `src/__tests__/ascii-package-boundary.test.ts`'s `ALLOWED_OUTSIDE_ASCII`
  already allow-listed this exact edge; only its `ASCII_ENTRY` path and the
  test's own `outside()` filter needed updating to point at the file's new
  location.
- `packages/mcp/src/server.ts` imports `getPackageVersion` from
  `../../../src/package-info.ts` (previously `../package-info.ts`).
- `packages/mcp/src/tools/render-svg.ts` imports `renderMermaidSVG` from
  `../../../../src/index.ts` (previously `../../index.ts`) — the umbrella's
  own SVG dispatcher was never folded into `svg-renderer` (that package is
  rendering primitives and the ELK layout engine, not the per-type
  dispatch), so this one was never going to become a bare specifier.

None of these are cycles: the umbrella depends on both new packages (via
`src/index.ts`'s `export … from '@zombie-mermaid/ascii-renderer'` and
`src/cli/mcp.ts`'s `import { createMcpServer } from '@zombie-mermaid/mcp'`),
and neither package is ever imported by anything upstream of the two files
it reaches into.

**One real, new inter-package edge:** `packages/mcp/src/tools/render-ascii.ts`
previously reached `src/ascii/index.ts` by relative path
(`../../ascii/index.ts`); now that `ascii-renderer` is a real sibling
package, that import became the bare specifier
`@zombie-mermaid/ascii-renderer`, and `packages/mcp/package.json` declares
it as a `workspace:*` dependency alongside `core` and `mermaid-parser`. This
is the ordinary, acyclic shape finding 2 already described for
`svg-renderer`'s dependency on `mermaid-parser` — `ascii-renderer` doesn't
depend on `mcp` back.

**Test files did not move.** Despite `monorepo-test-layout-627.md`'s
decision to move each package's tests into `<package>/src/__tests__/`,
neither #624 nor #625 actually did that in practice — `core`,
`mermaid-parser`, and `svg-renderer`'s tests are all still under
`src/__tests__/`, with only their import specifiers rewritten to the bare
`@zombie-mermaid/*` form. #767 mirrors that actual precedent, not the
decision doc's on-paper one: the 88 ASCII and 5 MCP test files stayed in
`src/__tests__/`, and every relative specifier reaching into the moved
source was rewritten to either the bare package specifier (for anything
`packages/ascii-renderer/src/index.ts`'s curated public API already
exported) or a recomputed relative path into `packages/ascii-renderer/src/`
directly (for the many unit tests that reach ascii-renderer's internal
modules — `canvas.ts`, `grid-occupancy.ts`, `pathfinder.ts`, and so on —
which the package's narrow index does not re-export, unlike
`mermaid-parser`'s `export *`-everything index). Reconciling the doc with
what actually happened across all three prior extractions is worth its own
follow-up; not done here.
