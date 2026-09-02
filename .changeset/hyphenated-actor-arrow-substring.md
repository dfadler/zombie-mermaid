---
'zombie-mermaid': patch
---

Sequence diagrams: an undeclared/inline actor name containing a `-x`, `-)`, `--x`, or `--)` substring (e.g. `foo-x-bar`) no longer gets mis-split at that embedded substring instead of the real arrow later in the line — `foo-x-bar->>baz: hi` now correctly parses as `from: "foo-x-bar"`, `to: "baz"` instead of `from: "foo"`, `to: "bar->>baz"`.
