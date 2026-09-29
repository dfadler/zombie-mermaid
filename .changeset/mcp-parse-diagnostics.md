---
'@zombie-mermaid/mcp': minor
---

MCP server: when `render_mermaid_svg` or `render_mermaid_ascii` fails on a diagram whose parser reports a line, the error result now carries a second text block with `{"diagnostics":[{"line","sourceLine","message"}]}` (1-based line in the submitted source, the offending line verbatim, and the parser message). The first content block and `isError: true` are unchanged; errors with no line information (for example an empty diagram) return only the plain message. No column is reported because no parser tracks one, and no lines are stripped or partially rendered.
