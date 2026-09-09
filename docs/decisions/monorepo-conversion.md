# Monorepo conversion: current status and the remaining publish-strategy decision

## A note on scope, before the rest of this document

This doc was requested as a pre-implementation proposal synthesizing #416,
#620, #621, and #622 — written as if the split were still a future decision,
with the repo owner reviewing it before any code executed the plan.

That premise no longer matches the tree. As of this writing (main at
`969d90e`), the split is **substantially done**:

- `packages/core`, `packages/mermaid-parser`, and `packages/svg-renderer`
  already exist and are populated (#625, #624 — both closed, both merged:
  PR #654 extracted `core`/`svg-renderer`, PR #683 split `class`/`er`/
  `sequence`/`xychart` into `mermaid-parser` and `svg-renderer`).
- `cli` and `demo` staying as apps, not packages, is decided and recorded
  (#626, closed — see
  [`cli-and-demo-stay-apps.md`](cli-and-demo-stay-apps.md)).
- Test layout (tests move with their package, one shared root Vitest
  config, centralized coverage) is decided and implemented (#627, closed —
  see [`monorepo-test-layout-627.md`](monorepo-test-layout-627.md);
  `tsconfig.json` and `vitest.config.ts` already include `packages/*/src`).
- All of this is already documented in exhaustive, ground-truthed detail in
  [`monorepo-conversion-scoping.md`](monorepo-conversion-scoping.md) (from
  PR #558) and its three addenda, written while each extraction actually
  happened. That doc is the authoritative record of *how* the split was
  done and *why* the boundaries ended up where they did — this doc does not
  repeat that derivation.

So rewriting a "should we do this" proposal from scratch would misrepresent
the codebase and duplicate work that's already been done more carefully than
a retrospective pass could redo it. Instead, this doc:

1. States plainly where the split actually stands, including one
   discrepancy worth the repo owner's attention (below).
2. Covers the one part of #416/#620's scope that is **not yet decided or
   built**: the publish strategy (#622), which is the actual open,
   pre-implementation decision left in this epic.
3. Gives a concrete recommendation and open questions for #622, plus what's
   left to close out #621.

Relates to #416, #620, #621, #622 — proposing how to finish the remaining
piece, not resolving any of them.

## Discrepancy worth flagging: #623 looks closed but its extraction isn't done

#623 ("extract `ascii-renderer` and `mcp`") is closed, via PR #644. Reading
that PR's title — "decouple the ASCII renderer from the umbrella registry
(#623 prerequisite)" — and the tree itself confirms it did the
*prerequisite* work the scoping doc's addendum called out (removing the
`diagram-registry.ts` ↔ `src/ascii/registry.ts` import cycle), not the
actual package move. `src/ascii/**` and `src/mcp/**` are both still at the
top of `src/`, not under `packages/ascii-renderer/` or `packages/mcp/`.

This isn't a blocker for the publish-strategy decision below (nothing in
#622 depends on ascii/mcp having moved), but it means #620's "5/7 sub-issues
complete" is optimistic by one: the actual package split is 3 of 5 planned
packages (`core`, `mermaid-parser`, `svg-renderer`), not 5. Worth either
reopening #623 for the remaining move or filing a fresh issue for it — not
something this ADR resolves, since the goal here is the publish decision,
not doing more extraction.

## Package boundaries as they exist today

Grounded in the current tree, not the original proposal:

| Package | Location | Status |
| --- | --- | --- |
| `core` | `packages/core/` | Extracted, `"private": true`, version `2.2.0` |
| `mermaid-parser` | `packages/mermaid-parser/` | Extracted, `"private": true`, version `2.2.0` |
| `svg-renderer` | `packages/svg-renderer/` | Extracted, `"private": true`, version `2.2.0` |
| `ascii-renderer` | still `src/ascii/` | Not extracted (see discrepancy above) |
| `mcp` | still `src/mcp/` | Not extracted |
| `svg-parser` | doesn't exist | Greenfield, out of scope for the split itself |
| `cli` | `src/cli.ts`, `src/cli/` | Stays an app (#626, decided) |
| `demo` | `demo/`, `editor/` | Stays an app (#626, decided) |

Residual at `src/` root, not yet assigned to any package: `browser.ts`,
`diagram-registry.ts`, `expanded-shapes.ts`, `index.ts`, `package-info.ts`,
`parser.ts`. One of these is a live boundary issue: `expanded-shapes.ts`
sits in `src/`, but `packages/core/src/types.ts` and
`packages/svg-renderer/src/renderer.ts` both import it — meaning two
already-extracted workspace packages currently reach *back out* of
`packages/` into the umbrella's own `src/` tree. That's the same shape of
problem the scoping doc's addenda kept finding and fixing (a package
depending on something that hasn't moved into a package yet); it's just not
fixed for this one file yet. It's exactly the kind of item #624's addendum
predicted would surface — `expanded-shapes.ts` was called out there as
belonging with `mermaid-parser` — but the move hasn't happened. Not this
doc's job to fix, but worth naming so whoever reopens/finishes #623 (or a
`mermaid-parser` follow-up) doesn't rediscover it.

## Workspace tooling (#621): mostly done, still open for a real reason

`pnpm-workspace.yaml` already has a `packages:` list (`.` and `packages/*`),
and both `tsconfig.json` and `vitest.config.ts` already widen their
`include`/`coverage.include` to cover `packages/*/src`. The scoping doc's
recommendation — plain pnpm workspaces, no Turborepo/Nx — is implemented for
that half of #621.

The other half of #621's own description — "use plain `pnpm --filter`/`pnpm
-r` for cross-package scripts" — is not yet true of anything in this repo.
Checked directly: no script in `package.json` and no `.github/workflows/*`
step uses `pnpm -r` or `pnpm --filter`. Every build, test, lint, and
typecheck command still runs once from the root, covering `src/**` and
`packages/*/src/**` as one program (`vite build --app --config
vite.config.lib.ts` bundles `packages/*` into the umbrella's own `dist/`
per `vite.config.lib.ts`'s `isExternal` handling — see the scoping doc's
addendum on #625). That single-root-command approach is consistent with the
#627 test-layout decision (one shared Vitest config, not per-package ones)
and hasn't caused any actual pain yet — no package needs an independent
build or a different environment.

**Recommendation for #621**: don't add `pnpm -r`/`--filter` usage
speculatively. Nothing in the repo needs per-package script invocation right
now, and adding it without a driving need just adds a second way to run the
same commands. Revisit — using the same trigger the scoping doc already set
for Turborepo/Nx — when a package genuinely needs its own build step
independent of the umbrella's `vite.config.lib.ts` (which is exactly what
happens the moment #622's "genuinely published" packages land, below). Until
then, close #621 as done for the `packages:`-list half, or leave it open
specifically tracking "add cross-package script usage when #622 needs it" —
either is reasonable, but leaving it open with its current description
implies work that may never be needed.

## Publish strategy (#622): the actual remaining decision

This is the one piece of #416/#620's scope that hasn't been decided *or*
built. Current state: `.changeset/config.json`'s `fixed` array is still
empty (`[]`), and none of `core`/`mermaid-parser`/`svg-renderer` are
declared as runtime `dependencies` anywhere — they're `"private": true` and
bundled straight into the umbrella's `dist/index.js` etc. by
`vite.config.lib.ts`. In other words: **nothing has shipped that depends on
#622's decision being made**, which is exactly the situation a
pre-implementation ADR is supposed to catch before code executes on top of
an undecided call.

### What #622 concretely means for this repo

1. **Keep publishing exactly one npm package: `zombie-mermaid`.** No change
   to what a consumer installs or imports (`zombie-mermaid`,
   `zombie-mermaid/ascii`, `zombie-mermaid/mcp` stay the public API).
2. **Populate `.changeset/config.json`'s `fixed` array** with every
   workspace package name once they're real, versioned packages —
   `@zombie-mermaid/core`, `@zombie-mermaid/mermaid-parser`,
   `@zombie-mermaid/svg-renderer`, and (once extracted) `@zombie-mermaid/ascii-renderer`
   and `@zombie-mermaid/mcp` — so a change to any one of them bumps all of
   them together, preserving today's single-version, single-CHANGELOG
   behavior.
3. **`dist/index.js`, `dist/ascii.js`, `dist/mcp.js` become thin re-exports**
   of the internal packages instead of bundling their source directly. This
   is the part that actually changes the build: `vite.config.lib.ts`'s
   `isExternal` currently treats `packages/*` as internal (bundled); making
   them real dependencies means externalizing them instead, and each
   internal package needs its own build output for the umbrella to depend
   on.
4. **Internal packages publish under the `@zombie-mermaid/` npm scope**,
   not unscoped — an unscoped name (`core`, `mermaid-parser`, etc.) is
   claimable by anyone on the public registry, and a published
   `zombie-mermaid` that declares an unscoped runtime dependency would be a
   supply-chain risk (arbitrary code from whoever claims that name first
   runs on install). They must be **genuinely published**, not merely built
   and left `"private": true` — a published `zombie-mermaid` with a
   `dependency` on an unpublished private package fails to install outside
   this workspace, since npm has nothing to resolve that name to.

### Do I agree this is the right call?

Yes, on the first three points, for the same reason the scoping doc gives:
nothing outside this repo depends on `core`/`mermaid-parser`/`svg-renderer`
directly today, only on the umbrella's three existing exports. Publishing
them independently (separate versions, separate changelogs) would be new
surface area with a real cost — `RELEASING.md`'s documented npm trusted
publishing (OIDC) is a manual, maintainer-only, per-package setup step, so
five independently-versioned packages means five times that setup and a
release-ordering problem — for zero current consumer benefit. Version-locked
via `fixed`, single npm listing, is the boring and correct choice here.

On the fourth point (`mcp`'s own npm name), I'd lean toward **not** giving
it one in this pass, but it's genuinely closer to a coin flip than the rest
of #622, and the issue is right to flag it as the repo owner's product call
rather than a technical one:

- **For a separate `zombie-mermaid-mcp` (or scoped equivalent) package:**
  MCP server tooling conventions (Claude Desktop config, `npx`-based
  installs documented in most MCP server READMEs) favor a directly
  `npx`-able package whose name says what it is. A user configuring an MCP
  client doesn't want to know it's a subpath of a diagram-rendering library.
- **Against it, for now:** the same cost-multiplication argument as above —
  it's a second published artifact with its own trusted-publishing setup
  and its own version-ordering question, and `src/mcp/` today has exactly
  one way to install it (`zombie-mermaid`'s `./mcp` export, or its `bin`
  entry via the CLI). Nothing in the current issue tracker or README
  suggests existing friction from users trying and failing to install just
  the MCP piece. Standing up a second published package to solve a problem
  nobody has reported yet is the same "no current consumer benefit" argument
  #622 already uses to reject splitting the other four packages.

Recommendation: **ship #622 without a separate `mcp` package first**, and
revisit if/when someone actually asks for standalone `npx zombie-mermaid-mcp`
install (a concrete, checkable trigger, same pattern the scoping doc uses
elsewhere in this epic). Reversing this later — giving `mcp` its own name
once it's already a workspace package — is a small, additive change, not a
rearchitecture; nothing about publishing it single-listed now forecloses
that option.

## Migration risks (mostly realized already; what's left)

Most of the risk this section would have flagged pre-split already happened
and was handled — worth noting what worked, since it's evidence for how the
remaining piece (#622's re-export change) will likely go too:

- **Import-path breakage for consumers**: avoided so far because
  `core`/`mermaid-parser`/`svg-renderer` are still bundled, not externalized
  — the public `exports` map hasn't changed. This risk is *deferred*, not
  resolved: it becomes live the moment #622's thin-re-export change lands,
  since that's when the umbrella's `dist/*.js` actually starts requiring the
  internal packages to be resolvable (published) rather than inlined.
  Mitigation already decided: same `exports` map, same versions, so nothing
  a consumer imports changes — only what's inside `dist/` does.
- **CI / build changes**: `vite.config.lib.ts` already grew the
  `@zombie-mermaid/*` handling needed for the bundled state (see its
  comments on `isExternal` and the `.d.ts` inlining via api-extractor
  `bundledPackages`). The remaining CI change for #622 is making these
  externals instead of inlined — a real but scoped change to one config
  file plus adding the new packages to `publish.yml`'s workspace awareness.
- **Coverage / test config**: already handled per #627 — one root Vitest
  config and one coverage run already cover `packages/*/src`, so nothing
  new is needed here for #622 specifically.
- **Worktree `node_modules`-not-shared gotcha** (documented in this repo's
  own `CLAUDE.md`): every worktree gets its own `pnpm install`, so anyone
  picking up the remaining #622/#623 work in a fresh worktree needs to run
  `pnpm install` there before `packages/*` resolve — same caution as any
  other dependency-touching change in this repo, not specific to the
  monorepo work, but worth restating since this epic is exactly the kind of
  multi-package change where a stale or missing install silently breaks in
  one worktree and not another.
- **Supply-chain surface**: publishing `@zombie-mermaid/*` packages touches
  this repo's dependency-manifest/lockfile surface, which the org's own
  standing rule treats as security-critical — any PR that actually flips
  packages from `"private": true` to published needs a human on the
  merge/approve button, not an autonomous agent merge, regardless of how
  mechanical the change looks.

## Recommendation

1. **Don't re-litigate #416's package boundaries.** They're already decided,
   already grounded in the real import graph (more thoroughly than a fresh
   pass could redo), and mostly built. Treat
   `monorepo-conversion-scoping.md` as the source of truth for *why* the
   boundaries are where they are.
2. **Resolve the #623 discrepancy first** — either reopen it and finish
   moving `src/ascii/**` and `src/mcp/` into `packages/ascii-renderer/` and
   `packages/mcp/`, or explicitly re-scope #620 to say those two stay
   deferred alongside `cli`/`demo`. Right now the tracker says one thing and
   the tree says another.
3. **Proceed with #622 as scoped**, using the recommendation above: single
   npm listing, `fixed` changesets array, thin re-exports, `@zombie-mermaid/`
   scope, genuinely published — and ship it *without* a standalone `mcp`
   package unless the repo owner has a concrete reason (a real user request,
   not a hypothetical) to want one now.
4. **Downgrade or close #621's remaining scope** rather than carrying it as
   open-ended "add pnpm -r/--filter usage" — there's no current need for it,
   and it's better tracked as a specific follow-up once #622 actually
   requires independent per-package builds.

## Open questions for the repo owner

- Is the `mcp` standalone-npm-name question (point 4 of #622, and my
  recommendation above) settled by "no, not yet — revisit if someone asks,"
  or is there a concrete distribution goal (e.g. wanting `zombie-mermaid-mcp`
  discoverable in an MCP server registry) that changes the calculus?
- Should #623 be reopened, or should this epic's remaining scope be
  explicitly narrowed to `core`/`mermaid-parser`/`svg-renderer` plus the
  publish-strategy work, deferring `ascii-renderer`/`mcp` extraction the
  same way `cli`/`demo` were deferred?
- Does the `expanded-shapes.ts` back-reference (packages importing from
  `src/` root) need its own tracked issue, or is it acceptable as a known,
  temporary loose end until `mermaid-parser`'s scope is revisited?
- Any objection to closing/downgrading #621 as described above, versus
  keeping it open as a placeholder for future cross-package script needs?
