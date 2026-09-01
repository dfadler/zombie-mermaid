---
'zombie-mermaid': patch
---

Demo site: raise the "Edit" button and the SVG/ASCII segmented toggle to the 44px WCAG 2.5.5/2.5.8 comfortable touch-target minimum on mobile. `.edit-btn` measured 29x16px (well under even the 24px AA floor) because it was sized to its text content; it now gets real min-width/min-height plus flex centering. `.seg-btn` measured 49x31px; its `min-height` now rises to 44px under the same narrow-viewport (640px) breakpoint the orientation-swap feature already uses, so the desktop layout stays as compact as before. No library API changes.
