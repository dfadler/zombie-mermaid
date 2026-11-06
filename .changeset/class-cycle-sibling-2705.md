---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII class diagrams no longer lose a relationship when a class that shares a parent with a sibling has an up edge running past it (a cycle `B --> C --> D --> B` with `B --> X` beside `B --> C`): the up edge's lane now runs between the siblings instead of through them.
