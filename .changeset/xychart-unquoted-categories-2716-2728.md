---
'@zombie-mermaid/mermaid-parser': patch
---

Output change: xychart unquoted category labels follow Mermaid 12.3.0. Words are joined (`New Users` renders `NewUsers`; quote the label to keep the space), and a label with a character Mermaid cannot lex (`/users`, `:`, `;`, an accent) or an empty item is now a parse error. Quoted labels are unchanged.
