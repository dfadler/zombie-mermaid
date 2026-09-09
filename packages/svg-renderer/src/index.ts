// ============================================================================
// @zombie-mermaid/svg-renderer — SVG emission and ELK-backed layout
//
// Every file re-exported below was grep-verified (zombie-mermaid#625,
// umbrella #620) as unreachable from `src/ascii/index.ts` except through
// the SVG-side modules the umbrella still owns — so nothing here can put
// `elkjs` on the ASCII renderer's dependency path once #623 extracts it.
//
// This package depends on `@zombie-mermaid/core` and, since #624, on
// `@zombie-mermaid/mermaid-parser` too — an ordinary, acyclic dependency
// (both `svg-renderer` and the future `ascii-renderer` depend on
// `mermaid-parser` directly, per the scoping doc's finding 2), not a cycle:
// every per-type `layout.ts`/`renderer.ts` below needs the positioned-
// diagram types `mermaid-parser`'s `types.ts` halves own, and
// `class/layout.ts` needs `formatClassMember` from `mermaid-parser`'s
// `class/format.ts`. It deliberately does NOT re-export the internal
// `layout-engine/` modules the umbrella never imports
// (`constants.ts` — whose `DEFAULTS` would collide with `core`'s theme
// `DEFAULTS` anyway — plus `edge-bundling.ts`, `from-elk.ts`,
// `layer-alignment.ts` and `to-elk.ts`): they are `layoutGraphSync()`'s
// implementation, not its API. `elk-graph-builder.ts` is the exception:
// `class/layout.ts` and `er/layout.ts` (moved into this package under
// #624) call its primitives directly (zombie-mermaid#616), so it is part
// of the public API alongside `elk-adapter-utils.ts`.
//
// `layout.ts` re-exports `layoutGraphSync` from `layout-engine.ts`, so the
// two star-exports below resolve to one and the same binding — legal, and
// not an ambiguous re-export. It stays a module of its own (rather than
// being folded away here) because #625 is a move, not a redesign.
//
// `class/`, `er/`, `sequence/`, `xychart/` hold each diagram type's
// renderer half (`layout.ts` + `renderer.ts`) — the other half
// (`parser.ts`/`types.ts`, plus `class/format.ts`, `sequence/box-color.ts`,
// `sequence/activation-check.ts`, `xychart/colors.ts`) moved to
// `@zombie-mermaid/mermaid-parser` under the same issue (#624), per the
// scoping doc's finding 1: each per-type directory used to mix both halves
// in one place, and the split point already existed at the file level.
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

export * from './class/layout.ts'
export * from './class/renderer.ts'
export * from './er/layout.ts'
export * from './er/renderer.ts'
export * from './sequence/layout.ts'
export * from './sequence/renderer.ts'
export * from './xychart/layout.ts'
export * from './xychart/renderer.ts'
