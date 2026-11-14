# Project objective

Status: accepted (maintainer decided the direction on 2026-10-15, answered the seven open questions and accepted this doc on 2026-10-29)

## Decision

Decision:

- Objective (maintainer, 2026-10-15, "Option B"): the best Mermaid renderer for terminals and agents; static SVG plus ASCII/Unicode, no DOM dependency; library, CLI and MCP server.
- The full write-up defines what "reasonably reproduce Mermaid" means, scope, non-goals, ASCII and SVG parity, and the relationship to beautiful-mermaid and mermaid.js.
- Support policy: latest major only, no backports, no formal SLA.
- A "gap" is a mermaid.js diagram type or valid syntax not yet handled, or an unlisted behavior or layout difference; visual differences (font, colour, pixels) are never gaps.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/1564#issuecomment-6884746220
