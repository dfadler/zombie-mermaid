---
---

No release: reconciles the Editor's independent theme dropdown with the
shared theme selector (#684-#687). `editor.ts` now imports `THEME_LABELS`
from the shared `demo/theme-labels.ts` instead of maintaining its own copy
(and the build-time drift guard that copy needed), and the Editor's
preview-pane theme now persists through the same shared `mermaid-theme`
key via a new `demo/editor-theme-state-bridge.ts` bridge, replacing its
own separate `bm-editor-theme` key (with a one-time migration). See
`docs/decisions/theme-selector-shared-state.md`'s "#688" amendment for the
reconciliation decision. Addresses #688. Nothing here touches the
published `zombie-mermaid` package — this is demo-site UI only.
