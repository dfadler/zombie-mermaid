---
'zombie-mermaid': patch
---

Fix two ER diagram parser gaps (issue #59, items 2 and 3):

- Entity aliases (`p[Person] { ... }` and `a["Customer Account"] { ... }`) are now parsed and rendered using the alias as the display label, while relationships and internal lookups still key off the raw entity id. Single-line entity blocks (header, attributes, and closing brace all on one line) are also now supported.
- The `direction` directive (`direction TB` / `direction LR` / `direction BT` / `direction RL`) is now parsed and threaded through to the ELK layout, changing the axis entities are laid out on. Diagrams with no `direction` statement keep the previous default (left-to-right).
