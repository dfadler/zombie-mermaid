# Go core renderer with TypeScript bindings (#495): recommendation

## Context

[#495](https://github.com/dfadler/zombie-mermaid/issues/495) proposed
rewriting zombie-mermaid's core (parsing + layout, all six diagram types)
as a Go library — compiled to native Go, WASM, and potentially a C-ABI
shared library from one source of truth — with idiomatic per-language
interfaces on top, TypeScript required among them. The issue was explicit
that it was scope-and-motivation-only: the specific motivation (perf, code
sharing with a non-JS host, distributing a single core to multiple
ecosystems) hadn't been spelled out yet and needed to be filled in before
any implementation work started.

Three candidate motivations were named in the issue body — performance,
non-JS host/code-sharing demand, and distributing one core to multiple
ecosystems — and each was checked against actual project signals rather
than assumed, alongside two technical risks the issue itself flagged as
open questions (bundle size, synchronous rendering).

**Full findings are recorded on the issue: [#495 findings comment](https://github.com/dfadler/zombie-mermaid/issues/495#issuecomment-5600330269).**
A related, narrower prototype (a native Go binary invoked over a
subprocess boundary, not WASM) was already tried and rejected; see
[`docs/decisions/core-bindings-split-not-adopted.md`](./core-bindings-split-not-adopted.md).

## Decision

**Not proceeding with #495 as scoped.** None of the three candidate
motivations holds up against the project's actual signals:

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

- [#495](https://github.com/dfadler/zombie-mermaid/issues/495) and
  [#443](https://github.com/dfadler/zombie-mermaid/issues/443) are closed
  out by this decision — #443 shares the same "no demonstrated demand" gap
  and the same now-answered bundle-size question, so it's resolved
  alongside #495 rather than separately.
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
