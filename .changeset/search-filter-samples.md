---
'zombie-mermaid': patch
---

Demo site: added a search/filter box above the sidebar's category list (#284), matching sample title, diagram type, and description client-side against the sample data already embedded in the page. Matching sidebar entries and sample sections stay visible across every category at once, non-matching ones and empty categories hide, and a labeled, `aria-live` result count announces how many samples matched. No library API changes.
