---
'zombie-mermaid': patch
---

The published package is smaller: `dist/cli.js` now imports the `ascii-layout` entry instead of bundling a second copy of its chunks. Packed size 52,468 B to 46,941 B (-5,527 B); `check:pack-dist` now fails if the duplicate returns (#2272).
