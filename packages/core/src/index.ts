// ============================================================================
// @zombie-mermaid/core — the module set both renderers import
//
// Every file re-exported below was grep-verified (zombie-mermaid#625,
// umbrella #620) as reachable from BOTH front doors — `src/index.ts` (SVG)
// and `src/ascii/index.ts` (ASCII) — either directly or through
// `src/parser.ts`, which both call. Nothing here imports anything outside
// this package, so `core` is a sink in the workspace graph: the ASCII
// renderer can depend on it without dragging in `elkjs` or any SVG
// emission code.
//
// The one external reference is a type-only `import type { ElkNode }` in
// `types.ts` (for `RenderOptions.layoutCache`), erased before bundling.
//
// A barrel rather than per-file subpath exports: `#620`'s recommendation 4
// has the umbrella's three entries eventually become thin re-exports of
// real packages, which needs a real package API. `sideEffects: false` plus
// this package's total absence of module-level side effects is what keeps
// the barrel from widening any bundle — verified against the pre-split
// `dist/` byte-for-byte.
// ============================================================================

export * from './click-directive.ts'
export * from './color-utils.ts'
export * from './diagram-type.ts'
export * from './direction.ts'
export * from './direction-override.ts'
export * from './init-directive.ts'
export * from './multiline-utils.ts'
export * from './statements.ts'
export * from './style-directives.ts'
export * from './text-metrics.ts'
export * from './theme.ts'
export * from './types.ts'
