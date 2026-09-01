---
'zombie-mermaid': patch
---

Demo site: add a public maintenance-transparency dashboard (`dashboard.html`, linked from the gallery's hero buttons) comparing this fork against upstream beautiful-mermaid — commit recency, open/merged issue and PR counts, release cadence, and which upstream bugs this fork has fixed that are still open upstream. The page renders a committed JSON snapshot (`demo/dashboard-data.json`, refreshed via `pnpm run dashboard:data`) rather than fetching live, so `build:site` stays network-free on every PR. No library API changes.
