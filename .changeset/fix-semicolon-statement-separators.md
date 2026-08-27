---
'zombie-mermaid': patch
---

Support semicolons as statement separators in every diagram type.

`detectDiagramType` isolated the header by splitting on newline _or_ semicolon, so `sequenceDiagram;A->>B: Hi` routed correctly to the sequence pipeline — but each parser then split the body on newlines only. Everything after the header was discarded and the diagram rendered empty. The same gap affected `classDiagram`, `erDiagram`, and `xychart-beta`.

Flowcharts were broken differently: `flowchart TD;A-->B` did not render empty, it threw `Invalid mermaid header`, even though `graph TD; A-->B;` is long-standing Mermaid syntax.

Statement splitting now lives in one shared `splitStatements` helper used by the detector and all five parser entry points, so routing and parsing cannot disagree about where a statement ends. A semicolon inside a quoted label (`A["a; b"]`) or terminating a character reference (`A[&amp;]`, `A[&#x1F600;]`) is correctly treated as text rather than a separator, and comments are stripped before splitting so a `;` in a comment cannot resurrect the rest of the line as code.
