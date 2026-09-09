---
---

No release: per-theme verification pass for the #684 theme-selector
restoration (#695-698: tokyo-night-light, catppuccin-mocha,
catppuccin-latte, nord). No code changes — the underlying selector and
live-re-theme mechanism was already correct (#687-689) and every theme's
bg/fg contrast is already covered by the automated test added in the
zinc/tokyo-night batch (#691-694). See that PR's body for the shared test;
this batch's own verification (functional + persistence + ASCII + visual)
is recorded in this PR's own description.
