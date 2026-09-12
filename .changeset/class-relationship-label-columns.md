---
'zombie-mermaid': patch
---

ASCII class diagrams: when several relationships connect the same pair of classes, each relationship's label now sits on the same column its own connector line uses. The label-territory and label-drawing passes had been computing connection points without the per-pair column offset the line-routing pass applies (a semantic conflict between the reciprocal-relationship fix for #448 and the label-territory fix for #447), which truncated labels such as `reads` to `rea…`. Also restores compilation of `main`, where the same merge had left the relationship loop's callback unclosed.
