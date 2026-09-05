---
'zombie-mermaid': minor
---

Sequence diagrams: Mermaid's `create participant X` / `create actor X as Label` and `destroy X` lifecycle directives are now recognized (previously the whole line was dropped, which also lost the alias and the actor kind). A created participant's box is drawn centred on the row of the message that creates it, with the arrow stopping at the box edge and the lifeline starting there; a destroyed participant's lifeline ends at the destroying message with a cross and gets no footer box, in both SVG and ASCII output. Mermaid's binding rules are enforced with Mermaid's own error text (the next message must have the created participant as its recipient, or the destroyed one as sender or recipient; re-creating an existing id is an error).
