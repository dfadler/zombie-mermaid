---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/mcp': patch
---

Ship each package's type declarations once instead of twice. The rolled-up declaration now lives in `dist/shared/`, and `dist/*.d.ts` and `dist/*.d.cts` are one-line re-exports of it, so install size drops by about 62 KB packed. The `exports` map and the types your editor sees are unchanged, and `node16`, `nodenext` and `bundler` consumers still resolve them with `skipLibCheck` off. (#2196)
