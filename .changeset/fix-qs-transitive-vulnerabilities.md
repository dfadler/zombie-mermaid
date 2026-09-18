---
'zombie-mermaid': patch
---

Pin the transitive `qs` dependency (pulled in via `@modelcontextprotocol/sdk`'s Express-based HTTP transport) to `^6.16.0`, fixing two moderate-severity advisories in `qs@6.15.3`: an array-limit bypass via bracket-key comma parsing ([GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx)) and a denial-of-service via attacker-controlled `isBuffer` ([GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g)).
