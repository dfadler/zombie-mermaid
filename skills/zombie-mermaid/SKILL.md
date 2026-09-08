---
name: zombie-mermaid
description: |
  Render Mermaid diagram source to an SVG, a PNG, a self-contained pan/zoom
  HTML viewer, or ASCII/Unicode box-drawing art, using the published
  `zombie-mermaid` npm CLI (`npx -y zombie-mermaid render ...`) or its MCP
  server. Use this whenever a Mermaid flowchart, sequence, class, state, ER
  diagram, or XY chart needs to become an actual image or terminal drawing —
  "render this diagram", "turn this Mermaid into an SVG/PNG", "show me this
  flowchart as ASCII", "apply a theme to this diagram", "does this diagram
  look right" — and also to check a `sequenceDiagram` for unbalanced
  `activate`/`deactivate` pairs. This is a thin wrapper: it shells out to the
  published package and bundles no renderer of its own.
license: MIT
metadata:
  homepage: https://github.com/dfadler/zombie-mermaid
  package: zombie-mermaid
---

# zombie-mermaid

Renders Mermaid diagrams without a browser, a headless Chrome, or a DOM. Fast
enough to run per-diagram in a loop.

**This skill is a wrapper, not an implementation.** Every command below runs
the published [`zombie-mermaid`](https://www.npmjs.com/package/zombie-mermaid)
npm package. Nothing is vendored here, so there is no second copy of the
renderer to drift out of sync — bugs and feature requests go to
<https://github.com/dfadler/zombie-mermaid/issues>, not to this skill.

## Prerequisites

Node.js 22 or newer. No install step: `npx -y zombie-mermaid` fetches the
package on first use. For repeated use in one project, add it as a dependency
instead (`npm i -D zombie-mermaid`) and drop the `npx -y` prefix.

## Rendering from the CLI

Write the Mermaid source to a `.mmd` file, then run one of:

```bash
# ASCII/Unicode art, straight to the terminal
npx -y zombie-mermaid render diagram.mmd --ascii

# SVG next to the input (diagram.svg); -o names it, -o - writes to stdout
npx -y zombie-mermaid render diagram.mmd --svg
npx -y zombie-mermaid render diagram.mmd --svg -o out.svg --theme nord

# PNG, for issue trackers / Slack / docs tools that reject SVG
npx -y zombie-mermaid render diagram.mmd --png

# One self-contained HTML file with pan/zoom, opens over file://
npx -y zombie-mermaid render diagram.mmd --html

# Read from stdin instead of a file (stdin input must give -o for file output)
cat diagram.mmd | npx -y zombie-mermaid render --ascii
```

An existing output file is **never** overwritten without `-f`/`--force`.

### Worked example

```bash
cat > diagram.mmd <<'EOF'
graph LR
  A[Client] --> B[API]
  B --> C[(Postgres)]
EOF
npx -y zombie-mermaid render diagram.mmd --ascii
```

```
┌────────┐     ┌─────┐     ╭──────────╮
│        │     │     │     │          │
│ Client ├────►│ API ├────►│ Postgres │
│        │     │     │     │          │
│        │     │     │     │          │
└────────┘     └─────┘     ╰──────────╯
```

### Flags worth knowing

| Flag                         | Effect                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--theme <name>`             | Apply a built-in theme. `npx -y zombie-mermaid themes` lists them (`nord`, `dracula`, `catppuccin-mocha`, `github-dark`, …).                                       |
| `--direction TD\|BT\|LR\|RL` | Override the diagram's layout direction without editing the source.                                                                                                |
| `--resolve-colors`           | Bake CSS `var()`/`color-mix()` into concrete sRGB in the SVG, for rasterizers that don't evaluate CSS (resvg, librsvg, Inkscape). `--png` does this automatically. |
| `-w, --max-width <n\|auto>`  | Fit ASCII output within N columns (`auto` = the terminal's width).                                                                                                 |
| `-x` / `-y` / `-p`           | ASCII node spacing: horizontal, vertical, and padding inside boxes.                                                                                                |

`npx -y zombie-mermaid --help` is the authoritative, current list — prefer it
over this table if the two disagree.

`--png` needs the optional `@resvg/resvg-js` native dependency. A normal
install pulls it; if it's missing (unsupported platform, or `--no-optional`),
`--png` fails with an explicit message. Fall back to `--svg`.

## Rendering over MCP

For an agent that would rather call a tool than shell out, the same renderer
ships as an MCP server on stdio:

```json
{
  "mcpServers": {
    "zombie-mermaid": {
      "command": "npx",
      "args": ["-y", "zombie-mermaid", "mcp"]
    }
  }
}
```

Three tools, all taking a `diagram` string:

- `render_mermaid_svg` — plus `theme`, `transparent`, `font`.
- `render_mermaid_ascii` — plus `useAscii` (plain `+-|>` instead of Unicode
  box-drawing), `paddingX`, `paddingY`, `boxBorderPadding`. Never emits ANSI
  color, so the result pastes cleanly into a chat context.
- `check_mermaid_sequence_activations` — returns `{ ok, issues }` for a
  `sequenceDiagram`, flagging every `activate X` (or `+` arrow shorthand) with
  no matching `deactivate X`. Mechanical and deterministic, no LLM judgment.
  Errors on any other diagram type.

Invalid Mermaid syntax comes back as a normal tool error (`isError: true`)
rather than dropping the connection.

The MCP server is still labeled **experimental** upstream — its tool surface
may change. The CLI above is the stable interface.

## Choosing an output

- **ASCII** — showing a diagram inside a terminal, a code comment, a commit
  message, or a chat reply. No files, no image hosting.
- **SVG** — a repo asset or a web page. Stays a live function of its CSS
  variables, so it follows a host page's light/dark theme.
- **PNG** — anywhere SVG is rejected: GitHub issue bodies, Slack, email.
- **HTML** — a large diagram someone needs to pan and zoom around, shared as a
  single file attachment.

## Supported diagram types

Flowchart, sequence, class, state, and ER diagrams render to every output.
XY charts render to SVG/PNG/HTML only, not ASCII.

## What this skill deliberately does not do

No theme gallery, no batch-render driver, no vendored copy of the rendering
pipeline. Those belong in the package, where they get tests and releases —
duplicating them here would create a second surface to maintain and a second
place for bugs to land. If something is missing from the CLI or the MCP
tools, file it upstream rather than working around it in this file.
