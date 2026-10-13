---
'@zombie-mermaid/ascii-renderer': minor
'zombie-mermaid': minor
---

Add `profile: 'markdown'` to the ASCII renderer (CLI `--profile markdown`): ASCII-only charset, no color, no hyperlinks, no coordinate overlay, for output that pastes cleanly into issues, commits and fenced blocks. Explicit options still win; default output is unchanged. Closes [#1866](https://github.com/dfadler/zombie-mermaid/issues/1866).
