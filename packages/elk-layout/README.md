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

## elkjs is pinned to exactly 0.12.0

That is the version mermaid 12.3.0 itself depends on (12.2.0 used 0.9.3; the two route repeated and
opposing edges between the same two nodes differently, #2708). pnpm resolves the alias
`elkjs-0.12.0` (npm:elkjs@0.12.0) for this package, and a test asserts it. The alias is also how the
published umbrella declares the pin (optional peer, see the ASCII layout docs).
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

## Fixtures d1 to d3 and mermaid 12.3.0 (#2708)

mermaid 12.3.0 depends on elkjs ^0.12.0 (12.2.0: ^0.9.3). Running this package on elkjs 0.9.3
against 12.3.0 left d1/d2/d3 at 7/12, 6/12 and 2/10 edges within 1px (only repeated and opposing
edges between two different nodes moved, up to 66px); on elkjs 0.12.0 they are 12/12, 12/12 and
10/10, and `d1`/`d2`/`d3.expected.json` were regenerated from that output. Check:

```sh
pnpm exec tsx scripts/elk-layout-oracle.ts packages/elk-layout/__tests__/fixtures/d1.mmd packages/elk-layout/__tests__/fixtures/d2.mmd packages/elk-layout/__tests__/fixtures/d3.mmd
```

## Known gaps

- Subgraphs and the shapes listed above are unsupported (signalled, not approximated).
- Reciprocal edges 40 px apart (gallery samples 145 and 146) differ in a few edge points (on 12.3.0 / elkjs 0.12.0: 1/3 and 5/6 edges within 1px; sample 116 is 7/8). Not investigated further here.
- Stadium and hexagon multi-line sizes use fitted constants (126.3 and 219.4 px wide), and the
  stadium text-wrap rule past 120 px is not understood.
- `o--`/`x--` circle and cross markers are trimmed like arrowheads, unverified.
- Sample 25 (click links/tooltips) cannot be read back from the oracle by the comparison script.
