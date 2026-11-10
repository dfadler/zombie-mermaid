---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Sequence diagrams match mermaid 12.3.0 more closely: an `actor` stick figure's lifeline starts 74px under its head and ends 6px above the footer head (SVG), and a destroying self-message (`destroy B` then `B->>B`) draws its arrow into the footer box in ASCII.
