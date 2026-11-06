# @zombie-mermaid/elk-layout (internal)

Browser-free reproduction of mermaid.js's default flowchart layout (ELK, `layered`), for
[#2179](https://github.com/dfadler/zombie-mermaid/issues/2179) / umbrella #2177. Private: not
published, not bundled into `dist/`, so it adds nothing to the bundle-size budgets.

```ts
import {
  layoutFlowchart,
  UnsupportedFlowchartError,
} from '@zombie-mermaid/elk-layout'

const { dir, nodes, edges } = await layoutFlowchart(mmdSource)
// nodes: { id, x, y, w, h, label }   (x, y are centres)
// edges: { id, from, to, pts, label?, lw, lh }   (pts: source outline -> target outline)
```

`layoutFlowchart` throws `UnsupportedFlowchartError` (with `.reasons`) for input it does not
model: subgraphs, and shapes other than rectangle, rounded, diamond, stadium, circle,
double circle, hexagon, subroutine and cylinder. Catch it and fall back.

## elkjs is pinned to exactly 0.9.3

That is the version mermaid itself depends on; 0.11/0.12 lay the dense duplicate-edge samples
out differently. The rest of the repo uses elkjs 0.12, which is fine: pnpm resolves
the alias `elkjs-0.9.3` (npm:elkjs@0.9.3) for this package, and a test asserts it. The alias is also how the published umbrella declares the pin (optional peer, see the ASCII layout docs).
Do not bump it without re-running the oracle.

## Font strategy

Label widths come from `packages/elk-layout/src/font-advances.json`, per-character advances of mermaid's label
font (`16px "trebuchet ms", verdana, arial, sans-serif`) measured in the oracle's Chromium. It
is shipped (about 1 KB) rather than using `packages/core/src/text-metrics.ts` (Inter), which is
1-6 px off per label and moves every node. "Exact" therefore means exact against this table's
font. The table is machine-specific: which font `trebuchet ms` resolves to depends on the fonts
installed, and the committed table is the macOS Trebuchet MS one. Non-ASCII characters fall back
to Inter metrics scaled by 0.93 (approximate).

Regenerate on the machine whose Chromium you want to match (needs Chromium):

```sh
pnpm run elk-layout:font                                   # rewrites src/font-advances.json
pnpm run elk-layout:oracle                                 # compare with real mermaid
UPDATE_ELK_LAYOUT=1 pnpm exec vitest run -c config/vitest.config.ts packages/elk-layout
```

## Checking against real mermaid

`pnpm run elk-layout:oracle` renders every flat flowchart gallery sample (and any `.mmd` passed
as an argument) through real mermaid with `layout: elk` in headless Chromium and prints node
position/size deltas and edge-point deltas (`--tol=<px>`, default 1). The unit tests need no
browser; they compare against committed `__tests__/fixtures/*.expected.json`, so a one-unit
change to any ELK option (for example `spacing.baseValue` 40 to 41) fails them.

## Fixtures d1 to d3 drift under mermaid 12.3.0 (#2708)

Measured on 2026-11-05 with `scripts/elk-layout-oracle.ts` (tol 1px). Node positions and sizes
match 12.3.0 to 0.0px on all three; the committed `d1`/`d2`/`d3.expected.json` match the pinned
12.2.0 oracle on every edge (12/12, 12/12, 10/10) but only part of the edges on 12.3.0:

| Fixture | Edges within 1px of 12.3.0 | Largest delta | Edges that differ (same point count in every case) |
| ------- | -------------------------- | ------------- | -------------------------------------------------- |
| d1      | 7/12                       | 66px          | `n1->n0` (all 3), `n0->n1` (both)                  |
| d2      | 6/12                       | 40px          | `n2->n1`, `n1->n0`, `n1->n2` x2, `n0->n1` x2       |
| d3      | 2/10                       | 12.4px        | every `n0<->n1` edge (8)                           |

Self-loops (`n1->n1`, `n0->n0`, `n2->n2`), the `n2->n0` edges and the repeated `n1->n2` edges in
d1 are identical on both versions. So the change is the routing of repeated and opposing edges
between two different nodes, not node layout. The cause (a different elkjs or ELK option in
12.3.0, against this package's elkjs 0.9.3) was not investigated.

The fixtures stay as they are until the `mermaid` pin moves to 12.3.0 (a separate decision).
Regeneration records this package's own output, which still routes like 12.2.0, so on its own
it would make the unit test pass while the oracle still reports 7/12, 6/12 and 2/10. The edge
routing has to be brought to 12.3.0 first (or the drift accepted and listed here). Commands:

```sh
# regenerate (rewrites every *.expected.json in fixtures/: keep unrelated diffs out)
UPDATE_ELK_LAYOUT=1 pnpm exec vitest run -c config/vitest.config.ts packages/elk-layout
# compare with the new pin; exit 0 means every edge is within 1px (12/12, 12/12, 10/10),
# any edge beyond tol (accepted drift included) exits 1
pnpm exec tsx scripts/elk-layout-oracle.ts packages/elk-layout/__tests__/fixtures/d1.mmd packages/elk-layout/__tests__/fixtures/d2.mmd packages/elk-layout/__tests__/fixtures/d3.mmd
```

## Known gaps

- Subgraphs and the shapes listed above are unsupported (signalled, not approximated).
- Reciprocal edges 40 px apart (gallery samples 145 and 146) differ in a few edge points.
- Stadium and hexagon multi-line sizes use fitted constants (126.3 and 219.4 px wide), and the
  stadium text-wrap rule past 120 px is not understood.
- `o--`/`x--` circle and cross markers are trimmed like arrowheads, unverified.
- Sample 25 (click links/tooltips) cannot be read back from the oracle by the comparison script.
