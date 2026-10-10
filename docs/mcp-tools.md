# MCP tool reference

The six tools exposed by `zombie-mermaid mcp` (and `createMcpServer()` from `zombie-mermaid/mcp` / `@zombie-mermaid/mcp`). For setup and client config see the [README's MCP Server section](../README.md#mcp-server); for the trust model see [SECURITY.md](../SECURITY.md). Tool errors (bad Mermaid syntax, wrong diagram type, unwritable path) come back as a normal result with `isError: true`, not a protocol failure.

| Tool                                                                        | Read-only                          | Returns                                                    |
| --------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| [`render_mermaid_svg`](#render_mermaid_svg)                                 | no (writes only with `outputPath`) | SVG text, or `{ saved, size }`                             |
| [`render_mermaid_ascii`](#render_mermaid_ascii)                             | yes                                | plain text                                                 |
| [`check_mermaid_sequence_activations`](#check_mermaid_sequence_activations) | yes                                | JSON `{ ok, issues }`                                      |
| [`fix_mermaid_sequence_activations`](#fix_mermaid_sequence_activations)     | yes                                | JSON `{ ok, fixedDiagram, fixesApplied, remainingIssues }` |
| [`list_themes`](#list_themes)                                               | yes                                | JSON `{ themes }`                                          |
| [`list_diagram_types`](#list_diagram_types)                                 | yes                                | JSON `{ diagramTypes }`                                    |

## `render_mermaid_svg`

Render Mermaid source to a self-contained SVG string. Flowcharts, state, sequence, class, ER and XY charts are listed in the tool description; call [`list_diagram_types`](#list_diagram_types) for everything the library detects.

| Argument      | Type             | Notes                                                                      |
| ------------- | ---------------- | -------------------------------------------------------------------------- |
| `diagram`     | string, required | Mermaid source, non-empty.                                                 |
| `theme`       | string           | A name from [`list_themes`](#list_themes). Unknown names are rejected.     |
| `bg`          | string           | Background color, hex `#rgb` or `#rrggbb` only. Applied on top of `theme`. |
| `fg`          | string           | Foreground/text color, same hex format. Applied on top of `theme`.         |
| `transparent` | boolean          | Transparent background instead of the theme's. Default `false`.            |
| `font`        | string           | Font family for diagram text. Default `Inter`.                             |
| `outputPath`  | string           | Write the SVG to disk instead of returning it. See below.                  |

`bg`/`fg` override only the one color they name, so a `theme` plus `bg: "#000"` keeps the theme's foreground. With neither `theme` nor overrides the defaults are `#FFFFFF` / `#27272A`. Anything other than `#rgb`/`#rrggbb` (named colors, `rgb()`, alpha forms) fails validation.

### `outputPath` rules

With `outputPath` the tool writes the file and returns `{"saved": "<absolute path>", "size": <bytes>}` instead of the SVG text. All checks run before any byte is written:

- Must end in `.svg` (case-insensitive).
- Resolved against the server's working directory (where your MCP client launched it); must stay inside it. `..` traversal and symlinked directories that point outside are refused.
- The parent directory must already exist; nothing is created.
- A symlink at the final path is refused. An existing target must be a regular file (not a directory, FIFO or device).
- An existing `.svg` at the path is **overwritten**, which is why the tool is annotated `destructiveHint: true`.
- OS-level write failures report only the errno code (for example `EACCES`), never the absolute path.

## `render_mermaid_ascii`

Render to plain ASCII or Unicode box-drawing text, suited to a terminal or chat context. Flowchart, state, sequence, class and ER diagrams. Output never contains ANSI color codes.

| Argument           | Type             | Notes                                                       |
| ------------------ | ---------------- | ----------------------------------------------------------- |
| `diagram`          | string, required | Mermaid source, non-empty.                                  |
| `useAscii`         | boolean          | `true` = plain `+ - \| >`; default Unicode box-drawing.     |
| `paddingX`         | integer >= 0     | Horizontal node spacing, default 5. Flowchart/state only.   |
| `paddingY`         | integer >= 0     | Vertical node spacing, default 5. Flowchart/state only.     |
| `boxBorderPadding` | integer >= 0     | Padding inside node boxes, default 1. Flowchart/state only. |

## `check_mermaid_sequence_activations`

Deterministic check (no LLM involved) that every `activate X`, or `+` arrow shorthand, is closed by a matching `deactivate X` / `-`. Input: `diagram` (must start with `sequenceDiagram`; other diagram types return an error). Returns:

```json
{
  "ok": false,
  "issues": [
    { "code": "DANGLING_ACTIVATION", "actorId": "B", "message": "..." }
  ]
}
```

`code` is `DANGLING_ACTIVATION` (activated, never deactivated) or `UNMATCHED_DEACTIVATION` (deactivate with nothing open). `ok` is `true` with an empty `issues` array when balanced.

## `fix_mermaid_sequence_activations`

Same input and checks as above, plus a corrected diagram where that is mechanically safe. A dangling activation gets a `deactivate X` appended. An unmatched deactivation is **not** auto-fixed (there is no safe edit without source positions); it is reported in `remainingIssues`. Returns:

```json
{
  "ok": true,
  "fixedDiagram": "sequenceDiagram\n...",
  "fixesApplied": ["..."],
  "remainingIssues": []
}
```

`fixedDiagram` is the unchanged input when nothing was fixed.

## `list_themes`

No arguments. Returns `{"themes": [...]}`, the built-in names accepted by `render_mermaid_svg`'s `theme`. See [theming.md](theming.md) for what each looks like.

## `list_diagram_types`

No arguments. Returns `{"diagramTypes": [...]}`, the diagram types the library detects (flowchart covers state diagrams). Detection and rendering are separate: `render_mermaid_ascii` supports a narrower set than `render_mermaid_svg`.
