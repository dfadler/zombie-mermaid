---
'zombie-mermaid': patch
---

Implements the #622 publish strategy (issue #769): `@zombie-mermaid/core`,
`@zombie-mermaid/mermaid-parser`, `@zombie-mermaid/svg-renderer`,
`@zombie-mermaid/ascii-renderer`, and `@zombie-mermaid/mcp` are now real,
independently-built dependencies of the published `zombie-mermaid` package
instead of bundled straight into its `dist/`. `dist/index.js`/`dist/ascii.js`/
`dist/mcp.js` are correspondingly much smaller — they now import those
packages rather than inline their compiled source.

This is a packaging change only: `zombie-mermaid`'s own public API (`.`,
`./ascii`, `./mcp`) and every documented export are unchanged, verified by
loading the built output and by the full existing test suite passing
unmodified. `.changeset/config.json`'s `fixed` group keeps all six packages
(this one plus the five above) on the same version going forward.

The five `@zombie-mermaid/*` packages are not yet actually published to
npm — that needs a one-time, maintainer-only npm trusted-publishing setup
per package name (see RELEASING.md) before the next release can publish
them for real.
