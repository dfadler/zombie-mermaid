---
'zombie-mermaid': patch
---

Demo site: the sample card's `Edit` button no longer overlaps wrapped mermaid source text in the source panel. `.source-panel` reserved only 0.75rem of bottom padding — less than the button's own 44px min-height plus its 0.75rem offset — so any code whose last line reached the panel's bottom edge rendered directly underneath the button. Bottom padding is now sized to clear the button (see #403).
