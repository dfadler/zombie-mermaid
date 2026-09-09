---
---

No release: closes #551 (baseline PNG consolidation) with a measured "keep
as-is" decision rather than a code change. Using #837's Docker wrapper, ran
all 190 SVG visual-regression samples natively on macOS and, independently
twice, inside the pinned Linux container, with a run-to-run container
control to separate a real native-vs-container effect from ordinary
screenshot jitter. Found a real, systematic difference (41% of samples
diverge beyond the suite's own jitter floor), driven by the two OSes
resolving the renderer's font stack to different typefaces (macOS's San
Francisco vs. the container's DejaVu Sans/DejaVu Sans Mono font layer) — the
same font-rendering rationale #544 originally cited for the `-linux`/
`-darwin` baseline split. Decision, full method, and data are in
`docs/research/551-native-vs-container-svg-parity.md` and the 2026-09-09
"#551 answered" amendment to
`docs/decisions/playwright-docker-image-visual-regression.md`.
CONTRIBUTING.md's "Visual regression tests" section is updated to match. No
baseline PNGs, `playwright.config.ts`, or rendering code change — the split
stays exactly as it is today. Docs only; nothing here touches the published
`zombie-mermaid` package.
