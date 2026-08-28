---
'zombie-mermaid': patch
---

Fix `role="img"` and `decorative`'s `aria-hidden="true"` hiding a real, focusable `click A "url"` link from assistive tech while leaving it Tab-reachable — `aria-hidden` on an ancestor of a focusable element is an explicit WAI-ARIA violation. When any node has a link, the root `<svg>` now gets no `role` at all (`title`/`aria-labelledby` still apply if given); `decorative` is silently overridden in that case rather than honored. See #239.
