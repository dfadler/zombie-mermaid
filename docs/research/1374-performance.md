# Performance research (#1374)

Measured 2026-10-08 on `main` (79009cb6), Node 24, Apple laptop that was also
running other agent sessions, so absolute numbers carry roughly +/-30% noise.
Compare minimum-of-batches, not single runs.

## Reproduce

```sh
pnpm run build
pnpm bench            # full sample sweep (parse / SVG / ASCII)
pnpm bench:core && pnpm bench:mcp && pnpm bench:trend
node --cpu-prof --import tsx <script>   # CPU profile of one sample
```

## Baseline

`pnpm bench` (97 samples): total 470 ms (parse 5.4, SVG 171.5, ASCII 290.8).
ASCII is now the larger half. Per-category ASCII: Flowchart 206 ms of 291 ms,
State 58 ms; everything else under 7 ms. `bench:core` averages 0.028 ms per
sample. `bench:mcp` (per request, mean): `render_mermaid_svg` 2.75 ms,
`render_mermaid_ascii` 0.64 ms, `tools/list` 0.18 ms.

`pnpm bench:trend` over `bench-history.jsonl`: total 454 -> 795 ms (+75%) across
four weekly points, but this is mostly sample-set growth (C4 and Architecture
were added) plus Flowchart ASCII, which went 109 -> 306 ms.

## Findings (ranked by measured impact)

1. **Pathfinding (A-star) dominates ASCII flowchart time (partly fixed here).**
   CPU profile of the slowest sample ("CI/CD Pipeline", ~145 ms ASCII):
   `getPath` 3.7 s self, `Grid.has` 1.2 s, `routeEdge` 1.0 s, heap `sinkDown`
   0.7 s, GC 0.5 s over 40 renders. The search keyed its `costSoFar` and
   `cameFrom` maps by `"x,y"` strings. Switching to a numeric key (identical cell
   identity, identical heap and expansion order) and replacing the
   `unshift`-based path rebuild with `push` + `reverse` took the sample from
   ~146 ms to ~105 ms (about 28%). Output is unchanged: all 1,527 ascii-renderer
   tests, including the goldens, pass.
2. **Grid occupancy still builds a string per `isFree` call (follow-up).**
   `Grid.has` + `gridKey` is the next-largest cost (~12%). Moving `Grid` to
   numeric keys would also speed `edge-routing.ts` / `edge-bundling.ts`.
3. **Pathfinding budget is spent on failing searches (follow-up).** The
   render-wide `DEFAULT_PATH_BUDGET` (200k iterations) and the 50k per-call cap
   bound worst-case time but a few unroutable edges can burn most of it. Worth
   instrumenting how many iterations the slow samples actually consume
   before tuning an early exit or a bounded-region search.
4. **Parse, SVG layout and MCP are fine.** Parse is 5 ms for all 97 samples;
   MCP round trips are single-digit ms. No action.
5. **Benchmark gap (follow-up).** All samples are small (tens of nodes). There
   is no large-diagram scaling benchmark (hundreds of nodes/edges), which is
   where the pathfinder's super-linear cost would show. Not added here because
   a meaningful one needs a generator plus a baseline policy decision for
   `scripts/bench-baseline.json`.
6. **Build/test/CI time** was not profiled in this pass; ascii-renderer's test
   suite runs in ~8 s locally (127 files).

## Follow-ups

See the issues linked from the PR.
