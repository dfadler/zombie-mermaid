---
'zombie-mermaid': patch
---

Fix the shared `Nav` component so the install pill no longer overlaps the "GitHub" link (and "Fork fixes"/the wordmark no longer wrap onto a second line) between roughly 901px and 1080px viewport width, by dropping the pill to its icon-only mobile form a little early in that range.
