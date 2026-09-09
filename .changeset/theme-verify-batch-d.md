---
---

No release: per-theme verification pass for the #684 theme-selector
restoration (#703-706: solarized-light, solarized-dark, one-dark, and the
Default `''` pseudo-theme). No code changes — the underlying selector and
live-re-theme mechanism was already correct (#687-689) and every real
theme's bg/fg contrast is already covered by the automated test added in
the zinc/tokyo-night batch (#691-694). This batch's own verification
(functional + persistence + ASCII + visual, including confirming #685's
Default-vs-`zinc-light` decision is actually implemented as a distinct
`''` sentinel rather than an alias) is recorded in this PR's own
description.
