---
'@zombie-mermaid/mermaid-parser': patch
---

ER relationship labels follow Mermaid 12.3.0's lexer: an unquoted label that has a word starting with `one`, `many`, `to` (or `only one`, `zero or more` and the other word-form cardinalities), a number, or a character such as `,` `(` `<` now throws a parse error, as Mermaid does. Quote the label (`: "one-to-one"`) to keep it. `opt-to-many`, `a-to-b` and `has owns` still parse.
