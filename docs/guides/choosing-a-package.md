# Which package do I install?

Short answer: **`zombie-mermaid`**. Reach for a scoped package only for the
narrow cases below.

| I want to…                                             | Install                                        |
| ------------------------------------------------------ | ---------------------------------------------- |
| render SVG and/or ASCII from code, or use the CLI      | `zombie-mermaid`                               |
| render only terminal text, with no SVG code or `elkjs` | `@zombie-mermaid/ascii-renderer`               |
| render only SVG, without the umbrella's ASCII half     | `@zombie-mermaid/svg-renderer` (+ `elkjs`)     |
| let an AI agent render diagrams over MCP               | `zombie-mermaid` (run `zombie-mermaid mcp`)    |
| embed the MCP server in my own process                 | `zombie-mermaid` (import `zombie-mermaid/mcp`) |

## The packages

- **`zombie-mermaid`** — the umbrella. Re-exports both renderers, ships the
  `zombie-mermaid` CLI and the MCP server (`zombie-mermaid mcp`, or
  `import ... from 'zombie-mermaid/mcp'`). Has a `zombie-mermaid/ascii` entry
  that skips loading the SVG renderer.
- **`@zombie-mermaid/ascii-renderer`** — ASCII/Unicode output only. No
  third-party dependencies, no `elkjs`. See its [README](../../packages/ascii-renderer/README.md).
- **`@zombie-mermaid/svg-renderer`** — SVG layout and emitters. `elkjs` is an
  optional peer. See its [README](../../packages/svg-renderer/README.md).
- **`@zombie-mermaid/core`**, **`@zombie-mermaid/mermaid-parser`**,
  **`@zombie-mermaid/mcp`** — shared types/theming, the diagram parsers, and the
  MCP server implementation. Internal-only: published so the renderers can depend
  on them, with no standalone support commitment. Don't install them directly.

## Do I need `elkjs`?

Only for SVG of flowchart, state, class, ER and architecture diagrams, and only
in a browser or bundler (Node and Bun auto-load it). ASCII output never needs it.
Register it once with `registerElk()`; see
[the migration guide](elkjs-optional-peer.md) for the full table and steps.

## How big is it?

Gzipped sizes for each renderer, with and without `elkjs`, are explained under
[Bundle Size](../../README.md#bundle-size). In short: ASCII-only is the smallest,
SVG without `elkjs` is next, and registering `elkjs` is what adds the large chunk.
With a bundler, importing just `renderMermaidASCII` from `zombie-mermaid` already
drops the SVG renderer.

## Related

- [API Reference](../api-reference.md) — function signatures and options
- [README: Installation](../../README.md#installation)
