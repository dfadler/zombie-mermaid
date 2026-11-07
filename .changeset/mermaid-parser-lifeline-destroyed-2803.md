---
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

Restore `Lifeline.destroyed` as a `@deprecated` field. The previous release dropped it from the public `Lifeline` type, so TypeScript code reading `lifeline.destroyed` stopped compiling. The layout sets it again for a destroyed participant (nothing renders from it any more); read `Actor.destroyedAt` instead.
