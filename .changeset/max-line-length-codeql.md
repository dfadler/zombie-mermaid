---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Add a `maxLineLength` render limit (default 10,000 characters per source line). A single very long line could make the parsers' per-line regexes run quadratically; it now fails fast with `LimitExceededError`. Also escapes backslash in the class-diagram arrow regex builder.
