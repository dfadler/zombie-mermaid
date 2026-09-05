---
'zombie-mermaid': minor
---

CLI `render` output ergonomics: `-o -` writes the SVG to stdout; a `.svg`/`.txt` extension on `-o` selects the format without a flag (`render diagram.mmd -o out.svg`), and an extension that contradicts an explicit flag is an error; `--svg` without `-o` writes `<input stem>.svg` beside the input; `--ascii -o out.txt` writes the ASCII rendering to a file (without ANSI codes). The `render` command now refuses to overwrite an existing output file unless `--force`/`-f` is given — the one behaviour change for existing invocations, which previously clobbered silently. Refs #456.
