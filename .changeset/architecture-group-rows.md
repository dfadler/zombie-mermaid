---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Architecture diagrams: a group whose member links to a node outside it on the same grid row is now shifted so the two sit level, instead of the group's stack riding centred on that node (`db` in the Nested Groups And Junction sample sat 54px above its row) (#2473). Service labels now stay inside their group, and an edge written with `T`/`B` ports into a group (`fan:B --> T:replica`) puts the grouped service under the other end instead of beside its group's other members (#2473).
