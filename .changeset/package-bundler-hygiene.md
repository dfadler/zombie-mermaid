---
'zombie-mermaid': patch
---

Improve bundler compatibility: mark the package `"sideEffects": false` so bundlers can safely tree-shake unused exports (the library is a pure computation package with no top-level side effects in its published entry point), and add a `"default"` condition to the `exports` map as a fallback for resolvers that don't fully support conditional exports.
