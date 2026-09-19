# Monorepo conversion: current status and the implemented publish strategy

This was requested as a pre-implementation proposal synthesizing #416, #620,
#621, and #622 — written as if the package split were still a future
decision. That premise no longer matches the tree: the split is **done**.
`packages/core`, `packages/mermaid-parser`, `packages/svg-renderer`
(#624/#625), and — as of #767, closing the discrepancy this doc originally
flagged — `packages/ascii-renderer` and `packages/mcp` all exist and are
populated; `cli`/`demo` staying as apps is decided (#626); test layout is
decided (#627, though in practice all four extractions left tests in
`src/__tests__/` rather than moving them into each package's own tree — see
#767's addendum to `monorepo-conversion-scoping.md`). All of that is
recorded in exhaustive detail in
[`monorepo-conversion-scoping.md`](monorepo-conversion-scoping.md) (PR #558)
and its addenda.

The full analysis — current package boundaries, a discrepancy in #623
(closed but its extraction never happened), the live `expanded-shapes.ts`
back-reference, a #621 recommendation, and the concrete publish-strategy
proposal for #622 — is written up as a comment on
[#622](https://github.com/dfadler/zombie-mermaid/issues/622#issuecomment-5600285433).
That comment's recommendation (no package independently offered, `mcp` with
no standalone name) was the _starting_ proposal; the repo owner's actual
call, recorded here, narrowed it further.

## Summary

- The package split (#416/#620) is done: `core`, `mermaid-parser`,
  `svg-renderer` (#624/#625), and `ascii-renderer`/`mcp` (#767, finishing
  what #623 closed without doing) are all real workspace packages.
- Workspace tooling (#621) is mostly done; its remaining "use
  `pnpm -r`/`--filter`" scope isn't needed by anything yet.
- Publish strategy (#622) is implemented: a populated `fixed` changesets
  array, thin re-exports under the `@zombie-mermaid/` npm scope, and no
  standalone `mcp` package name. `zombie-mermaid` is still the only package
  most consumers install, and the five `@zombie-mermaid/*` packages are
  real, independently-built runtime dependencies of it — but two of them,
  `@zombie-mermaid/ascii-renderer` and `@zombie-mermaid/svg-renderer`, are
  **also** documented, standalone-usable public offerings in their own
  right (see each package's own README), for anyone who wants just one
  renderer without the full umbrella. `core`, `mermaid-parser`, and `mcp`
  stay internal-only: published under the scope (so the names can't be
  squatted) and version-locked with the rest, but with no standalone
  support commitment beyond backing the umbrella and the two public
  renderer packages. `@zombie-mermaid/svg-renderer` ships without a
  top-level `renderMermaidSVG(text)` front door for now (that dispatch
  logic still lives in the umbrella) — see #1111 for the follow-up that
  would add one for parity with `ascii-renderer`.
- npm trusted publishing is configured for all six package names; all six
  have been published at least once.
- Any PR that flips packages from `"private": true` to published touches
  this repo's dependency-manifest/lockfile surface, which is
  security-critical per this org's standing rule — needs a human on the
  merge/approve button.

See the [#622 comment](https://github.com/dfadler/zombie-mermaid/issues/622#issuecomment-5600285433)
for the original analysis and open questions; the summary above reflects
what was actually decided, which differs from that comment's proposal on
the "offer any package standalone" question.

Relates to #416, #620, #621, #622, #1111.
