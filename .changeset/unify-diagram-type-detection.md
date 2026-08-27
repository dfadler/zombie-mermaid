---
'zombie-mermaid': patch
---

Fix `renderMermaidASCII` misclassifying a single-line diagram whose header is followed by a semicolon (e.g. `sequenceDiagram;A->>B: Hi`) as a flowchart. Diagram-type detection now isolates the header the same way in both the SVG and ASCII renderers (splitting on newline or semicolon), instead of each renderer implementing its own slightly different detector.
