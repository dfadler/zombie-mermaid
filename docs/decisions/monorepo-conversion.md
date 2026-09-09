# Monorepo conversion: current status and the remaining publish-strategy decision

This was requested as a pre-implementation proposal synthesizing #416, #620,
#621, and #622 — written as if the package split were still a future
decision. That premise no longer matches the tree: the split is
**substantially done**. `packages/core`, `packages/mermaid-parser`, and
`packages/svg-renderer` already exist and are populated (#624/#625, merged);
`cli`/`demo` staying as apps is decided (#626); test layout is decided and
implemented (#627). All of that is recorded in exhaustive detail in
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

- The package split (#416/#620) is 3 of 5 planned packages done
  (`core`, `mermaid-parser`, `svg-renderer`); `ascii-renderer`/`mcp`
  extraction (#623) is closed but was never actually done — worth
  reopening or re-scoping.
- Workspace tooling (#621) is mostly done; its remaining "use
  `pnpm -r`/`--filter`" scope isn't needed by anything yet.
- Publish strategy (#622) is the one undecided piece: recommendation is a
  single npm listing (`zombie-mermaid`), a populated `fixed` changesets
  array, thin re-exports under the `@zombie-mermaid/` npm scope, and no
  standalone `mcp` package unless a concrete user request shows up.
- Any PR that flips packages from `"private": true` to published touches
  this repo's dependency-manifest/lockfile surface, which is
  security-critical per this org's standing rule — needs a human on the
  merge/approve button.

See the [#622 comment](https://github.com/dfadler/zombie-mermaid/issues/622#issuecomment-5600285433)
for the full writeup, including open questions for the repo owner.

Relates to #416, #620, #621, #622 — proposing how to finish the remaining
piece, not resolving any of them.
