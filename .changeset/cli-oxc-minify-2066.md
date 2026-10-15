---
'zombie-mermaid': patch
---

`dist/cli.js` is now minified with Oxc (the Vite 8 default) instead of esbuild; the bundle-size scripts measure with Vite too, and `esbuild` is no longer a direct devDependency (#2066).
