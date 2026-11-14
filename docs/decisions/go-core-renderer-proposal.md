# Go core renderer with TypeScript bindings (#495): recommendation

Status: not adopted

## Decision

- **Not proceeding with #495 as scoped.** None of the three candidate motivations holds up against the project's actual signals.
- No demonstrated performance problem, and no non-JS consumer has asked for a native package or FFI surface.
- Bundle size would very likely regress, and the synchronous-rendering guarantee survives only by inlining the binary (same size cost) or a breaking async-at-startup API change.
- A no-go, not a "not yet". #495 and #443 are closed out; see also [`core-bindings-split-not-adopted.md`](./core-bindings-split-not-adopted.md).
- A narrower proposal (e.g. native batch rendering for server-side use) is not ruled out but needs its own motivation.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/495#issuecomment-6884747527
