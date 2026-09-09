# Spike: real CI time cost of a `container:` job vs. current `actions/cache` install

Answers [#547](https://github.com/dfadler/zombie-mermaid/issues/547). Feeds
[#548](https://github.com/dfadler/zombie-mermaid/issues/548) (decision, already
closed go/no-go — the container migration shipped as
[#549](https://github.com/dfadler/zombie-mermaid/issues/549), merged in PR
[#651](https://github.com/dfadler/zombie-mermaid/pull/651)). Part of the Docker
tracking cluster, [#544](https://github.com/dfadler/zombie-mermaid/issues/544).

## Summary

Real per-shard CI timing, measured before and after the `container:` job migration
(PR #651), both pulled from this repo's own CI run history (`gh run view --json
jobs`), not estimated:

|                                            | Install/init step   | Total shard job     |
| ------------------------------------------ | ------------------- | ------------------- |
| Pre-migration, cache hit (6 runs)          | ~14.7s avg (12–28s) | ~47s avg (40–67s)   |
| Pre-migration, cache miss (2 runs)         | ~23.5s avg (21–26s) | ~57.5s avg (55–60s) |
| Post-migration, `container:` job (10 runs) | ~29.5s avg (25–42s) | ~70.5s avg (62–90s) |

**The container job is measurably slower per shard**: roughly +15s init / +23s
total job time (+49%) vs. the cache-hit baseline, or +6s / +13s (+22%) vs.
cache-miss. Across this job's 4-shard matrix, that's an extra ~92s of billed
Actions-minutes per run compared to cache-hit.

This does **not** reopen #548's decision — the migration already shipped for
cross-platform baseline consistency, not speed (see #544 and
`docs/decisions/playwright-docker-image-visual-regression.md`) — but it replaces
this spike's original "roughly a wash" _estimate_ with a real number for any
future review of that tradeoff.

Full methodology, the original pre-migration estimate (superseded once real
post-migration data existed), per-run tables, and the raw commands used are in
[a comment on #547](https://github.com/dfadler/zombie-mermaid/issues/547) rather
than duplicated here.
