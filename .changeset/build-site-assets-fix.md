---
---

No release: fixes `build:site` (package.json) to move the gitignored
repo-root `assets/` directory (written by `index.ts`'s `bundleClientScript()`,
see `demo/index-page-client.ts`) into `site/assets/`. The script previously
never moved it, so `site/index.html`'s `<script src="assets/index-page-client.js">`
tag pointed at a file that never shipped to GitHub Pages
(`.github/workflows/pages.yml` uploads only `site/`), silently breaking the
homepage's theme-showcase interactivity (live diagram re-theming, chrome
re-theming, sticky-nav theme-picker relocation) on the deployed site. Found
while working #799, which deliberately avoided this same pattern for its own
new client bundle. Demo-site build tooling only — nothing here touches the
published `zombie-mermaid` package.
