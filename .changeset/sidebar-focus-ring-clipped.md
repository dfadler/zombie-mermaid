---
'zombie-mermaid': patch
---

Demo site: fix the shared `:focus-visible` ring being almost entirely clipped on sidebar sample links. `.sidebar-list li` set `overflow: hidden` intending to support text-truncation ellipsis, but no `white-space: nowrap` was ever paired with it, so the truncation never actually activated — the only real effect was clipping the ring down to a ~2px sliver. Dropped the dead `overflow`/`text-overflow` rule. No library API changes.
