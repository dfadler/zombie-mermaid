# Slim ASCII entry points: where does per-type splitting live?

Status: proposal (reframed 2026-10-30; size work moves to the terminal package, #2457)

Tracks [#2086](https://github.com/dfadler/zombie-mermaid/issues/2086), under
[#1502](https://github.com/dfadler/zombie-mermaid/issues/1502) and the
objective in [project-objective-1564.md](project-objective-1564.md). This doc
records the measurements and the cheapest way to get the size win; it changes
no code, export map, budget or policy. Everything under "Maintainer questions"
is the maintainer's call. No code ships with this doc: the first useful code
step edits `packages/ascii-renderer/src/index.ts`, which other open work also
touches (see "Order of PRs").

**Reframe (maintainer, 2026-10-30).** The ascii package's trajectory does not
change: `@zombie-mermaid/ascii-renderer` stays the best reproduction of Mermaid
that the ASCII/Unicode target can support, and it is not split into slim
subpaths. Slim, per-type and width-limited output belongs to the separate
terminal package ([#2457](https://github.com/dfadler/zombie-mermaid/issues/2457),
a child of [#2144](https://github.com/dfadler/zombie-mermaid/issues/2144);
unscheduled). #2086's "no second package" goal predates that. The measurements
below hold either way and are kept as input to the terminal package.

## Context

A consumer that needs one diagram type still ships all eight, because
`renderMermaidASCII` dispatches through `asciiRegistry`, a
`Record<DiagramType, AsciiRenderer>` that statically imports every renderer
(`packages/ascii-renderer/src/registry.ts`, call site
`packages/ascii-renderer/src/index.ts`). Tree-shaking, barrels and
`"sideEffects": false` already work; the registry is the only remaining lever
([#2271 findings](https://github.com/dfadler/zombie-mermaid/issues/2271#issuecomment-6346544372),
cited here, not repeated). The issue body sets the goal (written before the
terminal-package direction, see the reframe above): no second package, no
fork, and `renderMermaidASCII` stays synchronous, because a lazy registry
would make it async, which is a major (versioning policy, section 1, "Changes
error behaviour" and "Removes ... an export" rows; #2271 breaking-change note).
So the choice is additive subpaths, opt-in registration, or nothing.

## Measurements (main at 507a2263, v5.12.0)

Method: consumer bundle of `export { renderMermaidASCII }` from
`packages/ascii-renderer/src/index.ts`, built with Vite 8 (rolldown,
`minify: { compress, mangle, codegen: true }`, the same settings as
`vite.config.package.ts`), workspace packages resolved from source via
tsconfig paths, `elkjs` and `node:*` external, gzip level 9. Each row replaces
`registry.ts` through a load hook with a table that keeps only the listed
types (the others become throwing stubs); the repo is untouched. Core and
mermaid-parser are inside the number, as they are in a consumer's bundle.

| registry contents      | minified B | gzip B | vs full |
| ---------------------- | ---------: | -----: | ------: |
| all eight (today)      |    273,145 | 92,096 |       - |
| pie only               |     22,408 |  9,663 |  -89.5% |
| xychart only           |     27,777 | 11,082 |  -88.0% |
| c4 only                |     34,884 | 14,199 |  -84.6% |
| sequence only          |     38,340 | 14,346 |  -84.4% |
| er only                |     37,993 | 14,792 |  -83.9% |
| architecture only      |    147,662 | 49,890 |  -45.8% |
| flowchart only         |    161,526 | 53,929 |  -41.4% |
| class only             |    179,040 | 60,533 |  -34.3% |
| flowchart + sequence   |    181,676 | 60,411 |  -34.4% |
| flowchart + class + er |    212,626 | 71,146 |  -22.7% |

Cross-checks:

- The shipped `dist/` gives the same full figure: a consumer bundle of
  `renderMermaidASCII` from `@zombie-mermaid/ascii-renderer` or
  `zombie-mermaid/ascii` is 273,422 B minified, 92,248 B gzip
  (`bundleSource` from `scripts/vite-bundle.ts`). The overlay model is therefore
  within 0.2% of what ships.
- Flowchart-only 53.9 KB agrees with #2271's 54.2 KB (esbuild); the current -41.4% is
  consistent with that comment's historical -42.8%. The issue's 5.3.0 baseline (80 KB full, 44.7 KB flowchart)
  has grown to 92 KB and 54 KB with the code.
- SVG has the same shape (#2271: 86.7 KB to 42.7 KB gzip, -51%, flowchart-only).
  Not re-measured here; `svg-renderer/src/registry.ts` is out of #2086's
  scope as written (see question 4).
- Budgets today (`pnpm exec tsx scripts/check-bundle-size.ts` after
  `pnpm run build`): `packages/ascii-renderer/dist/index.js` 70,228 B of
  70,300 (0.1% headroom), unpacked `packages/ascii-renderer/dist` 426,231 B of
  427,100 (0.2%). Any new entry needs a budget row, and the unpacked budget
  must be raised or the new files will fail the gate on day one.

What the table says: the large wins are on the **five types that do not use the
flowchart grid** (pie, xychart, c4, sequence, er: -84% to -90%, 10 to 15 KB
each). `class` and `architecture` reuse the flowchart grid, edge routing and
drawing stack (`class-flow.ts`; `architecture.ts` lowers to `renderGraphAscii`),
so a class-only entry saves 34% and an architecture-only entry saves 46%, and
neither is meaningfully smaller than flowchart-only. The issue's own example,
flowchart + sequence, saves only 34%, because flowchart is the 54 KB part.
Flowchart + sequence is therefore not a case worth a dedicated entry: it is the
two subpaths used together (see "Duplication").

## Where this fits the terminal-package direction

Decided: the size work goes to the terminal package (#2457), not to
`ascii-renderer`. #2086 is held with no code until that package starts, and no
consumer is blocked in the meantime (the default entry is unchanged). The
design below is retained as a record of what was costed, and as a starting point
for the terminal package's per-type layout, not as a plan for `ascii-renderer`.

## Subpath design (costed, not planned for ascii-renderer)

**Additive subpath exports on `@zombie-mermaid/ascii-renderer`, each its own
self-contained build; the default entry is unchanged.** Rejected: a lazy
registry (async, major), an opt-in `registerDiagram()` on the default entry
(the default entry would still carry all eight renderers unless registration
moved out of it, which is a different, breaking default), and "do nothing"
(maintainer chose to proceed on #2086; the saving is measured, not
speculative).

### Layout

| subpath on `@zombie-mermaid/ascii-renderer` | registers                                          |                           measured gzip (consumer bundle) |
| ------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------: |
| `.` (unchanged)                             | all eight                                          |                                                    92,096 |
| `./flowchart`                               | `flowchart` and `architecture` (lowered)           | 55,137 (flowchart + architecture; flowchart alone 53,929) |
| `./sequence`                                | `sequence`                                         |                                                    14,346 |
| later: `./er`, `./c4`, `./xychart`, `./pie` | one type each                                      |                                           9,663 to 14,792 |
| `./class`                                   | not proposed: saves 34%, pulls the flowchart stack |                                                    60,533 |

Each subpath exports the same `renderMermaidASCII` name and options type as the
default entry, built from one shared factory (`createRenderMermaidASCII(table)`
extracted from today's function body, which `index.ts` calls with
`asciiRegistry`). Input of a type the entry does not register throws an error
that names the type and the entry that handles it (`import ... from
'@zombie-mermaid/ascii-renderer'`). A state diagram is `flowchart` type, so
`./flowchart` renders it.

Why the slim tables live in the entry files and not in a split of
`registry.ts`: the table is eight lines and the cost is in what it imports, so
a slim entry that imports only its renderers needs no registry change at all.
The issue's child "split `registry.ts` so importing one renderer does not pull
the rest" is therefore not a prerequisite, and skipping it avoids the file other
agents edit. The price is that the list of types is stated in two places (the
default table and each slim entry). The parity test below, plus a
`Record<DiagramType, ...>`-typed default table, catches a new type added to one
and not the other.

### Build and export map

Precedent, verified in `config/vite.config.lib.ts`: the umbrella already ships
three public entries (`.`, `./ascii`, `./mcp`) as one rolldown environment per
entry, each fully self-contained with no shared chunk, plus one multi-entry
`types` environment whose bundled `.d.ts` files are moved to `shared/` and
stubbed (`writeSharedTypes`). `definePackageBuild` in `vite.config.package.ts`
is single-entry by design (it throws if a bundled `.d.ts` has a relative
import, and expects exactly one `.d.ts`). Subpaths on a sub-package therefore
need that factory to grow additional entries, copying the umbrella's pattern.
This is a shared build file used by five packages, so it is its own PR.

`exports` gets one block per subpath with the same `import`/`require`/`types`
shape as `.`. `pnpm run smoke:packed` (`scripts/smoke-test-packed.mjs`) and
publint/attw must cover each new path; `smoke:packed` currently lists only
`zombie-mermaid`, `/ascii` and `/mcp` (line 128).

### Duplication

Per-entry self-contained builds repeat the shared ascii-renderer internals
(canvas, grid, display-width) in each file. `@zombie-mermaid/core` and
`@zombie-mermaid/mermaid-parser` stay external in the package build
(`isExternal` bundles only local source), so only ascii-renderer's own code is
repeated. A consumer importing both `./flowchart` and `./sequence` pays at most
53,929 + 14,346 = 68,275 B gzip by the table's numbers (which include core and
parser in each), against 60,411 B for a single two-type registry: an upper
bound of about 7.9 KB of overlap, in practice less. Nobody who needs both is
worse off than today's 92 KB. Not measured: the real overlap from built
subpath files; PR 2 measures it. A shared chunk would remove it but is the
design the umbrella build deliberately avoids (no runtime chunk between public
entries).

Unpacked size: `dist/` ships ESM and CJS of every entry. The default entry is
about 205 KB per format today, so two slim entries add roughly 135 to 165 KB
per format by proportion (flowchart about 60% of full, sequence about 16% of
full, by gzip share). Across ESM and CJS that is roughly 270 to 330 KB, about
63 to 77% of the 427,100 B unpacked budget. This is a rough estimate, not a
measurement. Question 3.

## Order of PRs

1. **This doc.** No code. Everything below is held until the terminal package (#2457) starts; it is the costed sequence, not a schedule.
2. **Factory extraction, no behaviour change.** Move the body of
   `renderMermaidASCII` into `createRenderMermaidASCII(table)`; `index.ts` calls
   it with `asciiRegistry`. Touches `index.ts` (which carries the limits,
   accessibility-strip and theme-merge steps), not `registry.ts` or any
   renderer. Byte-identical output across `samples/` is the acceptance check.
   Open work in the same file: [#2119](https://github.com/dfadler/zombie-mermaid/pull/2119)
   (`maxWidth`, held until 2026-11-09), so merge `main` into the branch rather
   than rebasing, or land after it.
3. **Build support for extra entries in `definePackageBuild`**, driven by
   `./sequence` only (smallest type, cleanest test of the build). Adds the
   export-map block, `smoke:packed` coverage, a budget row in
   `scripts/bundle-size-budget.json`, the parity test (every sample of the type
   renders identically through the subpath and through the default entry, ESM
   and CJS), and raises the unpacked budget with the measured number.
4. **`./flowchart`** (also registers `architecture`). Reuses 3; adds its
   budget and parity rows.
5. **`./er`, `./c4`, `./xychart`, `./pie`** one PR each or one batch; each is a
   few lines plus a budget and parity row once 3 exists.
6. **Adopt and document**: `docs/api-reference.md`, a short "pick an entry"
   table in the ascii-renderer README, and a decision on the umbrella
   (`zombie-mermaid/ascii/flowchart` would be a fourth block in
   `config/vite.config.lib.ts`). Site/demo use of a slim entry only if a
   measurement of what the site ships says it helps (an open child of #2086).

New diagram types ([#2436](https://github.com/dfadler/zombie-mermaid/pull/2436),
quadrantChart, is open) each add one registry row and now also one decision:
whether they get a subpath. Proposed default: yes if they do not use the
flowchart stack, otherwise reachable only through `.` until asked for.

Collision note: PRs 2 and 3 do not edit `registry.ts` or
`packages/ascii-renderer/src/shapes/`, so work such as ASCII node shapes
([#2164](https://github.com/dfadler/zombie-mermaid/issues/2164)) does not
conflict with them. It changes the size of the flowchart entry, which the
budgets absorb (they are set from measurement plus 2%, per CONTRIBUTING.md).

## Interaction with policy

- **Lockstep versioning** ([lockstep-versioning.md](lockstep-versioning.md)).
  New subpaths on one package still release all seven at one number, with a
  `minor` changeset naming `@zombie-mermaid/ascii-renderer`. Nothing in the
  proposal needs independent versions, and per-type separate packages (the
  "Direction, not a decision" under "New diagram types" in the project
  objective) are not required: subpaths give the size win without multiplying
  the manual npm trusted-publishing setup or the `fixed` group. If per-type
  packages are ever chosen, subpaths can later become re-exports of them.
- **Semver** (versioning policy section 1). New exports are additive: minor.
  The default entry's signature, sync behaviour and error behaviour are
  unchanged, so nothing here is major or needs the 2026-11-09 gate. The slim
  entry's throw on an unregistered type is new surface, not newly-throwing
  input on an existing path. Once published, a subpath is in `exports`, so
  removing or renaming it is major; that is the cost of adding one, and the
  reason to start with two.
- **Oracle and support policy** ([project-objective-1564.md](project-objective-1564.md)).
  A slim entry is the same renderer, so the layout oracle (flowchart, state,
  class, ER) and the "a type is supported only when it has an SVG renderer, an
  ASCII path and an oracle" definition are unchanged and not extended. The
  parity test is what keeps "ASCII fidelity per type" true across entries: a
  subpath must render byte-for-byte what `renderMermaidASCII` renders for that
  type. Support stays "latest major only"; Node `>=24`
  ([consumer-node-floor-1567.md](consumer-node-floor-1567.md)) applies to the
  new entries unchanged. The issue's open question, whether a flowchart-only
  entry conflicts with ASCII/SVG parity per type, is answered: no, because
  parity is a property of the renderers, which are not duplicated or forked.
  Slim entries do not decide the terminal-package "Direction, not a decision"
  in the objective, but they do add public surface that direction would have to
  absorb; hence the decision to build them in the terminal package instead.

## Self-review checklist

Run against this draft ([decision-doc-self-review-checklist-977.md](decision-doc-self-review-checklist-977.md)).

- **Degenerate inputs.** Empty or non-diagram text: `detectDiagramType` never
  returns an unknown type: unrecognized or empty text falls back to
  `flowchart` (`packages/core/src/diagram-type.ts`). So the default entry sends
  it to the flowchart renderer, and `./sequence` receives an unregistered
  `flowchart` input and raises the slim entry's new dispatch error (named type
  plus the entry that handles it). Detection is shared; that error is new
  surface. PR 2's tests assert both for empty input. A single-type table (`./sequence`) is the base case measured
  above. Mixed content (a sequence diagram sent to `./flowchart`) throws with
  the entry hint; a state diagram sent to `./flowchart` is `flowchart` type and
  renders. `architecture` is lowered to a flowchart, so `./flowchart` must
  register it; `architecture only` (49,890) is measured but is not an entry.
- **Boundary arithmetic.** Percentages are `1 - slim/full` on gzip bytes, to one
  decimal, from the table (for example 1 - 53,929/92,096 = 41.4%). The
  upper-bound overlap 68,275 - 60,411 = 7,864 B is gzip of two separately
  gzipped sums, not of a union, so it is an approximation. The unpacked-size
  range is a proportion estimate, labelled as one.
- **Ambiguous terms.** "Slim entry" means a subpath whose registry holds fewer
  than eight types. "Size" means gzip level 9 of a minified consumer bundle
  including core and mermaid-parser, not the `dist/` file size the budgets gate
  (`budgets` is dist file gzip, `consumerBundles` is the consumer bundle,
  `unpackedBudgets` is unpacked bytes).
- **Sub-issue scope claims.** "Split `registry.ts`" is not required here, see
  above; the claim rests on slim entries owning their own tables, and PR 2 is
  the check. "Parity test per subpath" is also where a type added to the default
  table but not a slim one would surface, which the doc relies on and has not
  yet been written.
- **Cited precedent.** Opened and confirmed: the one-environment-per-entry and
  no-shared-chunk design and the `shared/` `.d.ts` stubbing in
  `config/vite.config.lib.ts`; the single-entry assumptions in
  `vite.config.package.ts`; policy sections in
  `versioning-and-deprecation-policy-1568.md`; the "Direction, not a decision"
  paragraphs in `project-objective-1564.md`; #2271's figures (reproduced above
  to within 1%).

## Maintainer questions

1. **Order against the terminal package.** Answered 2026-10-30: size work waits
   for the terminal package (#2457); `ascii-renderer` keeps its trajectory and
   gets no subpaths. Questions 2 to 5 are carried to that package.
2. **Is `./flowchart` worth its 54 KB, or only the five small types?** The
   small types save 84 to 90%; flowchart saves 41%. Proposed: both, small types
   first as the cheapest proof of the build.
3. **Unpacked-size cost.** Subpaths add an estimated 63 to 77% (rough) to the
   ascii-renderer tarball. Accept it and raise `unpackedBudgets`, or ship
   subpaths ESM-only (a policy change; the package ships CJS today)? Proposed:
   accept it and measure in PR 3.
4. **SVG side.** #2271 measured -51% for a flowchart-only SVG registry and
   asked that #2086's decision cover `svg-renderer/src/registry.ts`. Proposed:
   decide the pattern here, build ASCII first, and open the SVG equivalent as a
   separate child once PR 3 shows the build change works.
5. **Umbrella subpaths** (`zombie-mermaid/ascii/flowchart`). Proposed: after
   the sub-package ships, if a consumer of the umbrella asks.

## Reproduction

```sh
pnpm install --frozen-lockfile && pnpm run build
pnpm exec tsx scripts/check-bundle-size.ts          # budgets and consumer bundles
```

The per-type table comes from a throwaway script (not committed, so it does not
become a maintained tool): Vite `build()` with `resolve.tsconfigPaths`, a
`load` hook that returns, for `packages/ascii-renderer/src/registry.ts`, a table
importing only the chosen renderers (and `() => { throw }` for the rest), a
virtual entry `export { renderMermaidASCII } from '.../src/index.ts'`,
`rolldownOptions: { external: ['elkjs', /^node:/], output: { codeSplitting:
false, minify: { compress: true, mangle: true, codegen: true } } }`, then
`gzipSync(code, { level: 9 })`. Run on Node 22 locally (the repo wants 24;
sizes are a model, CI is authority for budgets). Rerun it before PR 3 and put
the numbers in the PR.
