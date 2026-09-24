---
"@zombie-mermaid/core": minor
---

Remove the unused `componentSpacing` field from `RenderOptions` /
`FlowchartRenderOptions`. It was a no-op accepted only for forward
compatibility and was never read by any renderer. This narrows the public
`FlowchartRenderOptions` type — a TypeScript consumer passing
`componentSpacing` in a strictly-typed object literal will now see a type
error, though no runtime behavior changes since the field was never used.
