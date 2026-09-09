// ============================================================================
// @zombie-mermaid/mermaid-parser — per-type diagram parsers
//
// Class, ER, sequence, and XY chart diagrams have no shared generic model
// the way flowcharts/state diagrams do (`MermaidGraph`, parsed by the
// umbrella's own `src/parser.ts`). Both `svg-renderer` and `ascii-renderer`
// import each type's parse function and types directly — confirmed by grep
// (zombie-mermaid#624, umbrella #620, `monorepo-conversion-scoping.md`
// finding 2) — so this package's public API is every per-type parse
// function plus its types, not a single generic entry point.
//
// Each of `src/class/`, `src/er/`, `src/sequence/`, `src/xychart/` used to
// mix this parser half (`parser.ts`, `types.ts`, and — per file, not
// per-half-pair, see the scoping doc's addendum correction 3 —
// `class/format.ts`, `sequence/box-color.ts`, `sequence/activation-check.ts`,
// `xychart/colors.ts`) with a renderer half (`layout.ts`, `renderer.ts`) in
// the same directory. The renderer half moved into
// `packages/svg-renderer/src/<type>/` instead — see that package's `index.ts`
// header for the reverse dependency this split introduces (`svg-renderer`
// depends on this package for the positioned-diagram types and a handful of
// parser-side helpers, an ordinary acyclic workspace shape per finding 2).
//
// This package depends only on `@zombie-mermaid/core` — verified: no file
// below imports `elkjs`, `@zombie-mermaid/svg-renderer`, or anything from
// the umbrella. `toDirection` moved here from the umbrella's `src/parser.ts`
// (alongside `isDirection`, already `core` since #625) specifically so
// `er/parser.ts` below could use it without importing the umbrella and
// creating a cycle — see `packages/core/src/direction.ts`'s header.
// ============================================================================

export * from './class/parser.ts'
export * from './class/types.ts'
export * from './class/format.ts'

export * from './er/parser.ts'
export * from './er/types.ts'

export * from './sequence/parser.ts'
export * from './sequence/types.ts'
export * from './sequence/box-color.ts'
export * from './sequence/activation-check.ts'
export * from './sequence/activation-fix.ts'

export * from './xychart/parser.ts'
export * from './xychart/types.ts'
export * from './xychart/colors.ts'

export * from './expanded-shapes.ts'
