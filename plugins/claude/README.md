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

## Dependency updates

`package.json` pins `zombie-mermaid` exactly and `npm-shrinkwrap.json` locks its
transitive packages. Dependabot (`/plugins/claude` in `.github/dependabot.yml`,
7-day cooldown, one grouped PR) bumps the pin and regenerates the shrinkwrap, so
there is no release-workflow step (#2504). A new release therefore reaches the
plugin after the cooldown plus the next weekly run. For an urgent bump, edit
`package.json` and run `npm install --package-lock-only --ignore-scripts` here.

`pnpm run check:plugin-lock` (part of `pnpm run verify`) fails if the pin and the
shrinkwrap disagree or `npm ci --dry-run --ignore-scripts` fails. The pin/shrinkwrap
agreement is also a vitest test, so CI enforces it.
