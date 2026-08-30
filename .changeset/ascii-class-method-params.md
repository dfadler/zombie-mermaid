---
'zombie-mermaid': patch
---

ASCII renderer: class diagram methods now include their parameter list (e.g. `+makeSound(volume): void`) instead of silently dropping it. The SVG renderer already formatted methods correctly; the ASCII renderer had its own, independently-drifted formatting function that never read `ClassMember.params`. Both renderers now share one `formatClassMember` function (`src/class/format.ts`), so this can't drift again. This also makes ASCII visibility markers match the SVG's spacing (`+ name` instead of `+name`).
