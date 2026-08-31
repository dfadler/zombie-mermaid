---
'zombie-mermaid': minor
---

Add an official MCP (Model Context Protocol) server exposing `render_mermaid_svg` and `render_mermaid_ascii` tools, so MCP clients (Claude Desktop, Claude Code, etc.) can render Mermaid diagrams directly. Run it via the new `zombie-mermaid mcp` CLI subcommand (stdio transport), or embed it yourself with `createMcpServer()` from the new `zombie-mermaid/mcp` export subpath and connect it to any MCP `Transport`. Both tools are thin wrappers around the library's existing `renderMermaidSVG`/`renderMermaidASCII` — no new rendering logic. Adds `@modelcontextprotocol/sdk` and `zod` as new dependencies, scoped to the `/mcp` subpath and `dist/cli.js` (the root `zombie-mermaid`/`zombie-mermaid/ascii` exports are unaffected).
