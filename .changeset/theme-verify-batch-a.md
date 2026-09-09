---
---

No release: adds `src/__tests__/theme-palette-contrast.test.ts`, a
WCAG-contrast-ratio regression test guarding every built-in theme's
`bg`/`fg` legibility — a permanent, automated check rather than a one-off
manual verification, so a future theme addition with a genuinely
illegible pair fails CI instead of only being caught by a human noticing
a screenshot looks wrong. No runtime behavior changes. Part of the #684
theme-selector restoration's per-theme verification pass (#691-694:
zinc-light, zinc-dark, tokyo-night, tokyo-night-storm).
