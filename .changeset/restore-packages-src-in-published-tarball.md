---
'zombie-mermaid': patch
---

Restore the readable TypeScript source that the published npm tarball
stopped shipping once #769's monorepo conversion moved the class/ER/
sequence/xychart parsers, the ASCII renderer, and the MCP server out of
root `src/` and into `packages/*/src/` — `package.json`'s `files` field
still only listed root `src/`, so those directories silently dropped out of
`npm pack` even though the compiled `dist/` bundle (which still inlines all
five packages) stayed complete and correct.

`files` now also lists `packages/{core,mermaid-parser,svg-renderer,
ascii-renderer,mcp}/src/`. This is a stopgap: see RELEASING.md's `files`
stopgap note for why, and remove it as part of a major release once the
five packages are externalized and published on their own (RELEASING.md's
"Future: multi-package publish" section) — at that point their source no
longer needs to be duplicated inside the `zombie-mermaid` tarball.
