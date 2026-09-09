# Research: closing #551 — does native macOS Playwright match the containerized SVG output?

Status: **spike, answered — closes #551. Decision: keep the `-linux`/`-darwin` baseline split as-is. No consolidation, no rename.**

The full method, data, and reproduction steps are written up as a comment on
[#551](https://github.com/dfadler/zombie-mermaid/issues/551#issuecomment-5607848621)
rather than duplicated here.

## Summary

Ran all 190 SVG samples natively on macOS, and twice inside the pinned
container (the second run as a jitter control), on the same Apple Silicon
Mac. Two container runs are pixel-identical for the median sample, yet 41%
of samples (78/190) show a native-vs-container diff that clearly exceeds
that near-zero jitter floor — including several samples byte-identical
across both container runs while still differing from native macOS by a
reproducible amount. Root cause: the renderer's font stack falls back to a
genuinely different typeface on each OS (macOS's San Francisco vs. the
container's DejaVu Sans/DejaVu Sans Mono) — the same font-rendering
rationale #544 originally cited for the `-linux`/`-darwin` split existing at
all, now directly confirmed for the container case too.

**Decision: keep the split as-is.** No consolidation (a real fraction of
samples would fail permanently or force the suite's tolerance to loosen
suite-wide) and no architecture-based rename (#545 already ruled out
architecture as the driver — the current naming already reflects the real
one).

**Follow-up worth its own issue**: this measurement host's own native
capture also diverges non-trivially from the already-committed
`-chromium-darwin.png` baselines (a font-duplication artifact — a variable
and static JetBrains Mono both installed under the same family name — that
CONTRIBUTING.md's existing darwin caveat already warns about). It doesn't
undermine this spike's core finding (validated independently via the
container run-to-run control), but it's a real, separate signal about this
host's own environment worth tracking on its own.

See the [#551 comment](https://github.com/dfadler/zombie-mermaid/issues/551#issuecomment-5607848621)
for full detail.
