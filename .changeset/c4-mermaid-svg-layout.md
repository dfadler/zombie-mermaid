---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
---

C4 SVG output now follows Mermaid's own C4 renderer instead of a layered graph layout. Shapes are placed in rows in declaration order (four to a row, boundaries two to a row), sized as Mermaid sizes them (216px wide, wider when the text is), and drawn the way Mermaid draws them: rounded boxes, a pill with a round head for a person, cylinders and pipes, dashed boundary frames with a centred title and type, a straight first relationship with curved ones after it, and plain-text labels. As in Mermaid, `Rel_U/D/L/R` and `RenderOptions.direction` do not move anything in the SVG. ASCII output is unchanged.
