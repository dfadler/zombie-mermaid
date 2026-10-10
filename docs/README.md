# Docs

Reference material that doesn't fit in the main [README](../README.md).
Single-topic files, plus three grouped directories: task-oriented walkthroughs in
[guides/](guides/), settled-decision records in [decisions/](decisions/), and
investigation and measurement write-ups in [research/](research/).

- [guides/](guides/) — task-oriented walkthroughs: choosing a package, browsing the samples, choosing a theme
- [development-scripts.md](development-scripts.md) — the less common `package.json` scripts: site generators, benchmarks, bundle-size and coverage checks
- [visual-regression.md](visual-regression.md) — the Playwright screenshot suite: ASCII mockup fidelity probes, the containerized Linux baselines, and darwin font pitfalls
- [RELEASING.md](RELEASING.md) — the changesets-based release flow and npm trusted-publishing setup
- [brand.md](brand.md) — the two wordmark forms (`ZombieMermaid` in a logo lockup, `Zombie Mermaid` everywhere else) and what stays `zombie-mermaid`
- [accessibility.md](accessibility.md) — the accessibility conformance statement: what's guaranteed (and CI-enforced), what's implemented but unverified by automation, and what isn't covered
- [theming.md](theming.md) — the two-color foundation, enriched mode, built-in themes, custom themes, Shiki compatibility
- [diagrams.md](diagrams.md) — syntax for each supported diagram type, XY chart styling, and ASCII rendering
- [react-integration.md](react-integration.md) — using `renderMermaidSVG` with `useMemo()` for zero-flash rendering
- [api-reference.md](api-reference.md) — full function and options reference
- [testing-conventions.md](testing-conventions.md) — the RTL pattern for demo/editor component tests, and when a literal-value or snapshot assertion is still the right call
- [migrating-from-beautiful-mermaid.md](migrating-from-beautiful-mermaid.md) — what's drop-in, which fixes change rendered output, and how to audit your own diagrams before upgrading
- [xychart-design.md](xychart-design.md) — original design proposal for `xychart-beta` support (historical; see [diagrams.md](diagrams.md) for current behavior)
- [decisions/](decisions/) — short records of settled decisions that closed off an alternative worth remembering
- [research/](research/) — investigation and measurement write-ups (spikes, timings, audits), one file per issue; findings also go in the issue
- [parser-error-audit-541.md](parser-error-audit-541.md) — historical audit of parser error messages (superseded by [research/541-parser-error-audit-followup.md](research/541-parser-error-audit-followup.md))
