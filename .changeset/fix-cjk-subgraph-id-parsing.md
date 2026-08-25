---
'zombie-mermaid': patch
---

Fix flowchart subgraph parsing for non-ASCII (e.g. CJK) subgraph ids and quoted bracket titles. `subgraph <id> [<Title>]` matched the id with an ASCII-only `[\w-]+` pattern, so a non-ASCII id like `柜体` failed to match and the whole line fell through to `subgraph <Title>` slugification instead — and a CJK-only `subgraph <Title>` (no bracket form) slugified to an *empty* id, since the id derivation stripped all non-`\w` characters. Both now preserve Unicode letters/numbers in the id, and `subgraph id ["Quoted Title"]` / `subgraph "Quoted Title"` correctly strip the surrounding quotes from the label.
