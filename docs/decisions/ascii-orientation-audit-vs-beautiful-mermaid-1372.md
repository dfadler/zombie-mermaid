# ASCII orientation options vs. beautiful-mermaid: audit and decisions

## Context

[#1372](https://github.com/dfadler/zombie-mermaid/issues/1372) asked whether any
ASCII orientation behavior changed from upstream `beautiful-mermaid` in a way a
migrating user would not expect. Method: render a fixed set of sources with
`beautiful-mermaid@1.1.3` (npm latest on 2026-10-08) and with `main`
(`renderMermaidASCII`, Unicode and `useAscii`), for each direction
`TD|TB|BT|LR|RL`, and compare strings. Only the 1.1.3 release was compared, not
the v0.1.0-era or intermediate upstream versions, nor our v1.0.0.

"Orientation" here means where nodes sit on the page and which way arrowheads
point. Layout-engine changes (fan-out, label placement, padding) alter the
default `TD`/`LR` output without any orientation option involved; they differ
from upstream in nearly every flowchart sample and are tracked by their own
fixes, not audited case by case here.

## Findings

| Case                                                | beautiful-mermaid 1.1.3                 | main                                                                                                                                                              | Class                                                                |
| --------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Flowchart `graph RL`                                | drawn as `LR` (source on the left, `►`) | mirrored: source on the right, `◄` ([#1231](https://github.com/dfadler/zombie-mermaid/issues/1231), [#1259](https://github.com/dfadler/zombie-mermaid/pull/1259)) | Deliberate improvement; was undocumented, now in the migration guide |
| State diagram `direction RL`                        | drawn as `LR`                           | mirrored                                                                                                                                                          | Same as above                                                        |
| Flowchart / state `BT`                              | flipped vertically after layout         | flipped vertically; label rows, `v`/`^` and corner glyphs remapped                                                                                                | Same orientation; glyph details differ (bug fixes)                   |
| Nested subgraph `direction RL`                      | drawn as `LR`                           | still drawn as `LR` (`packages/ascii-renderer/src/converter.ts`, `convertSubgraph`)                                                                               | Inconsistent with top-level `RL`; **open**, see below                |
| Nested subgraph `direction BT`                      | drawn as `TD`                           | still drawn as `TD`                                                                                                                                               | Same gap as nested `RL`                                              |
| ER `direction`                                      | ignored in ASCII                        | ignored in ASCII                                                                                                                                                  | Unchanged (migration guide statement holds)                          |
| Sequence, class                                     | one fixed output                        | byte-identical to upstream for every direction on the tested samples                                                                                              | Unchanged                                                            |
| State-end (`[*]` target) double box under `BT`/`RL` | no such box mirroring (RL not mirrored) | corners were left unmapped, giving `╗═══╔` under `RL` and top/bottom swapped under `BT`                                                                           | **Bug in our flips, fixed in this PR**                               |

The state-end bug came from `isBorderChar` in `draw.ts` not listing the
double-line glyphs, so they were tagged `text` and exempt from the flip's glyph
remap, and from `VERTICAL_FLIP_MAP` lacking `╔╗╚╝`. Both are fixed; a test
covers `RL` and `BT`.

## Decision

- **Root `RL` mirroring stays the default.** It matches what Mermaid draws and
  what `direction RL` says. Reverting to upstream's `LR` would reintroduce a
  known-wrong render. No opt-in flag: the only users affected wrote `RL` and
  got `LR`, which they were not asking for. The break is documented in
  `docs/migrating-from-beautiful-mermaid.md`.
- **Nested subgraph `RL`/`BT` is a known inconsistency, not fixed here.**
  Honoring it means mirroring only the subgraph's contents and the edges inside
  it, while leaving edges that cross the boundary routed by the parent. That is
  a layout change with its own edge cases (an edge that crosses the boundary
  loses the override entirely, per `subgraphDirectionIsHonored`), and should get
  its own issue and before/after real-terminal captures. Until then the nested
  `RL` behavior equals upstream's.
- **No new orientation option.** `AsciiRenderOptions.direction` and the CLI
  `--direction` already cover the override; `-w/--max-width` deliberately does
  not flip direction (#335).

## Consequences

- Anyone with an `RL` flowchart or state diagram in docs or snapshots sees
  mirrored output after migrating; this is now stated in the migration guide.
- A user who nests `direction RL` inside a subgraph still gets left-to-right
  inside it. Follow-up issue to be opened for that.
- Layout-only differences from upstream (fan-out/fan-in routing, label
  placement) are out of scope here and are not individually classified.
