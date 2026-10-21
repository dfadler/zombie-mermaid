# Published tarballs ship `dist/` only: no `src/`, no source maps

Status: implemented

## Context

[#1426](https://github.com/dfadler/zombie-mermaid/issues/1426) found that every source map embedded its full source (`sourcesContent`) while `src/` also sat in `files`, so the same code shipped twice. It noted the cost of dropping `src/`: consumers lose browsable source in `node_modules`. Three later changes followed the same size thread.

[#1550](https://github.com/dfadler/zombie-mermaid/issues/1550) groups this with the Node `>=24` bump ([#1291](https://github.com/dfadler/zombie-mermaid/issues/1291)). The Node floor already has its own record, [consumer-node-floor-1567.md](consumer-node-floor-1567.md), so it is not repeated here.

## Decision

Published tarballs contain the built output and licence files, nothing a consumer could use to read the original source. Reached in three steps:

| Step | Change                                                                                                                                                                   | Merged     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1    | [#1446](https://github.com/dfadler/zombie-mermaid/pull/1446) dropped `src/` from `files` in the root and five packages; maps still carried the source                    | 2026-10-09 |
| 2    | [#1968](https://github.com/dfadler/zombie-mermaid/pull/1968) set `sourcemapExcludeSources`, so maps keep line numbers but not the source (closes #1871)                  | 2026-10-13 |
| 3    | [#2195](https://github.com/dfadler/zombie-mermaid/issues/2195) stopped publishing maps: emitted as `hidden`, `!dist/**/*.map` in each `files` (root fixed in `537cb7fe`) | 2026-10-17 |

After step 2 the maps pointed at `../src/*` files that were not in the tarball, so a debugger could not resolve anything. That is why step 3 removed them: they were 45.8% of unpacked bytes (about 39% of packed) and unusable. Sizes at step 1 are in the #1446 description; the step 3 measurement is in #2195.

The guards are `pnpm run check:pack-dist` and `pnpm run smoke:packed` (added in #2195), which fail if a `.map` is packed. Maps are still emitted in the build, hidden, for local use.

## Consequences

- Consumers cannot step into library source or get original-source stack traces from `node_modules`.
- Re-adding `src/` or maps to `files` re-proposes what steps 1 to 3 removed. The alternatives named in #1426, #1871 and #2169 (ESM-only maps, maps on GitHub Releases) were not done; revisit those, not `files`, if consumers ask for debuggable stacks.
- Step 1 on its own left an inconsistency: its description said maps "still resolve" the source, which stopped being true at step 2. Read the table, not the #1446 body, for the current state.
- #1446 also removed the unused `entities` declaration from `@zombie-mermaid/mcp` and kept root `elkjs` and `entities` (bundled and used by `scripts/bench.ts`). That is a dependency cleanup, not part of this decision.
- Not verified: that `npm pack --dry-run` lists no `*.map` for all six packages on current `main`. Only the `files` globs were read.
