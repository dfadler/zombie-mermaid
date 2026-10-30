# Claude Code plugin: how the MCP server is launched

Status: proposal

## Context

[#2206](https://github.com/dfadler/zombie-mermaid/issues/2206) recommends a
Claude Code plugin that packages `skills/zombie-mermaid` and the seven-tool MCP
server (`zombie-mermaid mcp`, see README "MCP server"), shipped from this repo
with no `version` field. Its open question is how `.mcp.json` starts the server.
`npx -y zombie-mermaid mcp` fetches and runs code in one step, which the
maintainer's rule for fetch-and-execute installs requires explicit per-run
permission for, and a plugin would run it automatically at every session start.
Nothing here was executed; this is docs reading plus a look at this repo.

Behavior facts, all from the official docs (fetched 2026-10-30):

- Enabling a plugin starts its MCP servers automatically; `.mcp.json` at the
  plugin root defines them, and `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}`
  substitute in `command`, `args` and `env`
  ([MCP: plugin-provided servers](https://code.claude.com/docs/en/mcp)).
- A marketplace plugin is copied into `cache/<marketplace>/<plugin>/<version>/`;
  files outside the plugin directory are not copied
  ([loading: in-place and copied](https://code.claude.com/docs/en/plugins/loading)).
- When the plugin root has a `package.json` and an npm lockfile
  (`npm-shrinkwrap.json` or `package-lock.json`), Claude Code installs the
  dependencies into the cached copy itself: registry packages only, exact
  versions from the lockfile, `--ignore-scripts`, 60 s timeout, skipped if
  `package.json` and the lockfile disagree. `pnpm-lock.yaml` gets no install
  ([loading: Node.js package dependencies](https://code.claude.com/docs/en/plugins/loading#node-js-package-dependencies)).
  The same page says no install happens for a relative-path plugin loaded in
  place from a marketplace added by local path.
- With no `version` in manifest or entry, a relative-path plugin in a
  git-hosted marketplace is versioned by commit SHA
  ([loading: versions](https://code.claude.com/docs/en/plugins/loading#how-claude-code-computes-the-version)).
- Skill Markdown can contain `${CLAUDE_PLUGIN_ROOT}`; Claude Code substitutes it
  inline, but the variable is not in the environment of commands Claude runs
  through Bash ([manifest reference: environment variables](https://code.claude.com/docs/en/plugins/manifest-reference#environment-variables)).
- `claude plugin validate` rejects names starting `claude-` and similar;
  `zombie-mermaid` passes ([manifest reference: name](https://code.claude.com/docs/en/plugins/manifest-reference#name)).

## Options

|                                   | A. `npx -y zombie-mermaid@<ver> mcp`             | B. Dependency in the plugin, run with `node`                | C. Committed single-file bundle | D. Documented global install                |
| --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- | ------------------------------- | ------------------------------------------- |
| Fetch-and-execute at run          | Yes, every server start                          | No: Claude Code's own bounded, script-free install          | No                              | No                                          |
| Meets the per-run-permission rule | Needs approval each time; a plugin cannot get it | Yes                                                         | Yes                             | Yes                                         |
| Needs network at start            | Yes (cache may help)                             | Only at plugin install/update                               | No                              | No                                          |
| Maintenance                       | Bump the pin each release                        | Bump `package.json` + shrinkwrap each release               | Rebuild and commit a bundle     | None                                        |
| Failure mode                      | Registry outage, startup timeout                 | Install skipped (60 s, no lockfile, local-path marketplace) | Stale bundle                    | `command not found` until the user installs |

Option A pinned is still a fetch-and-execute install; an unpinned `@latest`
also lets a registry-side change run unreviewed. B keeps the one thing the rule
cares about, a human-approved install, in Claude Code's plugin install step.
C puts build output under version control and touches the publish and release
workflows (human-merge territory); the issue already defers a bundle to the
display-mod phase. D is the cheapest fallback but gives no one-command install.

## Decision (proposed)

Use B: a plugin directory whose `package.json` depends on an exact
`zombie-mermaid` version, committed with an `npm-shrinkwrap.json`, and a
`.mcp.json` that runs the installed `dist/cli.js` with `node`. Keep D as the
documented fallback for installs where B's dependency install is skipped. Reject
A for the plugin (it stays in the README for manual setup, where the user types
the command), and defer C.

Unverified, and to settle in the implementing PR before shipping:

- Whether the optional `@resvg/resvg-js` platform packages install under a
  frozen, scripts-off install (affects `--png` only; SVG and ASCII do not need
  it). The docs say dependencies that build native modules in install scripts
  "download but don't compile"; a prebuilt platform package is not covered
  either way.
- Whether Claude Code shows an approval prompt for plugin-declared MCP servers.
  The MCP page describes approval only for project `.mcp.json`; the loading page
  says a project-scope plugin's servers go through that same approval.
- That a plugin directory under `plugins/` stays out of the pnpm workspace
  (`pnpm-workspace.yaml` globs) and out of changesets' package set.
- The default MCP startup timeout (`MCP_TIMEOUT` is documented, the default is
  not on the page read).

## Minimal skeleton (proposal, not shipped)

```
.claude-plugin/marketplace.json             # one entry, source "./plugins/claude", no version
plugins/claude/.claude-plugin/plugin.json   # name "zombie-mermaid", no version
plugins/claude/package.json                 # private, depends on zombie-mermaid "5.12.0" (exact)
plugins/claude/npm-shrinkwrap.json          # generated with `npm install --package-lock-only`
plugins/claude/.mcp.json
plugins/claude/skills/zombie-mermaid/SKILL.md
```

```json
{
  "mcpServers": {
    "zombie-mermaid": {
      "command": "node",
      "args": [
        "${CLAUDE_PLUGIN_ROOT}/node_modules/zombie-mermaid/dist/cli.js",
        "mcp"
      ]
    }
  }
}
```

The skill's `npx -y zombie-mermaid render` lines become
`node "${CLAUDE_PLUGIN_ROOT}/node_modules/zombie-mermaid/dist/cli.js" render`
in the plugin copy (substituted inline per the manifest reference). One skill
source: the plugin copy is generated from, or symlinked to, `skills/zombie-mermaid`,
and symlinks only resolve inside the marketplace.

## Self-review (per the checklist, #977)

- **Degenerate inputs.** Plugin installed with the dependency install skipped:
  `node_modules` is absent, so the server fails to start while the plugin still
  loads (the docs say `/plugin` shows a note). The fix is D's command, not a
  silent npx fallback, which would reintroduce option A.
- **Boundaries.** The pin is exact (`5.12.0`), so a release that does not touch
  the plugin leaves it on the old engine until the pin moves; that lag is the
  cost of a reviewed install. A pin bump changes a tracked file, so with no
  `version` field it counts as an update (commit-SHA versioning).
- **Terminology.** "Pin" means the exact version in the plugin's `package.json`
  and shrinkwrap, not the `version` field of `plugin.json` (which stays unset).
- **Sub-issue scope.** This doc does not decide how the pin bump is automated or
  whether it touches release workflows; #2206 lists release handling as its own
  open item, and a workflow edit needs a human merge.
- **Cited precedent.** The docs pages above were fetched on 2026-10-30 and the
  quoted behaviors checked against them; the issue's claim that plugins are
  copied to a cache and cannot read sibling packages matches the loading page.

Refs [#2206](https://github.com/dfadler/zombie-mermaid/issues/2206).
