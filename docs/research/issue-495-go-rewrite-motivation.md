# Research: motivation check for #495 (Go core rewrite)

🤖 **Claude:** This document was produced by an AI assistant investigating
[issue #495](https://github.com/dfadler/zombie-mermaid/issues/495) at
@dfadler's request, as part of an oldest-first backlog sweep. It answers the
issue's own explicit gap ("the specific motivation ... hasn't been spelled
out yet") with measured data rather than assumption. This is scoping/research
only — no renderer code was changed, no Go was written, and no rewrite was
started.

## Summary

The evidence does not support proceeding with a Go-core rewrite. Both of the
issue's own flagged risks turn out to be real, hard constraints rather than
open questions:

- **Bundle size would very likely regress**, not improve, for the SVG entry
  point, and would almost certainly regress for the ASCII-only entry point,
  which today deliberately avoids paying any layout-engine cost at all.
- **Synchronous rendering is genuinely load-bearing** (README, code, and
  `docs/react-integration.md` all confirm it), and a Go→WASM core cannot
  preserve it as an unconditional guarantee in the primary target
  environment (Chrome, and any main-thread browser context) once the
  compiled module exceeds a few KB — which any real parsing+layout core
  for six diagram types will.

Recommendation: **do not scope further implementation work.** Close or
downgrade #495 to "explored, not pursued" (mirroring #443's own
research-spike framing), citing this document. If a non-JS-host or
distribution motivation independent of bundle size/sync-rendering ever gets
articulated concretely, it would need to overcome both of the findings
below on its own merits — this doesn't rule out _ever_ revisiting it, only
rules out proceeding on the motivation as currently (un)stated.

The measured bundle-size table, the Go→WASM size comparison research (with
sources), the full synchronous-rendering constraint analysis, the
cross-reference with #443, and the appendix on how these numbers were
produced all live in
[issue #495's own comment thread](https://github.com/dfadler/zombie-mermaid/issues/495#issuecomment-5572303164)
rather than duplicated here — see that comment for the fuller context behind
the summary above.
