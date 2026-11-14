# Research: font-corrected Playwright Docker image, ASCII/terminal baseline parity

As of: 2026-10-22, reviewed against `main` @ `bd0a701c`. Cited files exist; the measured numbers were not re-run. Re-measure before quoting one as current.

Status: **answered, with a correction to the recommended fix.** Written for
[#614](https://github.com/dfadler/zombie-mermaid/issues/614), part of the
[#544](https://github.com/dfadler/zombie-mermaid/issues/544) Docker tracking cluster.
Closes gap (2) of the two gaps
[docs/decisions/playwright-docker-image-visual-regression.md](../decisions/playwright-docker-image-visual-regression.md)
identified as blocking a real go/no-go in
[#548](https://github.com/dfadler/zombie-mermaid/issues/548).

## Conclusion

Conclusion (measured on arm64; the numbers were not re-run):

- A one-package layer (`fonts-dejavu-core`) on the pinned base tag takes the ASCII suite from 88/90 failing to 0/90, against the same committed baselines, three runs in a row.
- `fonts-jetbrains-mono` and the named faces do not help (90/90 failing): `.ascii-panel`'s font stack never applies, because the UA stylesheet sets `code { font-family: monospace }`.
- The 88 failures were font fallback only; no architecture difference survives the fix.
- For #548: `docker/visual-regression.Dockerfile` is ready; the amd64 CI run (gap 1) is still the blocker and should use this image and cover both suites.
- Side finding: the live demo's ASCII panel does not render in JetBrains Mono either.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/614#issuecomment-6884746430
