// ============================================================================
// @zombie-mermaid/svg-renderer — SVG emission and ELK-backed layout
//
// Every file re-exported below was grep-verified (zombie-mermaid#625,
// umbrella #620) as unreachable from `src/ascii/index.ts` except through
// the SVG-side modules the umbrella still owns — so nothing here can put
// `elkjs` on the ASCII renderer's dependency path once #623 extracts it.
//
// This package depends on `@zombie-mermaid/core` and on nothing else in
// the workspace. It deliberately does NOT re-export the internal
// `layout-engine/` modules the umbrella never imports
// (`constants.ts` — whose `DEFAULTS` would collide with `core`'s theme
// `DEFAULTS` anyway — plus `edge-bundling.ts`, `from-elk.ts`,
// `layer-alignment.ts` and `to-elk.ts`): they are `layoutGraphSync()`'s
// implementation, not its API. `elk-graph-builder.ts` is the exception:
// `src/class/layout.ts` and `src/er/layout.ts` (still in the umbrella)
// call its primitives directly (zombie-mermaid#616), so it is part of
// the public API alongside `elk-adapter-utils.ts`.
//
// `layout.ts` re-exports `layoutGraphSync` from `layout-engine.ts`, so the
// two star-exports below resolve to one and the same binding — legal, and
// not an ambiguous re-export. It stays a module of its own (rather than
// being folded away here) because #625 is a move, not a redesign.
// ============================================================================

export * from './edge-curves.ts'
export * from './elk-instance.ts'
export * from './layout.ts'
export * from './layout-engine.ts'
export * from './layout-engine/elk-adapter-utils.ts'
export * from './layout-engine/elk-graph-builder.ts'
export * from './renderer.ts'
export * from './resolve-colors.ts'
export * from './shape-clipping.ts'
export * from './styles.ts'
