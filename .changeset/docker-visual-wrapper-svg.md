---
---

No release: extends #550's local Docker wrapper (renamed
`scripts/docker-test-visual-ascii.sh` → `scripts/docker-test-visual.sh`) with
a `--suite ascii|svg|all` option so a contributor can also run the SVG half
of the visual-regression suite (or the full suite) locally inside the same
pinned, font-corrected `mcr.microsoft.com/playwright:*` image CI uses,
instead of only the ASCII half. Safe now that #545's flag-matched spike
(`CI=true`, matching CI's `retries: 2`) ruled out architecture as a driver of
SVG divergence, superseding #615's earlier, un-flag-matched reading that the
wrapper's ASCII-only restriction was based on. The container run now sets
`CI=true` to match. CONTRIBUTING.md's "Visual regression tests" section and
`docker/visual-regression.Dockerfile`'s header comment are updated to match.
Dev-tooling and docs only — nothing here touches the published
`zombie-mermaid` package. Closes #837.
