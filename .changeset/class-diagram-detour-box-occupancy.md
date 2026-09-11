---
'zombie-mermaid': patch
---

Fix ASCII class-diagram relationship lines overlapping unrelated class
boxes. The "same level" routing branch (used when a relationship cycle,
e.g. `A --> B --> C --> A`, forces every class in the cycle onto one row)
computed its detour row only from the relationship's own two endpoints, so
a taller class sitting between them in that row could have the detour's
horizontal line drawn straight through its attribute/method rows instead
of beneath its box. `class-diagram.ts` now searches for such a same-row
obstruction and routes the detour below it, generalizing the occupancy
guard `er-diagram.ts` already has (`setCGuarded`/`boxCells`, from #350) to
class diagrams. Part of #953.
