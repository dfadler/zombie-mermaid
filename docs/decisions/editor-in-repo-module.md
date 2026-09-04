# Editor stays in-repo, modeled on the MCP server

## Context

The live editor (`editor.ts` + `editor/`) bundles `src/browser.ts` via
esbuild and imports `THEMES` from `src/theme.ts` by relative path — reaching
into this package's internals rather than going through a published,
versioned dependency. [#398](https://github.com/dfadler/zombie-mermaid/issues/398)
originally proposed fixing that by extracting the editor into its own
`zombie-mermaid-editor` repo, consuming `zombie-mermaid` as a real npm
dependency.

That plan was reconsidered against an existing precedent already in this
repo: the MCP server (`src/mcp/`, added in
[#361](https://github.com/dfadler/zombie-mermaid/pull/361)) has the exact
same shape of internal coupling — it imports `../index.ts`,
`../ascii/index.ts`, and `../package-info.ts` by relative path, not through
the published package — and that was an accepted, deliberate design: same
package, same source tree, exposed externally only via a `package.json`
`exports` subpath (`"./mcp"`) built alongside the rest of the package by
whatever the current library build is (Vite's library mode, as of
[#378](https://github.com/dfadler/zombie-mermaid/pull/378) — previously
tsup). There is no version-pinning problem, no separate `package.json`, no
separate release process — it ships and versions together with the rest of
the package.

A separate `zombie-mermaid-editor` repo, stood up now, would need to solve a
dependency-boundary problem (version pinning, keeping `THEME_LABELS` in sync
with `THEMES` across a package boundary, redirect/hosting for the existing
`/editor` page) that the MCP precedent shows isn't actually required to get
a well-isolated module. It would also likely be partially undone by a
planned future monorepo conversion of this repo (splitting the core
renderer, CLI, MCP server, editor, and demo site into proper workspace
packages) — extracting to a separate repo ahead of that split is work spent
solving a problem the monorepo work will solve differently.

## Decision

**The editor stays in this repo, structured the same way `src/mcp/` is:**
its own directory (`editor/`, `editor.ts`), free to import sibling source
files by relative path, with no separate repo, no separate `package.json`,
and no requirement to consume `zombie-mermaid` as a published dependency.

This is not a permanent architectural stance — it's a "not yet" pending the
monorepo conversion. When that conversion happens, the editor becomes a
workspace package like any other, and a real dependency boundary (internal
workspace protocol, not necessarily a published-npm one) becomes part of
that broader restructuring rather than a one-off extraction.

## Consequences

- `editor.ts` importing `THEMES` from `../src/theme.ts` directly, and the
  `THEME_LABELS`/`THEMES` sync check that throws at generation time on
  drift, are the accepted pattern here — not a gap to close before this
  issue can be considered done.
- The editor does not get a `package.json` `exports` subpath the way MCP
  does (`"./mcp"`). MCP's subpath exists because external code `import`s
  it; the editor is a generated HTML app nobody imports as a module, so
  there's nothing for an exports entry to expose.
- Standing up a separate `zombie-mermaid-editor` repo, or making the editor
  consume `zombie-mermaid` as a real npm dependency, is deferred until the
  monorepo conversion is scoped. Anyone re-proposing that extraction before
  then should read this ADR first — the reasoning here is why it was
  reconsidered, not an oversight.
- The monorepo conversion itself is not yet tracked as its own issue.
