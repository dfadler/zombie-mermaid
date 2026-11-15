---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change, SVG: a front matter `title:` on a class or ER diagram now grows the viewBox by 52px (was 54), and on a sequence diagram by 40px (was 36), as mermaid@12.3.0 does. ASCII output is unchanged.
