# zombie-mermaid Claude Code plugin

A skill plus an MCP server for rendering and validating Mermaid diagrams.

Install: `/plugin install zombie-mermaid --marketplace dfadler/zombie-mermaid`

**Requires Node.js 24 or newer on `PATH`.** `.mcp.json` launches the bundled
`zombie-mermaid` package with plain `node`, and the package does not check the
Node version itself, so on an older Node the server or CLI fails with a raw
syntax or API error rather than a clear message. Check with `node --version`.

`skills/zombie-mermaid/SKILL.md` is generated from the repo's
`skills/zombie-mermaid/SKILL.md` (it points at the pinned install instead of
`npx`). Edit the original, then run `pnpm run sync:plugin-skill`.
