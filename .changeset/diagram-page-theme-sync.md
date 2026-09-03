---
'zombie-mermaid': patch
---

Demo site: the per-diagram-type SEO pages (`/diagrams/<type>.html`) now share the main gallery's theme preference instead of tracking it separately. Previously a theme picked on the main gallery (`localStorage['mermaid-theme']`) had no effect on `/diagrams/*` pages, which read a different key (`zm-diagram-page-theme`) that was only ever set by picking a theme on a diagrams page itself — so a returning visitor who'd already chosen a theme on the gallery would land on a diagrams page still showing the build-time default. Both surfaces now read and write the same `mermaid-theme` key, so a theme picked on either one carries over to the other.
