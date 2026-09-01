---
'zombie-mermaid': patch
---

ASCII rendering: fixed a bug where the ▶/◀ arrowhead glyphs (and any other Geometric Shapes block character without emoji presentation) were misclassified as double-width. This caused boxes and centered text to be laid out one column too wide whenever a diagram's own text contained one of these characters, since the shared wide-character detection used by box/label sizing (`isWideChar` in `src/text-metrics.ts`) treated them as fullwidth even though every real terminal renders them as a single narrow column. Also fixed the opposite edge case: a grapheme cluster explicitly forced to emoji presentation via a trailing U+FE0F VARIATION SELECTOR-16 (e.g. ▶️) is now measured as double-width even when its base character is otherwise narrow, since `src/ascii/display-width.ts`'s cluster-aware sizing now checks for VS16 directly rather than relying solely on `isWideChar`'s per-code-point classification. No library API changes.
