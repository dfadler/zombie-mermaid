# Docs

Reference material that doesn't fit in the main [README](../README.md).
Single-topic files, plus two grouped directories: task-oriented walkthroughs in
[guides/](guides/), and settled-decision records in [decisions/](decisions/).

- [guides/](guides/) — task-oriented walkthroughs: browsing the samples, choosing a theme
- [accessibility.md](accessibility.md) — the accessibility conformance statement: what's guaranteed (and CI-enforced), what's implemented but unverified by automation, and what isn't covered
- [theming.md](theming.md) — the two-color foundation, enriched mode, built-in themes, custom themes, Shiki compatibility
- [diagrams.md](diagrams.md) — syntax for each supported diagram type, XY chart styling, and ASCII rendering
- [react-integration.md](react-integration.md) — using `renderMermaidSVG` with `useMemo()` for zero-flash rendering
- [api-reference.md](api-reference.md) — full function and options reference
- [migrating-from-beautiful-mermaid.md](migrating-from-beautiful-mermaid.md) — what's drop-in, which fixes change rendered output, and how to audit your own diagrams before upgrading
- [xychart-design.md](xychart-design.md) — original design proposal for `xychart-beta` support (historical; see [diagrams.md](diagrams.md) for current behavior)
- [decisions/](decisions/) — short records of settled decisions that closed off an alternative worth remembering
