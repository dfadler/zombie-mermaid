---
'zombie-mermaid': patch
---

Fix flowchart node labels being dropped when the `:::className` class shorthand appears before the shape brackets (e.g. `A:::external[External User]`). The node-shape regexes require the id to sit immediately before its bracket delimiters (`^([\w-]+)\[...\]`), so a `:::className` token in between caused every shape pattern to miss, falling back to a bare-id match that discarded the bracketed label entirely. The class shorthand is now stripped out before shape matching runs, regardless of whether it appears before or after the brackets.
