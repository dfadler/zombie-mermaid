---
'zombie-mermaid': major
---

**Breaking:** the inert `data-click-callback` attribute is no longer emitted on flowchart/state node groups or class-diagram class boxes. A `click A call fn()` statement still parses, and the library still executes nothing a diagram supplies — but the callback expression now surfaces only as data, through `parseMermaid(source).interactions` (a `Map<string, NodeInteraction>` keyed by node id; the `NodeInteraction` type is now exported from the package root). A host that was reading the attribute off the DOM should read the map instead and bind its own behaviour to the node's existing `data-id` attribute — see the flowchart Interactions section of `docs/diagrams.md` for an example. Links (`<a href>`), tooltips (`<title>`), and `interactivity` gating are unchanged. Refs [#216](https://github.com/dfadler/zombie-mermaid/issues/216).
