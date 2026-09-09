# Monorepo conversion: current status and the remaining publish-strategy decision

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
proposal and recommendation for #622 — is written up as a comment on
[#622](https://github.com/dfadler/zombie-mermaid/issues/622#issuecomment-5600285433)
rather than duplicated here, since #622 is the one part of this epic that's
still genuinely undecided.

## Summary

- The package split (#416/#620) is done: `core`, `mermaid-parser`,
  `svg-renderer` (#624/#625), and `ascii-renderer`/`mcp` (#767, finishing
  what #623 closed without doing) are all real workspace packages.
- Workspace tooling (#621) is mostly done; its remaining "use
  `pnpm -r`/`--filter`" scope isn't needed by anything yet.
- Publish strategy (#622) is implemented as of #769: a populated `fixed`
  changesets array, thin re-exports under the `@zombie-mermaid/` npm scope,
  and no standalone `mcp` package. `zombie-mermaid` is still the only
  package end users install — the five `@zombie-mermaid/*` packages are
  real, independently-built runtime dependencies of it, not a second public
  surface. The one remaining step is manual and maintainer-only: linking npm
  trusted publishing for each of the five new package names (RELEASING.md).
- Any PR that flips packages from `"private": true` to published touches
  this repo's dependency-manifest/lockfile surface, which is
  security-critical per this org's standing rule — needs a human on the
  merge/approve button.

See the [#622 comment](https://github.com/dfadler/zombie-mermaid/issues/622#issuecomment-5600285433)
for the full writeup, including open questions for the repo owner.

Relates to #416, #620, #621, #622 — proposing how to finish the remaining
piece, not resolving any of them.
