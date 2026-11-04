---
'@zombie-mermaid/svg-renderer': patch
---

Output change: sequence-diagram `loop`/`alt`/`critical` frames sit 11px outside the lifelines (was 15px), are drawn dotted, and the type tab has its bottom-right corner cut, matching mermaid 12.3.0. Divider lines use a 3/3 dash. Nested `rect` highlights shrink by the same 4px.
