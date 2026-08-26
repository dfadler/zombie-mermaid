---
'zombie-mermaid': minor
---

Add a `zombie-mermaid` CLI for rendering Mermaid diagrams from the command line.

- `zombie-mermaid render <file> --ascii` — render to ASCII/Unicode art in the terminal
- `zombie-mermaid render <file> --svg -o <out.svg>` — render to an SVG file
- `zombie-mermaid render <file> --ascii --svg -o <out.svg> --theme <name>` — both at once, with a built-in theme
- `cat file.mmd | zombie-mermaid render --ascii` — read from stdin
- `zombie-mermaid themes` — list available built-in themes
- `zombie-mermaid --help` / `--version`

Supports all 6 diagram types (flowchart, sequence, state, class, ER, XY chart), reading from a file argument or stdin, and writing SVG output to disk. The CLI is exposed via a `bin` entry (`zombie-mermaid`) and built as a standalone ESM script with a `#!/usr/bin/env node` shebang.

Ports [lukilabs/beautiful-mermaid#51](https://github.com/lukilabs/beautiful-mermaid/pull/51) by [@vinceyyy](https://github.com/vinceyyy), adapted to this fork's current public API (`renderMermaidSVG`, `renderMermaidASCII`), pnpm/tsup build setup, and Vitest test suite. Closes #74.
