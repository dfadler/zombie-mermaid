# Upgrading from 5.x to 6.x

Task-oriented checklist for moving from `zombie-mermaid` 5.x to 6.x. Every
release's full notes are in the [CHANGELOG](../../CHANGELOG.md).

## Do I need to change anything?

| You…                                        | Change needed                                              |
| ------------------------------------------- | ---------------------------------------------------------- |
| pass `-w` / `--max-width` to the CLI        | [Handle the non-zero exit](#--max-width-is-now-an-error)   |
| call `renderMermaidASCII` with `maxWidth`   | none: the option is new (5.x ignored unknown options)      |
| write ER attributes with several keys       | [Use commas](#er-attribute-keys-are-parsed-like-mermaidjs) |
| use only the library or MCP without a width | none                                                       |

## `--max-width` is now an error

In 5.x, `zombie-mermaid render --ascii --max-width <n>` (and `-w auto`) retried
with compact spacing and, if the diagram was still too wide, printed a warning
on stderr, wrote the full diagram to stdout and exited 0.

In 6.x the same condition is an error: nothing is written to stdout or to the
`-o` file, stderr gets `Error: ASCII output is <w> columns wide, exceeding
--max-width of <n>. ...`, and the exit code is 1. The compact-spacing retry is
unchanged, and a diagram that fits still exits 0. The "applied compact spacing"
note on stderr is gone.

Before (5.x), a script that relied on the warning:

```bash
zombie-mermaid render --ascii -w 80 diagram.mmd   # exit 0 even when 120 columns wide
```

After (6.x), choose one:

```bash
# Fail the build when the diagram is too wide (the new behavior)
zombie-mermaid render --ascii -w 80 diagram.mmd || echo "too wide"

# Keep the old "print it anyway" behavior: drop -w, or raise the limit
zombie-mermaid render --ascii diagram.mmd
```

`-w auto` falls back to 80 columns when stdout is not a terminal (pipes, CI),
so it can now fail there for diagrams wider than 80 columns.

## New: `maxWidth` in the library and MCP

`renderMermaidASCII(source, { maxWidth })` and the MCP `render_mermaid_ascii`
tool's `maxWidth` argument apply the same limit. There is no default, and
`profile: 'markdown'` does not set one. Over the limit, the library throws
`AsciiWidthError` (`code: 'WIDTH_EXCEEDED'`) and the MCP tool returns an
`isError` result. See [Width limit](../api-reference.md#width-limit-optionsmaxwidth).

## ER attribute keys are parsed like mermaid.js

In 5.x an ER attribute's key text was split on whitespace only, so `PK, FK`
kept just `FK`, `PK,FK` kept nothing, and unknown words were ignored. In 6.x it
is a comma-separated list of `PK` / `FK` / `UK` (space after the comma
optional), kept in order, as in mermaid.js 12.1.0 and 12.2.0.

| Source               | 5.x                    | 6.x              |
| -------------------- | ---------------------- | ---------------- |
| `PK, FK`, `PK,FK`    | `FK` / no key          | `PK,FK`          |
| `PK FK` (space only) | `PK,FK`                | line-level error |
| `PK,`, `PK,,FK`      | key dropped or partial | line-level error |
| `PKX`                | ignored                | line-level error |

Fix: write multiple keys with commas (`PK, FK`). Mermaid.js rejects the
space-only form too, so a diagram that only passed here fails there.
