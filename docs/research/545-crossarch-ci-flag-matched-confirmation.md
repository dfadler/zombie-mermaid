# Research: closing #545 — flag-matched, same-commit, real-CI-compared cross-arch confirmation

Status: **spike, answered — closes #545 and #615's remaining gaps.**

The full method, results, and reproduction steps are written up as a comment on
[#545](https://github.com/dfadler/zombie-mermaid/issues/545#issuecomment-5606427602)
rather than duplicated here.

## Summary

Three full-suite runs (843 executions) on a real, native Apple Silicon Mac,
flag-matched to CI's actual configuration (`CI=true`, `retries: 2`), against
the exact commit real x86 CI was evaluating at the same time — passed 843/843
in the final tally (2 ordinary SVG flakes, cleared by retry; zero ASCII
failures). Real x86 CI on that same commit showed **more** jitter (17/70
flaky, 1 hard failure in one shard) than any of the quiet-host arm64 runs —
the opposite of an arm64-instability theory. **Architecture is ruled out** as
a driver of visual-regression screenshot divergence.

This does **not** resolve [#551](https://github.com/dfadler/zombie-mermaid/issues/551)
(baseline consolidation) — that needs a still-untested native-macOS-vs-container
comparison, not an arch comparison. The concrete prerequisite is filed as
[#837](https://github.com/dfadler/zombie-mermaid/issues/837).

See the [#545 comment](https://github.com/dfadler/zombie-mermaid/issues/545#issuecomment-5606427602)
for full detail.
