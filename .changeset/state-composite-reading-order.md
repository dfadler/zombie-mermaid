---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

SVG state diagrams: composite states now follow the same top-to-bottom reading order as flat state diagrams, so a composite no longer pushes the states after it upside down. Closes #1287.
