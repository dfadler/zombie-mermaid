---
'zombie-mermaid': patch
---

Published an accessibility conformance statement (`docs/accessibility.md`) documenting what this library's SVG accessible-name behavior and the demo/editor site's keyboard/focus behavior actually guarantee, and added a standing CI-enforced test (`src/__tests__/svg-accessible-name-conformance.test.ts`) that verifies every diagram type this library supports produces a `role`-correct, nameable root `<svg>` under every `title`/`decorative`/interactive-link combination. No library API or rendered output changes.
