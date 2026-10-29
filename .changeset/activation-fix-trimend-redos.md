---
"@zombie-mermaid/mermaid-parser": patch
---

Trim trailing whitespace with `trimEnd()` instead of a `/\s+$/` regex when `fixSequenceActivations` appends `deactivate` lines, so a diagram ending in a very long run of whitespace no longer takes quadratic time (closes the last open CodeQL polynomial-ReDoS alert).
