# Core-plus-bindings split (#540): not adopted

## Context

[#540](https://github.com/dfadler/zombie-mermaid/issues/540) (split from
[#536](https://github.com/dfadler/zombie-mermaid/issues/536)) asked whether
zombie-mermaid's core rendering logic should move out of TypeScript into a
systems language (Rust or Go), following the Temporal `sdk-core` precedent:
one native core, thin per-language bindings. The task was to prototype the
lowest-risk version of that — one diagram type, in a new core language,
wrapped by a thin TS binding — before deciding how much of the real
implementation should move.

Two prior research spikes fed directly into this:

- [#443](https://github.com/dfadler/zombie-mermaid/issues/443) — whether a
  Rust/Go core could reach a non-JS audience while keeping JS as one of the
  targets.
- [#495](https://github.com/dfadler/zombie-mermaid/issues/495) — whether a
  Go rewrite of the core, compiled to WASM for the browser, was worth it.

Both independently concluded a WASM-outward core would likely regress
bundle size and break zombie-mermaid's synchronous-rendering guarantee. The
#540 prototype (built on `issue-540-core-bindings-prototype`, PR
[#580](https://github.com/dfadler/zombie-mermaid/pull/580)) deliberately
avoided WASM and instead tested the other lowest-risk option: a native Go
binary invoked from TypeScript over a subprocess boundary — a flowchart-only
ASCII renderer, verified byte-for-byte identical to the real
`renderMermaidASCII` on four fixed fixtures.

**Full findings are recorded on the issue: [#540 findings comment](https://github.com/dfadler/zombie-mermaid/issues/540#issuecomment-5571571425).**
The prototype code itself is not preserved in the working tree — it was
throwaway by design, never wired into any build or export — but remains
available in PR #580's history (`experiments/540-core-bindings-prototype/`
as of commit `d3dac2f`) for anyone who wants to see it directly.

## Decision

**Do not adopt a core-plus-bindings split.** Keep the core in TypeScript for
both the browser and the Node/CLI consumer.

The prototype confirmed the pattern is technically workable at toy scale,
but found no case for it on either axis #540 cared about:

- **Browser target is closed, not just deprioritized.** #443's and #495's
  measurements (a Rust→WASM ASCII renderer would plausibly cost more,
  gzipped, than the entire 66,560-byte ASCII-only bundle budget; WASM's
  async instantiation breaks the documented synchronous-rendering guarantee
  the `useMemo()`-in-render-body pattern depends on) are unaffected by
  anything this prototype found — it never touched the browser path at all.
- **Node/CLI target has no demonstrated benefit either.** The only
  performance number this prototype produced is a cost, not a benefit:
  ~91 ms/call subprocess-spawn overhead, too slow for interactive use as
  built, and a persistent-worker binding to fix that is meaningfully more
  scope than what was built here. No raw compute benchmark exists showing
  Go renders faster than TS — the 91 ms is IPC/process overhead, not
  render-time. Binary distribution (1.76 MB stripped, needing
  cross-compilation for 3 OSes × 2 archs, or a Go toolchain on the
  consumer's machine) is new packaging complexity a pure-TS npm package
  doesn't have today.
- **Scope of a real port is large relative to what it would buy**:
  estimated 6–10 person-weeks for flowchart-only, Node/CLI-only, before the
  other five diagram types — against a benefit that, per the two points
  above, hasn't been shown to exist yet.

## Consequences

- [#540](https://github.com/dfadler/zombie-mermaid/issues/540) and
  [#536](https://github.com/dfadler/zombie-mermaid/issues/536) are closed
  out by this decision — no further core-plus-bindings work is scheduled.
- The `experiments/540-core-bindings-prototype/` code is removed from PR
  #580's working tree (kept in that PR's git history only) rather than
  merged — it was never on a build path or exported, and there is no
  ongoing use for it now that the decision is recorded.
- This does not rule out a **narrower, differently-motivated** future
  proposal — e.g. a fast native batch-rendering CLI tool for large-scale
  server-side use, where subprocess overhead amortizes and binary
  distribution is a one-time ops cost rather than an end-user cost. That
  would need its own concrete motivation and its own decision; it is not
  what #540 asked or what this decision closes.
- Any future re-proposal of "move the core out of TypeScript" for the
  browser or general Node consumption should start from this decision and
  #443/#495's measurements rather than re-deriving them.
