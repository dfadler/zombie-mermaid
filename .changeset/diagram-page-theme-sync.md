---
'zombie-mermaid': patch
---

Demo site: the per-diagram-type SEO pages (`/diagrams/<type>.html`) now share the main gallery's theme, both for a returning visitor's stored preference and for a first-time/deep-linked visitor's initial look.

- Both surfaces now read and write the same `localStorage['mermaid-theme']` key, so a theme picked on either one carries over to the other. Previously the diagrams pages tracked a separate key (`zm-diagram-page-theme`) that was only ever set by picking a theme on a diagrams page itself, so a returning visitor who'd already chosen a theme on the gallery would land on a diagrams page still showing the build-time default.
- The diagrams pages' theme picker now includes the same "Default" pill the main gallery shows, and every page now build-renders in that Default look rather than an arbitrary named theme (previously whichever `THEMES` entry happened to come first in iteration order). A first-time visitor with no stored preference — e.g. arriving via a deep link from search — now sees the exact same initial look on a diagrams page as on the main gallery.
