---
'zombie-mermaid': patch
---

Fixed `build:site` to clean `site/` before regenerating it. Previously, running the script twice without clearing `site/` in between caused the second run's `mv diagrams site/diagrams` to nest the diagrams pages under `site/diagrams/diagrams` instead of replacing them, since `site/diagrams` already existed as a directory from the first run. Local-dev-only: CI's publish workflow always starts from a fresh checkout, so it never hit this. No library API changes.
