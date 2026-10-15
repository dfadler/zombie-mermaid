---
'@zombie-mermaid/mcp': minor
---

MCP server: `render_mermaid_svg` and `render_mermaid_ascii` now render in a long-lived worker thread. A render that runs longer than 15 s, or exceeds 512 MB of heap, is stopped and returns the usual `isError` result ("render timed out ..." / "render ran out of memory ..."); the server stays responsive and the next request gets a fresh worker. Previously such a render stalled every request or killed the stdio server. Rendered output is byte-identical, and no tool name, schema or result shape changes. The package now ships `dist/render-worker.js` next to its entry files.
