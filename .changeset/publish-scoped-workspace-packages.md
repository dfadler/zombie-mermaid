---
'zombie-mermaid': patch
---

Implements the #622 publish strategy: `@zombie-mermaid/core`,
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

`@zombie-mermaid/ascii-renderer` and `@zombie-mermaid/svg-renderer` are now
documented, standalone-usable packages (see their own READMEs) for anyone
who wants just ASCII rendering or just SVG layout/render primitives without
the full umbrella. `core`, `mermaid-parser`, and `mcp` stay internal-only:
published under the scope so the names can't be squatted, version-locked
with the rest, but with no standalone support commitment beyond backing the
umbrella (and, for `svg-renderer`/`ascii-renderer`, the two now-public
packages).
