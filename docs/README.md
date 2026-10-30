# Docs

Reference material that doesn't fit in the main [README](../README.md).
Single-topic files, plus three grouped directories: task-oriented walkthroughs in
[guides/](guides/), settled-decision records in [decisions/](decisions/), and
an index of removed investigation write-ups in [research/](research/) (findings live on their issues).

- [guides/](guides/) — task-oriented walkthroughs: choosing a package, browsing the samples, choosing a theme, upgrading from 2.x to 5.x
- [development-scripts.md](development-scripts.md) — the less common `package.json` scripts: site generators, benchmarks, bundle-size and coverage checks
- [visual-regression.md](visual-regression.md) — the Playwright screenshot suite: ASCII mockup fidelity probes, the containerized Linux baselines, and darwin font pitfalls
- [RELEASING.md](RELEASING.md) — the changesets-based release flow and npm trusted-publishing setup
- [brand.md](brand.md) — the two wordmark forms (`ZombieMermaid` in a logo lockup, `Zombie Mermaid` everywhere else) and what stays `zombie-mermaid`
- [accessibility.md](accessibility.md) — the accessibility conformance statement: what's guaranteed (and CI-enforced), what's implemented but unverified by automation, and what isn't covered
- [theming.md](theming.md) — the two-color foundation, enriched mode, built-in themes, custom themes, Shiki compatibility
- [diagrams.md](diagrams.md) — syntax for each supported diagram type, XY chart styling, and ASCII rendering
- [known-differences.md](known-differences.md) — verified differences from mermaid.js that are intentional or not yet fixed: subgraph inner direction, layout tie-breaks, ER parser leniency
- [mcp-tools.md](mcp-tools.md) — per-tool reference for the MCP server: arguments, `bg`/`fg`, `outputPath` rules, return shapes
- [react-integration.md](react-integration.md) — using `renderMermaidSVG` with `useMemo()` for zero-flash rendering
- [api-reference.md](api-reference.md) — full function and options reference
- [testing-conventions.md](testing-conventions.md) — the RTL pattern for demo/editor component tests, and when a literal-value or snapshot assertion is still the right call
- [migrating-from-beautiful-mermaid.md](migrating-from-beautiful-mermaid.md) — what's drop-in, which fixes change rendered output, and how to audit your own diagrams before upgrading
- [xychart-design.md](xychart-design.md) — original design proposal for `xychart-beta` support (historical; see [diagrams.md](diagrams.md) for current behavior)
- [provenance.md](provenance.md) — how this fork relates to beautiful-mermaid, who maintains it, how releases are published, AI-assisted authorship, and what is and is not claimed
- [promotion/outreach-rules.md](promotion/outreach-rules.md) — rules for any comment on an upstream thread: bug-specific, disclosed, rate-limited, never posted without the maintainer's go-ahead
- [decisions/](decisions/) — short records of settled decisions that closed off an alternative worth remembering
- [research/](research/) — index to former investigation write-ups, now on their issues; findings go in the issue, and a doc here only when something else links to it
