---
'zombie-mermaid': patch
---

The samples page's URL hash now updates as you scroll — it tracks whichever sample card is currently under the sticky nav bar (`history.replaceState`, so scrolling never adds entries to browser history the way clicking a sidebar link does). Copying the current URL now gets you back to wherever you were reading, not just wherever you last clicked. No library API changes.
