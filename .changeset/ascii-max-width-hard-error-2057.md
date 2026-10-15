---
'zombie-mermaid': major
'@zombie-mermaid/core': major
'@zombie-mermaid/mermaid-parser': major
'@zombie-mermaid/svg-renderer': major
'@zombie-mermaid/ascii-renderer': major
'@zombie-mermaid/mcp': major
---

**BREAKING:** the CLI's `-w/--max-width` now fails (exit 1, message on stderr, nothing written) when ASCII output is still wider than the limit after the automatic compact-spacing retry; it used to print a warning and exit 0 with the full diagram. See [Upgrading from 5.x to 6.x](https://github.com/dfadler/zombie-mermaid/blob/main/docs/guides/upgrading-5x-to-6x.md#--max-width-is-now-an-error). New: `renderMermaidASCII(source, { maxWidth })` (hard limit with the same compact retry; throws the new `AsciiWidthError`, `code: 'WIDTH_EXCEEDED'`, with `actualWidth`, `maxWidth` and `compactApplied`) and a `maxWidth` argument on the MCP `render_mermaid_ascii` tool (an over-wide diagram returns `isError`). There is no default width, and `profile: 'markdown'` does not set one; without `maxWidth` the output is byte-identical.
