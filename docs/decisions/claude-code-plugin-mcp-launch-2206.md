# Claude Code plugin: how the MCP server is launched

Status: proposal

## Decision

Proposed, not shipped. Use option B: a plugin directory whose `package.json` depends on an exact `zombie-mermaid` version, committed with an `npm-shrinkwrap.json`, and a `.mcp.json` that runs the installed `dist/cli.js` with `node`.

- Keep D (documented global install) as the fallback where B's dependency install is skipped.
- Reject A (`npx -y zombie-mermaid mcp`) for the plugin: it fetches and runs code at every start. It stays in the README for manual setup.
- Defer C (committed single-file bundle).
- Unverified, to settle in the implementing PR: `@resvg/resvg-js` under a frozen scripts-off install, plugin MCP approval prompts, workspace/changesets exclusion of the plugin directory, and the default MCP startup timeout.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/2206#issuecomment-6884746641
