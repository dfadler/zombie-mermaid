---
'zombie-mermaid': minor
---

`AsciiRenderOptions.paddingX`/`.paddingY`/`.boxBorderPadding` (and the `-x`/`-y`/`-p` CLI flags) now affect sequence, class, and ER ASCII diagrams too, not just flowchart/state diagrams. `paddingX`/`paddingY` widen or tighten each renderer's own layout gaps relative to their existing defaults, so a render with no explicit padding option still looks exactly as it did before; `boxBorderPadding` widens the interior padding of actor/note/class/entity boxes directly.
