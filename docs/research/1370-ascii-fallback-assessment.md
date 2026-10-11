# Research: could ASCII output be the fallback when `elkjs` is absent?

Status: **answered; recommendation below.** Companion to
[`1370-elkjs-optional-peer-dep.md`](1370-elkjs-optional-peer-dep.md), written for
[#1370](https://github.com/dfadler/zombie-mermaid/issues/1370). Context: PR #1444 makes `elkjs` an
optional peer; with no registered or auto-loadable elk, rendering a graph diagram to SVG throws
`ElkNotRegisteredError`. Question: instead of erroring, could the CLI/library fall back to ASCII for
flowchart, state, class, ER and architecture? Measured on `main` @ `0d61de15`, Node 24.

## TL;DR

- **Technically free.** ASCII never touches elk: an esbuild bundle of
  `packages/ascii-renderer/src/index.ts` contains zero `elk` references, and
  `packages/ascii-renderer/package.json` has no `elkjs` entry. `registry.ts:18-22` records the #300
  fix that cut the last edge. ASCII works with elk absent today.
- **Coverage is complete.** All 66 gallery samples of the five ELK-dependent types render to ASCII
  without throwing (66/66). Every node, edge and subgraph label we can check mechanically is
  present. The ASCII registry covers all 8 `DiagramType`s, so no type is unsupported.
- **Quality is not SVG-equivalent.** Of 11 samples I read by eye, 7 had a visible routing or
  ambiguity defect (about 5 of them real "can't trace this edge" problems). That matches the open ASCII
  bug queue (#1331, #1394, #1433-#1439, #1421).
- **Recommendation: partial fallback.** Viable as an explicit, loud degraded mode for the CLI and
  MCP server (text consumers: terminals, LLM tool output). Not viable as a silent substitute in the
  library, or anywhere a caller expects an SVG string. Best for flowchart, class and architecture;
  weakest for state and ER.

## 1. Does ASCII work with elk absent?

Yes, verified three ways:

1. `esbuild --bundle packages/ascii-renderer/src/index.ts --metafile` lists no `elk*` input.
2. `packages/ascii-renderer/package.json` declares no `elkjs`.
3. `packages/ascii-renderer/src/registry.ts:18-22` documents that `dist/ascii.js` once carried
   `import "elkjs/lib/elk.bundled.js"` via `src/er/layout.ts -> elk-instance.ts` and that the
   registry split removed it. The two remaining mentions of elk in `ascii-renderer/src`
   (`converter.ts:44`, `grid.ts:2097`) are comments pointing at `mermaidToElk`.

ASCII does its own grid layout and A\*-style edge routing (`grid.ts`, `edge-routing.ts`,
`pathfinder.ts`). It shares only the parser (`@zombie-mermaid/mermaid-parser`) and
`@zombie-mermaid/core` types with the SVG side, so parse errors are identical in both.

The CLI currently imports the SVG renderer statically (`src/cli/render.ts:14`), so a fallback needs
the elk-missing check on the SVG path, not a change to ASCII.

## 2. Method

Script (kept out of the repo) loaded `packages/site/samples-data.ts` (117 samples), ran
`detectDiagramType`, and for every sample rendered `renderMermaidASCII(src, {colorMode:'none'})` and
`renderMermaidSVG(src, sample.options)`. State diagrams detect as `flowchart`, so I split them by
the `stateDiagram` header. Checks:

- (a) succeeds: no throw.
- (b) preserved: node, edge and subgraph labels from `parseMermaid` (flowchart/state) or a source
  regex (class/ER/architecture) found in the ASCII text. This checks labels only. It does **not**
  prove each edge is drawn connected; no such test exists (#1432).
- (c) defects: count of `┼` crossings on every sample, plus reading 11 samples by eye. A `┼` that
  crosses a subgraph border is benign; one inside a lane is not.
- (d) fails or falls back: none observed.

Plain text output only; no images were needed. Limits: (c) is a sample, not a census.

## 3. Results

| Type         | Samples | (a) renders | (b) labels all present | `┼` present | Read by eye | Visible defect |
| ------------ | ------: | ----------: | ---------------------: | ----------: | ----------: | -------------: |
| flowchart    |      28 |       28/28 |                  28/28 |           6 |           5 |            2/5 |
| state        |       5 |         5/5 |                    5/5 |           2 |           1 |            1/1 |
| class        |      16 |       16/16 |                  16/16 |           0 |           1 |            1/1 |
| ER           |      14 |       14/14 |                  14/14 |           5 |           1 |            1/1 |
| architecture |       3 |         3/3 |                    3/3 |           2 |           3 |            2/3 |
| **total**    |  **66** |   **66/66** |              **66/66** |      **15** |      **11** |       **7/11** |

(State's one apparent label miss, `max_retries`, is an artifact of my markdown-stripping regex, which
drops `_`; the label is drawn. The ER and class "entity name" checks are looser than the flowchart
label check.) Reading by eye covered samples 5, 17, 21, 22, 24, 31, 63, 76, 94, 95, 96 (all counted
above). Sample 5 is clean but very wide (below).

### Worst offenders

- **State: Connection Lifecycle** (`stateDiagram-v2`, 9 transitions). Edges overlap along shared
  columns, labels (`success`, `done`, `max_retries`) sit on or beside a stem that belongs to a
  different edge, and the final state is an empty double box. Several transitions cannot be traced
  by eye. Same family as #1331, #1436, #1439.
- **Flowchart: CI/CD Pipeline.** Eight edges in a subgraph. The `Build Image -> Deploy Staging`
  edge crosses the `No` loop and the dotted retry edge at `┼`; the reader must guess which line
  continues. Issue #1399 fixed an earlier merge/cross here, and #1413 the TD fan-in labels, but
  crossings remain.
- **Flowchart: Git Branching Workflow** (LR, 10 edges, cycle). `approved`, `pass` and `fail`
  return edges share rows with forward edges; tracing `main -> develop -> feature/ui` needs care.
- **Class: MVC Architecture.** The `refreshes` connector runs flush against the right wall of the
  unrelated `Model` box, so it reads as part of the border, and the two arrowheads at `View`
  collapse into `▼─────▼`. The weekly form-judge flags the same thing (#1119).
- **ER: E-Commerce Schema.** The `ORDER -> LINE_ITEM contains` edge is drawn as `┼`, a lone `┌`,
  `│`, `╟` with a gap, so it is not a connected line. Crow's-foot cardinality becomes `○╟` and
  `─│──○╟`, which needs a legend.
- **Architecture: Group-To-Group Edges.** `api:B -- T:db{group}` and `jobs:R --> L:db` end up as a
  `─┼─┤` knot at the group border; which service connects to Storage is ambiguous. Junction in
  "Nested Groups And Junction" renders as a two-cell `●──●` blob.
- **Width: All 12 Flowchart Shapes** is 206 columns by 7 rows, wider than a typical terminal. The
  CLI has `-w, --max-width` for this (`src/cli.ts:138`).

Clean by eye: **Nested Subgraphs**, **System Architecture** (crossings are only at group borders)
and **Architecture: Services And Edge Sides**.

### Corroborating evidence outside this run

- The weekly form-judge, [#1119](https://github.com/dfadler/zombie-mermaid/issues/1119) (2026-10-05):
  73 samples judged against upstream mermaid.js, **0 not faithful**, findings all `MINOR`/`MODERATE`
  (lifelines, a connector abutting a box, a layout swap). Structure is judged intact; routing polish
  is not.
- Open ASCII defect issues touching exactly these types: #1331 (shared bus makes exit-label
  ownership ambiguous), #1394 (parallel edges), #1433 (LR label overwrites a stroke), #1434-#1436
  and #1439 (TD labels flush to stems, fan-in edges merging to one arrowhead or one lane), #1438
  (bidirectional start arrowhead overwrites the border), #1421 (nested subgraph RL/BT direction),
  and #1432 (no test that every edge reaches its target).

## 4. What ASCII drops compared with SVG

| SVG feature                                          | In ASCII                                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Node shapes (12 flowchart shapes)                    | Approximated: all are rectangles with distinct corner glyphs (`shapes/corners.ts`), so e.g. stadium vs. circle is `(` vs `◯` corners only |
| `classDef`/`:::` colors                              | Applied only in colour mode (`converter.ts:182-198`), not in plain text; `linkStyle`/inline `style` coverage not verified                 |
| Themes and `bg`/`fg`/`accent` options                | Mapped to an ANSI theme via `diagramColorsToAsciiTheme`; nothing in plain text                                                            |
| Architecture icons (`cloud`, `database`, `internet`) | Dropped; services are boxes, groups are labeled frames                                                                                    |
| Curved/step edge routing, animation, `interactivity` | Dropped; `click` links only as opt-in OSC 8 hyperlinks (`hyperlinks`)                                                                     |
| Fonts, markdown bold/italic, multi-line wrapping     | Dropped or flattened                                                                                                                      |
| ER crow's-foot, class UML arrowheads                 | Substituted with `○╟`, `▼`, `┊` glyphs                                                                                                    |
| Pan/zoom, scaling, PNG/HTML output                   | n/a; width is bounded by terminal (`--max-width` helps)                                                                                   |

Diagram types ASCII does not support: **none** of the repo's 8 `DiagramType`s (the registry in
`ascii-renderer/src/registry.ts` is exhaustive: xychart, er, sequence, class, flowchart,
architecture, c4, pie). Types outside that set are unsupported by SVG too.

## 5. Recommendation: partial fallback

| Context                                                    | Verdict                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI `render` with no explicit format, SVG would be written | **Viable** as a loud degraded mode: print ASCII to stdout, warn on stderr, exit non-zero or a distinct code                                 |
| MCP server tool output                                     | **Viable.** The consumer is an LLM or terminal, and the text keeps all labels and topology                                                  |
| Library `renderMermaidSVG` in Node or browser              | **Not viable as silent fallback.** Callers embed the return value as SVG; a text blob in its place is a worse failure than the thrown error |
| Browser bundles that skipped `registerElk()`               | **Not viable.** They want pixels; the clear `ElkNotRegisteredError` is the right signal                                                     |

By type: flowchart, class and architecture are acceptable as a degraded mode. State and ER are the
weakest (cluttered shared lanes; cardinality glyph soup) and shouldn't be marketed as a substitute.

It should not change PR #1444's design: the error stays the default and the fallback is an opt-in
or CLI/MCP-only layer on top.

## 6. What a fallback would involve

Small, if scoped to CLI and MCP:

1. **Detection.** Catch `ElkNotRegisteredError` (new in PR #1444, exported from `svg-renderer`) at
   the render call. No capability probe is needed; the error is the signal.
2. **CLI** (`src/cli/render.ts`, around `renderMermaidSVG` at line 14 and the `args.ascii` branch at
   line 163): on that error, when output is not `-o file.svg|png|html`, call the existing ASCII
   path with the same options, write a one-line stderr warning that points to the elkjs guide
   (`docs/guides/elkjs-optional-peer.md`), and set an exit code (e.g. `EXIT_PARTIAL`). For
   `-o file.svg` keep the hard error: writing text into an `.svg` file is wrong.
3. **MCP** (`packages/mcp/src/server.ts`): same catch, return ASCII text plus a note. The package
   already depends on elk, so this only fires on a broken install.
4. **Library:** do not change `renderMermaidSVG`. If wanted, add an explicit opt-in
   (`renderMermaidSVG(..., { fallback: 'ascii' })` or a separate helper) whose return type makes
   the format visible (`{ format: 'svg' | 'ascii', output: string }`).
5. **Tests:** hermetic, using the `elk-optional-peer-1370.test.ts` setup; assert fallback fires for
   all five types and stays off for sequence/pie/xychart/C4 (which never need elk).
6. **Docs:** one paragraph in `docs/guides/elkjs-optional-peer.md`.

Because the umbrella `zombie-mermaid` package still depends on elk (per PR #1444), the CLI would hit
this path only on a broken or pruned install, so the value is mostly robustness, not a user-facing
feature. If the goal is an "elk-free CLI", ASCII is the only output that works, and then the
fallback becomes the default, which needs the quality work above (especially #1331, #1436, #1439,
#1432) to land first.

## 7. Open questions

- Should the fallback exit 0 or non-zero? Text on stdout suggests success, but the requested format
  was not produced.
- Does anyone ship the CLI without elk? If not, build 2 and 3 only after the quality items above.
- Defect census: the per-sample defect counts here come from a hand-read sample plus a crossing
  heuristic. A real "every edge reaches its target" test (#1432) would turn (c) into a number.
