---
'zombie-mermaid': patch
---

`zombie-mermaid/ascii` no longer pulls `elkjs` into its bundle. The shared per-diagram-type registry added in #533 held both renderers' entries in one module, so importing it from the ASCII front door dragged `src/er/layout.ts` → `src/elk-instance.ts` → `elkjs` into the `./ascii` entry's module graph — defeating the reason that subpath export exists (#300). The registry is now split by renderer (`src/ascii/registry.ts` owns the ASCII half), which removes the import cycle between `src/ascii/**` and the umbrella and drops `import "elkjs/lib/elk.bundled.js"` from `dist/ascii.js`: 218.9 KB → 178.3 KB raw, 56 KB → 47 KB gzipped, and the entry now loads with no `elkjs` on disk at all. No API change — every export, and every byte of rendered ASCII and SVG output, is identical. Refs #623.
