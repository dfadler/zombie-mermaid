---
'zombie-mermaid': patch
---

Fix two ASCII-renderer crashes/corruptions found during a type-safety audit (#153):

- `createMapping`'s grid-layout level tracker was a fixed-size-100 array, silently producing `NaN` coordinates for flowchart chains deeper than ~25 nodes instead of laying out correctly.
- `determineLabelLine` could throw `Cannot read properties of undefined (reading 'x')` when a routed edge's path collapsed to a single point (e.g. closely-spaced/adjacent nodes whose preferred routing endpoints coincide).
