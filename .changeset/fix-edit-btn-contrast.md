---
'zombie-mermaid': patch
---

Demo site: raise the "Edit" link's contrast to meet WCAG AA. It was styled as faint tertiary text (1.94:1 default theme, 2.65:1 Dracula — both well under the 4.5:1 minimum) and is the entry point to live editing. Promoted to a small bordered button with an 80% fg text mix instead of 35%, so it reads as interactive without relying on color alone. No library API changes.
