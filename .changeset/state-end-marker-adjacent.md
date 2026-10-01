---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

In state diagrams without composite states, the end marker (`[*]` as a transition target) now sits right after the state that transitions into it instead of at the very bottom of the page, so `Closed --> [*]` is a short edge rather than a long line down the page edge.
