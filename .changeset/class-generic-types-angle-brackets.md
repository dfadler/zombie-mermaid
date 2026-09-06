---
'zombie-mermaid': patch
---

Class diagrams: mermaid's `~T~` generic syntax in class members is now rendered as `<T>` the way mermaid itself does — `List~Observer~ observers` shows as `List<Observer>` in both the SVG and ASCII output (nested `List~List~T~~` → `List<List<T>>`, multi-argument `Map~K,V~` → `Map<K,V>`), instead of leaking the raw tildes into the diagram. Flagged by the weekly form-judge audit (#418).
