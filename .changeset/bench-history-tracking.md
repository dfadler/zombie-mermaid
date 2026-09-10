---
---

No release: adds performance-trend tracking across CI benchmark runs
(#874, split from #869). `bench.ts --json=` summaries already got compared
per-run against one static baseline (`bench-baseline.json`, via
`scripts/bench-compare.ts`) but nothing showed drift across weeks/months.
`scripts/bench-history-append.ts` now appends each push-to-main run's
summary as one JSON-Lines row to a new tracked `bench-history.jsonl`
(reuses `bench.ts`'s existing `--json=` contract rather than inventing a
second format), wired into a new `bench-history` job in
`.github/workflows/ci.yml` that opens a PR with the updated file (same
split-job / PAT pattern `dashboard-refresh.yml` already uses, and for the
same reason: never run `pnpm install` in the job holding the repo-write
PAT). `scripts/bench-trend.ts` (`pnpm run bench:trend`) reads that history
and prints a table, sparkline, and per-category first-vs-last delta over
the most recent runs. Only touches root `package.json` scripts and repo
tooling — nothing here touches the published `zombie-mermaid` package or
any `packages/*` package.
