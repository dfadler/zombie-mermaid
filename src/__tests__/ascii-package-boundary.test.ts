// Architecture guard for the `ascii-renderer` package boundary (#623,
// umbrella #620; scoped in docs/decisions/monorepo-conversion-scoping.md).
//
// The scoping doc's readiness table calls `ascii-renderer` "ready now,
// mechanically" on the strength of one grep: `src/ascii/**` never imports
// `layout-engine/`, `elk-instance.ts`, or any per-type `layout.ts`/
// `renderer.ts`. That was true when it was written and false by the time
// #623 was picked up — `src/diagram-registry.ts` (#533) landed in between,
// and `src/ascii/index.ts` imported it, which dragged `src/er/layout.ts` ->
// `src/elk-instance.ts` -> `elkjs` into the `./ascii` entry's module graph.
// The symptom was visible in shipped output (`dist/ascii.js` began with
// `import "elkjs/lib/elk.bundled.js"`), and nothing failed.
//
// This test turns that grep into an enforced invariant, walking the real
// module graph from the ASCII entry rather than checking one directory's
// direct imports — a one-level grep would not have caught the regression
// above, since `src/ascii/**` never named a `layout.ts` itself.
//
// It intentionally asserts on the transitive closure, so it also fails if a
// *new* root-level module is pulled in: keeping that list explicit is what
// makes #624 (`mermaid-parser`) and #625 (`core`) mechanical rather than
// exploratory, since the allowed set below is exactly the dependency list
// those two issues have to satisfy.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '../..')
const ASCII_ENTRY = resolve(REPO_ROOT, 'src/ascii/index.ts')

/**
 * Any static `import`/`export ... from '<specifier>'`, capturing whether it
 * was written as a fully type-only statement (`import type` / `export
 * type`).
 *
 * The import clause is spelled out (`*`, `* as ns`, a default binding, a
 * braced list, or a default plus a braced list) rather than matched as a
 * lazy `[\s\S]*?` run up to the next `from`. A lazy run silently walks past
 * the end of its own statement: `export type { AsciiTheme, ColorMode }` has
 * no `from` of its own, so it would swallow whatever import came next and
 * report that one as type-only. Every alternative below is bounded by a
 * closing brace or an identifier, so a match can never cross a statement.
 *
 * Over-approximating type-ness is the safe direction: an inline `import {
 * type Foo, bar }` counts as a value edge even though only `bar` survives
 * compilation, which can only make the assertions below stricter.
 */
const STATEMENT_RE =
  /(?:^|\n)[ \t]*(?:import|export)[ \t]+(type[ \t]+)?(?:\*(?:[ \t]+as[ \t]+[A-Za-z_$][\w$]*)?|[A-Za-z_$][\w$]*(?:[ \t]*,[ \t]*\{[^}]*\})?|\{[^}]*\})[ \t\r\n]*from[ \t]*['"]([^'"]+)['"]/g

/** A side-effect-only `import '<specifier>'` — always a value edge. */
const BARE_IMPORT_RE = /(?:^|\n)[ \t]*import[ \t]*['"]([^'"]+)['"]/g

interface Edge {
  readonly specifier: string
  readonly typeOnly: boolean
}

function edgesOf(source: string): Edge[] {
  const edges: Edge[] = [...source.matchAll(STATEMENT_RE)].map((match) => ({
    specifier: match[2]!,
    typeOnly: match[1] !== undefined,
  }))
  for (const match of source.matchAll(BARE_IMPORT_RE)) {
    edges.push({ specifier: match[1]!, typeOnly: false })
  }
  return edges
}

const toRepoPath = (file: string): string =>
  relative(REPO_ROOT, file).replaceAll('\\', '/')

/**
 * Resolves a relative specifier to a file on disk. Most of this codebase
 * writes explicit `.ts` extensions (tsconfig's
 * `allowImportingTsExtensions`), but not all of it — `src/styles.ts` imports
 * `'./text-metrics'` — so the extensionless and directory-index forms are
 * tried too. Throws rather than skipping: a specifier this can't resolve
 * means the walk is silently incomplete, which would make every assertion
 * below vacuous.
 */
function resolveSpecifier(fromFile: string, specifier: string): string {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [base, `${base}.ts`, resolve(base, 'index.ts')]
  const found = candidates.find((candidate) => existsSync(candidate))
  if (found === undefined) {
    throw new Error(
      `Could not resolve '${specifier}' from ${toRepoPath(fromFile)} — ` +
        `tried ${candidates.map(toRepoPath).join(', ')}`,
    )
  }
  return found
}

interface ModuleGraph {
  /**
   * Every module reachable by any static edge, type-only included. This is
   * the set a real `ascii-renderer` package would have to be able to
   * resolve — `import type` is erased from the bundle but still has to
   * exist at build time.
   */
  readonly all: Set<string>
  /**
   * Modules reachable through at least one edge that survives compilation,
   * i.e. what actually lands in `dist/ascii.js`.
   */
  readonly runtime: Set<string>
  /** Bare (non-relative) specifiers reached by a runtime edge. */
  readonly externals: Set<string>
}

/**
 * Closure over the static import graph from `entry`. `followTypeOnly:
 * false` walks only edges that survive compilation.
 */
function closureFrom(entry: string, followTypeOnly: boolean): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const edge of edgesOf(readFileSync(file, 'utf8'))) {
      if (edge.typeOnly && !followTypeOnly) continue
      if (!edge.specifier.startsWith('.')) continue
      queue.push(resolveSpecifier(file, edge.specifier))
    }
  }
  return new Set([...seen].map(toRepoPath))
}

/** Bare (non-relative) specifiers imported by any module in `files`. */
function externalsOf(files: Iterable<string>): Set<string> {
  const externals = new Set<string>()
  for (const file of files) {
    for (const edge of edgesOf(
      readFileSync(resolve(REPO_ROOT, file), 'utf8'),
    )) {
      if (!edge.typeOnly && !edge.specifier.startsWith('.')) {
        externals.add(edge.specifier)
      }
    }
  }
  return externals
}

function moduleGraphOf(entry: string): ModuleGraph {
  const runtime = closureFrom(entry, false)
  return {
    all: closureFrom(entry, true),
    runtime,
    externals: externalsOf(runtime),
  }
}

/**
 * Modules outside `src/ascii/` that the ASCII entry is allowed to reach at
 * runtime. Each becomes a dependency on a real workspace package once the
 * split lands: `core` (#625) or `mermaid-parser` (#624).
 *
 * Adding an entry here is a deliberate decision about that future package
 * boundary, not a formality — check which of the two the new module belongs
 * to before widening this list, and note anything that fits neither.
 */
const ALLOWED_OUTSIDE_ASCII = {
  // -> `core` (#625). #625 landed (see the scoping doc's "Addendum (#625)")
  // and moved every one of these into `packages/core/`, so the ASCII entry
  // now reaches them through the bare `@zombie-mermaid/core` specifier —
  // invisible to this walker, which only follows relative edges (see
  // `closureFrom`). Kept as an empty bucket, not deleted, so a future
  // regression that reintroduces a *relative* `../`-style reach-around
  // around the package boundary still fails loudly against an explicit
  // list instead of silently passing.
  core: [],
  // -> `mermaid-parser` (#624). #624 landed and moved
  // `class/format.ts`/`parser.ts`, `er/parser.ts`, `sequence/box-color.ts`/
  // `parser.ts`/`activation-check.ts`, and `xychart/colors.ts`/`parser.ts`
  // into `packages/mermaid-parser/` — per-file, not per-half-pair, since the
  // doc's finding 1 only describes each per-type directory as a
  // `parser.ts`+`types.ts` half vs. a `layout.ts`+`renderer.ts` half, and
  // `class/format.ts`, `xychart/colors.ts`, `sequence/box-color.ts` fit
  // neither. The ASCII entry now reaches all of them through the bare
  // `@zombie-mermaid/mermaid-parser` specifier — invisible to this walker,
  // same as the `core` bucket above. `src/parser.ts` (the flowchart/state
  // parser) is NOT part of #624's scope — findings 1-2 are about
  // `class`/`er`/`sequence`/`xychart` only, which already have no shared
  // generic model the way flowcharts do — so it's the one entry still
  // reached by relative import.
  parser: ['src/parser.ts'],
  // The scoping doc's recommendation 5 originally put all three on its
  // `svg-renderer`-only list. #625's addendum found `init-directive.ts` and
  // `style-directives.ts` actually belong to `core` (both moved to
  // `packages/core/` and are now reached the same way as the `core` bucket
  // above — via the bare specifier, invisible here). `expanded-shapes.ts`
  // belonged to neither `core` nor `svg-renderer` and was still awaiting
  // #624 (`mermaid-parser`) — #768 moved it into
  // `packages/mermaid-parser/src/`, so the ASCII entry now reaches it
  // through the bare `@zombie-mermaid/mermaid-parser` specifier too,
  // invisible to this walker. Kept as an empty bucket, not deleted, for the
  // same reason the `core` bucket above is: a future regression that
  // reintroduces a *relative* reach-around across the package boundary
  // should still fail loudly against an explicit list.
  misclassifiedAsSvgOnly: [],
} as const

const ALLOWED = [
  ...ALLOWED_OUTSIDE_ASCII.core,
  ...ALLOWED_OUTSIDE_ASCII.parser,
  ...ALLOWED_OUTSIDE_ASCII.misclassifiedAsSvgOnly,
].sort()

/**
 * Modules the ASCII entry reaches *only* through `import type` — erased
 * from the bundle, so they cost `dist/ascii.js` nothing, but a real
 * `ascii-renderer` package still has to resolve them at build time.
 *
 * Used to list the four per-type `types.ts` halves
 * (`class`/`er`/`sequence`/`xychart`) while they still lived under
 * `src/<type>/` and were reached by a relative `import type`. #624 moved
 * them into `packages/mermaid-parser/src/<type>/types.ts`, so the ASCII
 * entry now reaches them through the bare `@zombie-mermaid/mermaid-parser`
 * specifier — invisible to this relative-only walker, same as `src/types.ts`
 * (`core`) and `src/elk-instance.ts` (`svg-renderer`) before them under
 * #625. Kept as an empty list, not deleted, for the same reason the `core`
 * bucket above is kept empty: a future regression that reintroduces a
 * *relative* `import type` reach-around across the package boundary should
 * still fail loudly against an explicit list.
 */
const TYPE_ONLY_REACH: string[] = []

const graph = moduleGraphOf(ASCII_ENTRY)
const outside = (files: Set<string>): string[] =>
  [...files].filter((file) => !file.startsWith('src/ascii/')).sort()

describe('ascii-renderer package boundary (#623)', () => {
  it('reaches nothing outside src/ascii/ beyond the core + parser modules #624/#625 will package', () => {
    expect(outside(graph.runtime)).toEqual(ALLOWED)
  })

  it('never reaches the SVG renderer, its layout engine, or elkjs at runtime', () => {
    const svgOnly = outside(graph.runtime).filter(
      (file) =>
        file === 'src/renderer.ts' ||
        file === 'src/elk-instance.ts' ||
        file === 'src/layout-engine.ts' ||
        file.startsWith('src/layout-engine/') ||
        /\/(layout|renderer)\.ts$/.test(file),
    )
    expect(svgOnly).toEqual([])
    expect([...graph.externals].filter((id) => id.startsWith('elkjs'))).toEqual(
      [],
    )
  })

  it('does not import back out of src/ascii/ into the umbrella registry', () => {
    // The specific back-edge that made `ascii-renderer` un-extractable: the
    // shared registry imported `renderXYChartAscii`/`renderErAscii` out of
    // src/ascii/ while src/ascii/index.ts imported the registry back out of
    // src/. Split by renderer in #623 — src/ascii/registry.ts owns the ASCII
    // half now, and this asserts the umbrella half stays unreachable.
    expect(graph.all.has('src/diagram-registry.ts')).toBe(false)
  })

  it('keeps the umbrella SVG registry free of ASCII imports (the other half of the cycle)', () => {
    const registry = readFileSync(
      resolve(REPO_ROOT, 'src/diagram-registry.ts'),
      'utf8',
    )
    const asciiImports = edgesOf(registry)
      .map((edge) => edge.specifier)
      .filter((specifier) => specifier.includes('ascii'))
    expect(asciiImports).toEqual([])
  })

  it('pulls in no build-time-only module beyond the known list', () => {
    const typeOnly = outside(graph.all).filter(
      (file) => !graph.runtime.has(file),
    )
    expect(typeOnly).toEqual(TYPE_ONLY_REACH)
  })
})
