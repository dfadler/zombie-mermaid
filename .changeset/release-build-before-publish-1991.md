---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/mcp': patch
---

Republish with `dist/` included. 5.1.0 and 5.2.0 of every package shipped without build output because the release job (split from the test job in #1596) never ran the build before `changeset publish`; imports of `zombie-mermaid` and the `@zombie-mermaid/*` packages failed to resolve. The release job now builds first and fails before publishing if any tarball lacks its entry files. Closes [#1991](https://github.com/dfadler/zombie-mermaid/issues/1991).
