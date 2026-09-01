---
'zombie-mermaid': patch
---

Demo site: added a `SoftwareApplication` JSON-LD block to `index.html`'s `<head>`, so Google (and other structured-data consumers) can identify the demo site as an entity — name, description, version, and license pulled from `package.json` at build time, plus the canonical GitHub Pages URL and a `sameAs` link back to the repository. Deliberately omits `aggregateRating`/`review`/`offers`: Google's Software App rich-result carousel requires one of those, but this repo has no real ratings to report and fabricating one would violate Search Console's webspam policy — this block is valid, accurate structured data, just not carousel-eligible on its own. No library API changes.
