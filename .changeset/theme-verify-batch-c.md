---
---

No release: per-theme verification pass for the #684 theme-selector
restoration (#699-702: nord-light, dracula, github-light, github-dark).
No code changes — the underlying selector and live-re-theme mechanism was
already correct (#687-689) and every theme's bg/fg contrast is already
covered by the automated test added in the zinc/tokyo-night batch
(#691-694). This batch's own verification (functional + persistence +
ASCII + visual) is recorded in this PR's own description.
