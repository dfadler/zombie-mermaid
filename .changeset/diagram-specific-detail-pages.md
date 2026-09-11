---
---

No release: adds a specific-diagram detail page per real sample (e.g.
`diagrams/flowchart/ci-cd-pipeline.html`) -- the "Source → render" split
panel from `diagrams/<type>.html`, plus a working SVG/ASCII output toggle
and a "More `<type>` examples" cross-link grid. Implements the direction
from https://claude.ai/code/artifact/5f6f7f34-15a9-45c1-8ede-ecde2d214367
and issue #989 (part 1 of that issue's 3-PR split: the new page type only
-- nothing links to these pages yet). Nothing here touches the published
`zombie-mermaid` package.
