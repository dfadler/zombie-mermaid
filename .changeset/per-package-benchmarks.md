---
---

No release: adds isolated per-package performance benchmarks (#875, split
from #869). `bench.ts` only measured full end-to-end render time (SVG +
ASCII), so a regression anywhere in the pipeline showed up as just "render
got slower" with no way to tell which package caused it. Four new scripts —
`scripts/bench-core.ts` (`pnpm run bench:core`), `scripts/bench-mermaid-parser.ts`
(`pnpm run bench:mermaid-parser`), `scripts/bench-svg-renderer.ts`
(`pnpm run bench:svg-renderer`), and `scripts/bench-ascii-renderer.ts`
(`pnpm run bench:ascii-renderer`) — each time only that package's own code
against the existing sample corpus (`samples-data.ts`), with any
cross-package setup (e.g. `splitStatements`, or a parsed diagram from a
different package) done untimed first. `scripts/bench-package-compare.ts` is
the per-package analog of `scripts/bench-compare.ts`, reusing the same
deliberately loose threshold philosophy (catch an algorithmic blowup, not
CI-runner noise) against a per-package baseline that a maintainer seeds from
a real CI run — none is committed yet, so the gate no-ops until one exists,
same bootstrap pattern `bench-history.jsonl` used for #874. Each script's
`--json=` output reuses `bench.ts`'s own summary shape
(`generatedAt`/`sampleCount`/`categories`), narrowed to one `totalMs` metric
per category instead of that script's `svgMs`/`asciiMs` split, since each
per-package benchmark measures one kind of work, not two. Root tooling only
— nothing here touches the published `zombie-mermaid` package or any
`packages/*` package.
