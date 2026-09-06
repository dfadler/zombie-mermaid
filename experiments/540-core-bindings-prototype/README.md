# #540 prototype: core-plus-bindings split (throwaway PoC)

**Status: throwaway proof-of-concept. Not production code, not on any build
path, not exported by the published package.** Written for
[#540](https://github.com/dfadler/zombie-mermaid/issues/540), split from
[#536](https://github.com/dfadler/zombie-mermaid/issues/536).

## What this is

A minimal, from-scratch flowchart-ASCII "core" written in Go
(`core/main.go`), invoked from TypeScript via a thin subprocess binding
(`binding/render.ts`), producing output that is **byte-for-byte identical**
to `renderMermaidASCII(..., { useAscii: true })` (the real, unmodified
`src/ascii/**` path) on four small fixed fixture inputs (`fixtures/*.mmd`).

This models the "one core, thin bindings" pattern the issue asks for
(Temporal `sdk-core` / Oso: one native core, idiomatic per-language
wrappers) — **not** a WASM-outward build. See "Why not WASM" below.

## Why not WASM

Two other issues in this same backlog sweep independently researched
adjacent territory before this prototype was written, and both are directly
relevant:

- [`docs/research/443-multilang-ascii-renderer.md`](../../docs/research/443-multilang-ascii-renderer.md)
  (research for #443): a Rust→WASM ASCII-renderer build would plausibly cost
  more, gzipped, than the *entire* current ASCII-only bundle budget
  (66,560 bytes), before JS glue/loader code.
- [`docs/research/issue-495-go-rewrite-motivation.md`](../../docs/research/issue-495-go-rewrite-motivation.md)
  (research for #495): measured the real current bundle sizes (76.3 KB gzip
  SVG entry, 46.5 KB gzip ASCII-only entry), and found Chrome's 4 KB
  synchronous-WASM-compile cap on the main thread would force an async
  instantiation step into a library whose README currently guarantees
  fully-synchronous rendering (load-bearing for the documented
  `useMemo()`-in-render-body React pattern).

Both documents concluded a WASM-outward core would likely regress bundle
size and break that synchronous guarantee. This prototype takes the
alternative the task instructions call out as lower-risk: **a native binary
invoked over a subprocess boundary**, which sidesteps both objections
entirely — because it never runs in a browser at all (see "What this does
NOT prove" below).

## Layout

```
experiments/540-core-bindings-prototype/
├── README.md              — this file
├── core/
│   └── main.go             — the Go "core": parse + layout + render
├── binding/
│   ├── render.ts            — thin TS binding: spawns the Go binary, pipes stdin/stdout
│   └── compare.ts           — runs the real TS renderer and the Go core side by side
└── fixtures/
    ├── chain.mmd            — graph LR, A --> B --> C (matches src/ascii/index.ts's own docstring example)
    ├── branch.mmd           — graph TD, one source fanning out to two targets
    ├── merge.mmd            — graph TD, two sources fanning in to one target
    └── chain-labels.mmd     — graph LR with multi-word bracket labels ([Do Work], etc.)
```

## How to run it

```bash
# 1. Build the Go core (this repo's available Go toolchain is old — see
#    "Environment constraint" below — hence GO111MODULE=off and no go.mod).
cd experiments/540-core-bindings-prototype/core
GO111MODULE=off go build -o core main.go

# 2. From the repo root, run the comparison harness (needs `pnpm install`
#    done in this worktree first, for tsx + the project's own deps):
cd ../../..
./node_modules/.bin/tsx experiments/540-core-bindings-prototype/binding/compare.ts
```

Expected output: all four fixtures print `MATCH`, and the script exits 0.

## Result

**All 4/4 fixtures match byte-for-byte** between the real TypeScript
`renderMermaidASCII` path and the Go-core-via-subprocess path. Example
(`chain.mmd`, `graph LR / A --> B --> C`):

```
+---+     +---+     +---+
|   |     |   |     |   |
| A +---->| B +---->| C |
|   |     |   |     |   |
+---+     +---+     +---+
```

Getting the branch/merge fixtures to match exactly required reverse-
engineering an undocumented detail of the real renderer's box-drawing: a
box's *exit*-side border (bottom edge for a TD flow, right edge for LR) is
only redrawn with a `+` junction character when that node has **exactly one**
outgoing edge in total. A true fan-out source (e.g. `branch.mmd`'s `A`, with
two outgoing edges) keeps a plain, unbroken border — the fork happens
entirely in the routing gap below it, never at the border itself — while
each individual source in a fan-in (e.g. `merge.mmd`'s `A` and `B`, each with
exactly one outgoing edge to the same target) *does* get the junction
character. Entry-side borders (top for TD, left for LR) are never modified
either way, regardless of in-degree. This rule isn't written down anywhere
in the codebase or its docs — it was found by diffing actual output byte by
byte (see `core/main.go`'s comment above the `outDegree` map for where this
is encoded). That process is itself a data point: see "What a real port
would take" below.

## What this does NOT prove

- **Not a browser-compatible strategy.** A native Go binary invoked via
  `child_process` only ever runs where a subprocess and a filesystem exist —
  Node.js, Deno, a CLI. It cannot run in a browser at all, so this shape only
  ever covers the `zombie-mermaid/cli` / Node consumer, never the
  browser-facing `dist/index.js` / `dist/ascii.js` bundles the size research
  above is about. If multi-language support is ever wanted for the *browser*
  target specifically, WASM (or an equivalent) is unavoidable, and the
  bundle-size/sync-rendering objections from #443/#495 still apply there,
  undiminished by anything in this prototype.
- **Not evidence the subprocess approach is fast enough to ship as-is.**
  Measured on this machine: **~91 ms per call**, spawning a fresh process
  each time (200 calls, `renderViaCore()`, averaged) — see
  `binding/render.ts`. That is a real, measured number, not an estimate, and
  it is far too slow for a per-keystroke or per-render call in an
  interactive tool; a viable binding would need a long-lived worker process
  with a persistent stdin/stdout (or socket) protocol, not spawn-per-call.
  That's a meaningfully bigger binding than the one built here.
- **Not evidence this generalizes past these four fixtures.** The Go core
  handles, and *only* handles: a `graph`/`flowchart` header with `TD` or
  `LR`; bare-identifier or `ID[Label]` edge chains (`A --> B --> C`); ranks
  computed as longest-path-from-roots; at most one fan-out group *or* one
  fan-in group per rank-transition gap (not both at once, not a genuine
  many-to-many crossing); and only simple 1-to-1 edges in the `LR` family
  (no fan-out/fan-in there at all). It has no support for subgraphs, node
  shapes beyond an implicit rectangle, styling, `click` directives, `BT`/`RL`
  directions, skip-level edges, cycles, or any diagram type besides
  flowcharts. Every one of those is real complexity the actual
  `src/ascii/**` implementation (37 files, ~15,300 lines, per the #443
  research) already handles.
- **Not a measurement of a modern Go/Rust toolchain's output.** See the
  environment constraint below.

## Environment constraint hit while building this

This environment has **no Rust toolchain at all** (`cargo`/`rustc`: command
not found) and only a very old Go: `/usr/local/go/bin/go version` reports
**`go1.12.5`** (released March 2019 — no Go modules by default, no
generics). The prototype above was built with `GO111MODULE=off` and no
`go.mod` to work around this, and deliberately avoids anything requiring a
newer standard library (e.g. `io.ReadAll`, added in Go 1.16, had to become
`io/ioutil.ReadAll`). This is a real, environment-specific constraint, not a
finding about Go/Rust generally — a real implementation attempt should
first confirm a current toolchain is actually available (and, if targeting
Rust specifically per the issue's own Temporal comparison, install one; none
was available here to even attempt a Rust variant).

The built binary itself: 2.25 MB unstripped, 1.76 MB stripped
(`-ldflags="-s -w"`), for a program with essentially no logic in it. This
matches the #495 research's finding that Go/TinyGo binaries carry a
non-trivial baseline size independent of program complexity — irrelevant to
a subprocess-only distribution (nothing here ships to a browser), but a real
cost for *distributing* a native binary at all (cross-compiling for
macOS/Linux/Windows × x64/arm64, or requiring a Go toolchain on the
consumer's machine, is real added packaging complexity a pure-TS npm
package doesn't have today).

## What a real port would take (effort estimate)

Scoped to "flowchart-only ASCII, faithfully, Node/CLI-only" — not the full
six-diagram-type, SVG+ASCII surface:

| Piece | Real source | Estimate | Why |
|---|---|---|---|
| Parser (flowchart subset) | `src/parser.ts` (1,142 lines, all 6 diagram types) | 1–2 weeks | Porting just the flowchart grammar faithfully — shapes, subgraphs, `click`, styles, comments, error recovery other tests rely on. |
| Grid layout + A* pathfinding + edge bundling | `src/ascii/converter.ts`, `grid.ts`, `pathfinder.ts`, `grid-occupancy.ts`, `edge-routing.ts`, `edge-bundling.ts`, `draw-bundles.ts`, `draw-arrows.ts`, `draw-boxes.ts`, `draw-lines.ts`, `draw-subgraphs.ts`, `draw.ts` | 3–6 weeks | The bulk of the real complexity (per #443's research: ~15,300 lines across `src/ascii/**`). This prototype's border-junction discovery above is a small taste of the behavioral archaeology a faithful port needs to do exhaustively, not just for three hand-picked cases. |
| Unicode display width | `src/ascii/display-width.ts` + CJK/combining-mark test fixtures | 3–5 days | #443's research already flags this as the one porting cost its "friendly subset" analysis doesn't reduce — a Go/Rust port needs its own width table matching JS's UTF-16-code-unit semantics exactly. |
| Regex (5 files) | `draw.ts`, `hyperlinks.ts`, `canvas.ts`, `draw-boxes.ts`, `ansi.ts` | ~0.5 day | Per #443's research, all are simple static character-class tests — trivially rewritable. |
| Production-viable binding | n/a (this PoC's `binding/render.ts` is spawn-per-call, ~91 ms/call — too slow) | 1–2 weeks | A persistent worker process with a real IPC protocol (or a native addon — Node N-API/napi-rs for Rust, cgo for Go), still Node/CLI-only; the browser target needs a wholly separate WASM effort already discouraged by #443/#495. |
| Shared conformance corpus (#443's Q5) | Extract `src/__tests__/ascii-*.test.ts` fixtures into language-neutral files | 2–3 days upfront, ongoing after | The only piece of #443 recommended as worth doing regardless of which direction wins — do it alongside a real port, not before. |

**Rough total: 6–10 person-weeks** for flowchart-only, Node/CLI-only, before
touching the other five diagram types or the SVG renderer. This doesn't
contradict the sibling research's recommendation against a full-core
rewrite — it just locates a narrower, possibly more tractable niche
("a fast native CLI/batch tool for Node users") than "replace the core for
every consumer including the browser," which remains blocked on the same
grounds #443/#495 already established.

## Recommendation

- This prototype **does** show the core-plus-bindings pattern is
  technically workable for zombie-mermaid at toy scale, via the lowest-risk
  mechanism available (subprocess/CLI, no WASM, no native addon), exactly as
  the task asked it to check.
- It does **not** show this is worth productionizing yet: the binding is
  too slow as built, the core covers a sliver of real flowchart syntax, and
  — most importantly — it says nothing about the browser bundle, which is
  where #495's actual proposal and #443's/#495's actual objections live.
- Treat this as closed/parked alongside #443 and #495: reference it if
  `#536` gets revisited, but don't schedule further investment without a
  concrete motivation that isn't "replace the browser-facing core" (e.g. "we
  want a faster native CLI tool for large-batch server-side rendering" would
  be a genuinely different, narrower motivation this prototype's numbers
  could speak to more directly).
