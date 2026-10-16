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
`packages/elk-layout/node_modules/elkjs` (0.9.3) for this package only, and a test asserts it.
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

## Known gaps

- Subgraphs and the shapes listed above are unsupported (signalled, not approximated).
- Reciprocal edges 40 px apart (gallery samples 145 and 146) differ in a few edge points.
- Stadium and hexagon multi-line sizes use fitted constants (126.3 and 219.4 px wide), and the
  stadium text-wrap rule past 120 px is not understood.
- `o--`/`x--` circle and cross markers are trimmed like arrowheads, unverified.
- Sample 25 (click links/tooltips) cannot be read back from the oracle by the comparison script.
