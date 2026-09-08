---
---

No release: flips the demo/site-generator files (`editor.ts`, `pages.ts`, `ascii-html.ts`, `xychart-test.ts`, `demo/components/theme-picker.tsx`, the editor test harness) over to import `THEMES`/`isWideChar` from `@zombie-mermaid/core` directly, and removes the two temporary re-export shims (`src/theme.ts`, `src/text-metrics.ts`) the core-extraction PR left in place for them (#625, umbrella #620). No consumer-facing or rendered-output change.
