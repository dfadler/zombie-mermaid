---
'zombie-mermaid': patch
---

The `zombie-mermaid` tarball ships no `*.map` files, like the `@zombie-mermaid/*` packages. The new `zombie-mermaid/ascii-layout` entry is the first umbrella entry with code of its own to map (`index`, `ascii` and `mcp` are re-exports), so its maps and its lazy chunks' maps had started landing in `dist/`; the package's `files` now excludes them. Runtime JS, types and output are unchanged. Refs [#2195](https://github.com/dfadler/zombie-mermaid/issues/2195), [#2182](https://github.com/dfadler/zombie-mermaid/issues/2182).
