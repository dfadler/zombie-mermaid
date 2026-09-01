---
'zombie-mermaid': patch
---

Per-diagram-type SEO pages (`/diagrams/<type>.html`) now use the same wide/narrow orientation swap as the main samples page: a wide (LR/RL) flowchart or state diagram pre-renders a top-down alternate and swaps to it under 640px viewport width (CSS media query), so it no longer overflows on mobile while still using the available width on a wide viewport. Shared detection/rewrite logic extracted to `demo/diagram-orientation.ts`. No library API changes.
