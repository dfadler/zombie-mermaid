---
'zombie-mermaid': minor
---

Class diagrams now support `click` href/tooltip interactions, matching flowchart/state diagrams (closes [#292](https://github.com/dfadler/zombie-mermaid/issues/292)):

```
classDiagram
  class Animal
  click Animal "https://example.com" "Tooltip" _blank
  click Duck call myHandler()
```

An `href` wraps the class box in a real SVG `<a>` link, a tooltip becomes a `<title>`, and a `call`/`callback` binding is recorded as `data-click-callback` but never invoked — the same tier 1–2 rules from `docs/decisions/no-script-interactivity.md`, and the same `interactivity` gating (`'none'` strips links/tooltips). The parsing grammar and href-safety checks are now shared between the flowchart/state parser and the class-diagram parser via `src/click-directive.ts`, rather than duplicated.

ER diagrams do not gain this feature: Mermaid's own `erDiagram` syntax has no `click` directive to parse (it's an open, unmerged upstream feature request — see `docs/diagrams.md`'s ER Diagrams section), so a `click` line inside an `erDiagram` continues to be silently ignored rather than guessed at.
