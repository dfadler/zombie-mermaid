---
'zombie-mermaid': patch
---

Demo-site only: the "What this fork fixes" page's `render: 'ascii'` before/after pairs now show real-terminal screenshots instead of `ascii-html.ts`'s browser/CSS approximation of a terminal.

That approximation is the same one the live demo and the Playwright visual-regression suite use, and this repo has already shipped a bug in its chrome that the underlying renderer never had (the `ascii-terminal-overflow-scroll` fix) — proof the mockup and a real terminal can drift. `scripts/capture-fork-fixes-terminal.ts` now records each ascii-mode entry's actual CLI invocation (`zombie-mermaid render <file> --ascii`, no `--theme` flag — the real default) in a genuine PTY via `asciinema`, renders it with `agg`'s real terminal-cell algorithm, and extracts a still PNG with `ffmpeg`. The 19 resulting screenshots (one before/after pair per ascii entry, minus the one pair whose "before" renders nothing) are committed under `public/fork-fixes-screenshots/`. `fork-fixes.ts` uses a screenshot when one exists and falls back to the old HTML mockup otherwise, so a future ascii entry added without re-running the capture script still builds.
