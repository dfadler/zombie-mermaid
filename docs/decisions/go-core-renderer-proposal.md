# Go core renderer with TypeScript bindings (#495): recommendation

Status: recommendation, not a closed decision. [#495](https://github.com/dfadler/zombie-mermaid/issues/495)
asked for its own motivation to be filled in before any implementation work
starts — this doc does that and recommends **not proceeding**, but leaves
the actual close/downgrade call to the repo owner. This is not a "Closes"
PR.

## Context

[#495](https://github.com/dfadler/zombie-mermaid/issues/495) proposes
rewriting zombie-mermaid's core (parsing + layout, all six diagram types)
as a Go library — compiled to native Go, WASM, and potentially a C-ABI
shared library from one source of truth — with idiomatic per-language
interfaces on top, TypeScript required among them. The issue is explicit
that it is scope-and-motivation-only: _"the specific motivation (perf, code
sharing with a non-JS host, distributing a single core to multiple
ecosystems, etc.) hasn't been spelled out yet and should be filled in
before any implementation work starts."_

Three candidate motivations are named in the issue body. Each was checked
against actual project signals rather than assumed:

### 1. Performance

`bench.ts` (`pnpm run bench`) exists and measures both renderers on all
sample definitions; `bench-baseline.json` is checked in and CI-gated via
`scripts/bench-compare.ts`. The current baseline
(`bench-baseline.json`, generated 2026-08-31) shows totals of ~927 ms SVG /
~153 ms ASCII across 89 samples — averages of ~10.4 ms per SVG render and
~1.7 ms per ASCII render. No open or closed issue reports a perf problem
with the renderer; the one related issue (#291, closed) added an _opt-in_
cache for repeated-input layout calls, not a fix for a demonstrated
slowness. There is no benchmark, complaint, or profiling result anywhere in
this repo suggesting current TypeScript rendering speed is a problem for
any real consumer.

### 2. Non-JS host / code-sharing demand

Searched open and closed issues for anything resembling an external request
for a non-JS binding, native package, or FFI surface (`python`, `rust`,
`wasm`, `binding`, `non-js`). The only matches are this issue's own
research lineage — [#443](https://github.com/dfadler/zombie-mermaid/issues/443)
(single-source multi-language ASCII renderer research spike),
[#536](https://github.com/dfadler/zombie-mermaid/issues/536) (long-term
considerations doc that spawned this thread), and
[#540](https://github.com/dfadler/zombie-mermaid/issues/540) (a
core-plus-bindings prototype, see below) — all filed by the maintainer as
self-directed exploration, not a response to a user ask. #443 says the same
thing independently: _"No existing issue/discussion currently asks for
one."_ There is no demonstrated non-JS consumer today.

### 3. Distributing one core to multiple ecosystems

Also speculative, for the same reason as (2): the issue itself frames this
as "room for additional language bindings later," not something a
requester is waiting on. Nothing in the repo's issue history, README, or
docs points to an existing or planned non-TypeScript consumer.

### Measurements already exist for this specific issue

A prior research pass (recorded as
[issue comment on #495](https://github.com/dfadler/zombie-mermaid/issues/495#issuecomment-5572303164),
2026-09-06, moved there from PR #562 per review feedback) measured the
two technical risks #495 itself flagged as open questions, rather than
leaving them as assumptions:

- **Bundle size.** Current measured gzip sizes (`pnpm run check:bundle-size`
  over the real build): `dist/index.js` (SVG + ASCII, ELK.js included) 76.3 KB
  against a 110 KB budget; `dist/ascii.js` (ASCII-only, no ELK.js) 46.5 KB
  against a 65 KB budget. A realistic Go→WASM comparison (TinyGo, the only
  compiler viable at this size — plain Go's runtime alone is ~2 MB raw
  before any application code) lands real, non-trivial programs at roughly
  200 KB–2 MB raw, ~50–70 KB+ gzip once glue/marshalling code is included.
  The closest real-world analog — `yoga-layout`, a shipped npm package
  wrapping a C++ layout engine as WASM — spans roughly 45 KB (modern,
  heavily tuned) to ~600 KB gzip (older prebuilt variant) in practice. Best
  case is size-parity with the current SVG entry point; the ASCII-only
  entry point — which today pays zero layout-engine cost specifically to
  stay small — has no equivalent escape hatch under a mandatory compiled
  WASM core, since Go/WASM has no code-splitting analog to "just don't
  import ELK.js." Regression there is close to certain.
- **Synchronous rendering.** The README and `docs/react-integration.md`
  both describe fully synchronous rendering (no `await`, works inside
  `useMemo()` in a component body) as load-bearing, not incidental.
  Correcting the prior research comment's now-stale figure: Chrome's
  synchronous main-thread `WebAssembly.Module()`/`WebAssembly.Instance()`
  cap was raised from 4 KB to **8 MB**, shipped in Chrome 115 (2023) —
  confirmed via [chromestatus.com's feature entry](https://chromestatus.com/feature/5099433642950656),
  which also notes Firefox and Safari show no public signal on whether they
  match this specific relaxation, so cross-browser sync-compile behavior at
  this size isn't independently confirmed. A realistic TinyGo core (200
  KB–2 MB raw, per the bundle-size research above) fits under Chrome's 8 MB
  cap, so the raw _compile_ step is no longer the categorical blocker the
  earlier draft claimed. The real constraint moves one layer over, into how
  those bytes reach the page without an async step: synchronously fetching
  a separate `.wasm` asset isn't possible (network requests are inherently
  async, short of a deprecated, main-thread-blocking synchronous XHR), so
  the only way to keep the whole call chain synchronous is inlining the
  compiled binary as base64 directly inside the JS bundle — which folds
  this concern back into the bundle-size problem above rather than
  resolving it: a 200 KB–2 MB binary, base64-inflated by roughly a third,
  landing inside the same bundle the ASCII entry point exists specifically
  to keep small. The alternative — fetch/instantiate once asynchronously at
  app startup, call synchronously per render thereafter — is still a
  breaking change to the documented zero-async contract, just a smaller one
  than previously described (async once at boot, not async or size-capped
  on every call).

### A related, narrower prototype was already tried and rejected

[#540](https://github.com/dfadler/zombie-mermaid/issues/540) prototyped the
lowest-risk adjacent shape — a native Go binary (not WASM) invoked from
TypeScript over a subprocess boundary, flowchart-only ASCII — and is
recorded as **not adopted** in
[`docs/decisions/core-bindings-split-not-adopted.md`](./core-bindings-split-not-adopted.md).
That prototype found ~91 ms/call subprocess-spawn overhead (with no
underlying compute benchmark showing Go renders faster than TS — the 91 ms
is pure IPC/process overhead), a 1.76 MB stripped binary needing
cross-compilation for 3 OSes × 2 archs, and an estimated 6–10 person-weeks
for a flowchart-only, Node/CLI-only port before the other five diagram
types. That decision is about a different mechanism (subprocess, not WASM)
than #495 proposes, but it's the same underlying question — move the core
out of TypeScript — and it independently found no benefit on the one axis
(raw performance) a subprocess approach could plausibly have helped with.

## Decision

**Recommend not proceeding with #495 as scoped.** None of the three
candidate motivations named in the issue holds up against the project's
actual signals:

- No demonstrated performance problem exists to fix — the current
  TypeScript renderer is fast (single-digit to low-double-digit
  milliseconds per render, CI-gated against a checked-in baseline), and no
  issue or benchmark says otherwise.
- No non-JS consumer has ever asked for a native package or FFI surface —
  the entire multi-language thread (#443, #495, #536, #540) is
  maintainer-initiated exploration, not a response to demand.
- The two concrete technical costs #495 itself flagged as open questions
  turn out to be real, hard constraints once measured, not just
  uncertainties: bundle size would very likely regress (certainly for the
  ASCII-only entry point, which exists specifically to stay small), and the
  documented synchronous-rendering guarantee can only be preserved
  end-to-end by inlining the compiled binary into the JS bundle — folding
  straight back into the same bundle-size cost — or by accepting a breaking
  async-at-startup change to the public API.
- The one related prototype that _was_ built (#540, a native-binary
  subprocess approach rather than WASM) found a real overhead cost and no
  measured benefit, for a fraction of #495's scope (one diagram type, one
  target).

This is a **no-go, not a "not yet."** The blockers aren't sequencing or
resourcing — they're bundle-size and synchronous-rendering constraints this
project has explicitly and repeatedly chosen to keep (the README's tracked
Bundle Size badge, the `./ascii` subpath's entire reason to exist, the
`useMemo()`-in-render-body pattern) and that a Go→WASM core cannot satisfy
at the scale six diagram types' worth of parsing and layout requires. A
future re-proposal would need to either accept breaking both of those
guarantees, or present a motivation strong enough to justify breaking them
— and, as of this analysis, no such motivation has been articulated or
requested by anyone outside this repo's own exploratory issue chain.

## Consequences

- This doc does not close [#495](https://github.com/dfadler/zombie-mermaid/issues/495)
  — the recommendation above is for the repo owner to act on (close,
  downgrade to "explored, not pursued" mirroring #443's own framing, or
  keep open pending a genuinely new motivation).
- [#443](https://github.com/dfadler/zombie-mermaid/issues/443) shares the
  same "no demonstrated demand" gap and the same now-answered bundle-size
  question; it should be revisited alongside #495 rather than separately,
  though it is narrower (ASCII-only) and doesn't require TS to stop being
  canonical, so it doesn't inherit the synchronous-rendering argument as
  directly.
- Any future re-proposal of moving zombie-mermaid's core out of TypeScript
  — for the browser or for general Node consumption — should start from
  this doc and `core-bindings-split-not-adopted.md` rather than
  re-deriving their measurements, and needs to either name a concrete,
  currently-missing motivation (a real non-JS requester, a demonstrated
  perf problem) or propose a shape that doesn't require breaking bundle
  size or synchronous rendering.
- A narrower, differently-motivated proposal is not ruled out by this doc —
  e.g. a native batch-rendering tool for server-side/CLI bulk use, where
  process-spawn overhead amortizes and binary distribution is a one-time
  ops cost — but that would need its own concrete motivation and its own
  write-up; it is not what #495 asked for.
