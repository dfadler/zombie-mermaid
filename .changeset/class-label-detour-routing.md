---
'zombie-mermaid': patch
---

ASCII class diagrams: a relationship whose line detours around an intermediate box now places its label on the line's actual routed path — the midpoint of the detour's vertical trunk, flush against the box it routes around — instead of the straight-line midpoint between its source and target boxes. On the "Class: MVC Architecture" sample, `Controller --> View : refreshes` detours around `Model` to reach `View`, but its label previously anchored on the straight Controller/View midpoint, which sat one row above `Controller --> Model : updates`'s own (correctly placed) label — making both read as though they terminated at `Model`. `refreshes` now renders clearly beside its own detour line, past `Model`'s border (#487).
