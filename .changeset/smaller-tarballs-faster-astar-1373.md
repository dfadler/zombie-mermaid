---
'@zombie-mermaid/ascii-renderer': patch
'zombie-mermaid': patch
---

Stop publishing test files in the npm tarballs (the `zombie-mermaid` tarball drops from about 255 KB to 46 KB), and speed up ASCII edge routing by about 25% on large flowcharts with no change to output. Refs #1373, #1374.
