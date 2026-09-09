// Architecture guard for the workspace packages carved out of `src/` by
// #625 (umbrella #620; scoped in docs/decisions/monorepo-conversion-scoping.md).
//
// The whole point of `@zombie-mermaid/core` is that it is a *sink*: both
// renderers depend on it and it depends on neither, so extracting
// `ascii-renderer` (#623) can't drag `elkjs` or any SVG emission code onto
// the `zombie-mermaid/ascii` entry. That property is invisible at runtime —
// a stray `import { renderSvg } from '@zombie-mermaid/svg-renderer'` added
// to a `core` module would compile, test green, and only show up later as a
// package cycle nobody can untangle. It is also easy to reintroduce by
// accident: the version of these lists in the scoping doc was built from
// *direct* `src/ascii/**` imports and got three files wrong, because
// `src/parser.ts` reaches them transitively (see the #623 addendum).
//
// So: walk what the files actually import, and assert the shape.
//
//   core            -> nothing in this repo, only `elkjs` (type-only)
//   mermaid-parser  -> `@zombie-mermaid/core`, nothing else
//   svg-renderer    -> `@zombie-mermaid/core`, `@zombie-mermaid/mermaid-parser`,
//                      and `elkjs`, nothing else
//
// `svg-renderer` depending on `mermaid-parser` (added under #624) is a new
// edge, not a violation of the sink property above: it is an ordinary,
// acyclic dependency (both `svg-renderer` and the future `ascii-renderer`
// depend on `mermaid-parser` directly — the scoping doc's finding 2), and
// `mermaid-parser` itself stays a sink exactly like `core` — it does not
// import `svg-renderer` back.
//
// None of the three may reach back into `src/` by relative path or by
// importing `zombie-mermaid` itself — the umbrella depends on them, never
// the reverse.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '../..')
const PACKAGES = resolve(REPO_ROOT, 'packages')

/**
 * Any static `import`/`export … from '<specifier>'`, plus side-effect-only
 * `import '<specifier>'` and dynamic `import('<specifier>')`.
 *
 * Deliberately over-approximating: this test only ever asks *which module
 * is named*, never whether the edge survives compilation, so a type-only
 * import counts the same as a value one. That is the strict direction —
 * `core` may not even type-reference `svg-renderer`, since a cycle in the
 * type graph blocks per-package builds just as thoroughly as one in the
 * runtime graph (the reason `LayoutCache`'s shape lives in core's
 * `types.ts` rather than in `elk-instance.ts`).
 */
const SPECIFIER_RE =
  /(?:^|\n)[ \t]*(?:import|export)\b[^'"\n]*?from[ \t]*['"]([^'"]+)['"]|(?:^|\n)[ \t]*import[ \t]*['"]([^'"]+)['"]|\bimport\([ \t]*['"]([^'"]+)['"]/g

/**
 * Same three shapes as `SPECIFIER_RE`'s first alternative, but split into
 * the `import`/`export` keyword and the clause between it and `from`, so a
 * whole-clause type-only import (`import type { X } from '...'` /
 * `export type { X } from '...'`) can be told apart from a real value one.
 * Used only by `valueSpecifiersOf` below — `specifiersOf`/`SPECIFIER_RE`
 * stay untouched since the import-graph tests above are deliberately
 * over-approximating.
 */
const FROM_CLAUSE_RE =
  /(?:^|\n)[ \t]*(?:import|export)\b([^'"\n]*?)from[ \t]*['"]([^'"]+)['"]/g
const SIDE_EFFECT_IMPORT_RE = /(?:^|\n)[ \t]*import[ \t]*['"]([^'"]+)['"]/g
const DYNAMIC_IMPORT_RE = /\bimport\([ \t]*['"]([^'"]+)['"]/g

function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...tsFilesUnder(path))
    else if (path.endsWith('.ts')) out.push(path)
  }
  return out
}

/** Every specifier named by any file in `packages/<name>/src`, deduped. */
function specifiersOf(pkg: string): Map<string, string[]> {
  const bySpecifier = new Map<string, string[]>()
  for (const file of tsFilesUnder(resolve(PACKAGES, pkg, 'src'))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(SPECIFIER_RE)) {
      const specifier = match[1] ?? match[2] ?? match[3]!
      const seen = bySpecifier.get(specifier) ?? []
      seen.push(relative(REPO_ROOT, file))
      bySpecifier.set(specifier, seen)
    }
  }
  return bySpecifier
}

/** Non-relative specifiers only — a package's real outward dependencies. */
function externalSpecifiers(pkg: string): string[] {
  return [...specifiersOf(pkg).keys()]
    .filter((s) => !s.startsWith('.'))
    .map((s) => (s.startsWith('@') ? s : s.split('/')[0]!))
    .filter((s, i, all) => all.indexOf(s) === i)
    .sort()
}

/**
 * Every specifier named by a *value* import in `packages/<name>/src` —
 * i.e. excluding a whole-clause `import type { X } from '...'` /
 * `export type { X } from '...'`, which is erased before bundling and so
 * shouldn't obligate a `dependencies` entry (#742). A per-symbol inline
 * `import { type X, y } from '...'` still counts as a value import here,
 * since `y` binds to a real runtime export from that module — this repo
 * doesn't currently mix the two on one specifier, so that distinction
 * isn't exercised, but the whole-clause check stays conservative rather
 * than trying to parse the individual specifiers in the braces.
 */
function valueSpecifiersOf(pkg: string): Map<string, string[]> {
  const bySpecifier = new Map<string, string[]>()
  const record = (specifier: string, file: string) => {
    const seen = bySpecifier.get(specifier) ?? []
    seen.push(relative(REPO_ROOT, file))
    bySpecifier.set(specifier, seen)
  }
  for (const file of tsFilesUnder(resolve(PACKAGES, pkg, 'src'))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(FROM_CLAUSE_RE)) {
      const [, clause, specifier] = match
      if (/^\s*type\b/.test(clause ?? '')) continue
      record(specifier!, file)
    }
    for (const match of source.matchAll(SIDE_EFFECT_IMPORT_RE)) {
      record(match[1]!, file)
    }
    for (const match of source.matchAll(DYNAMIC_IMPORT_RE)) {
      record(match[1]!, file)
    }
  }
  return bySpecifier
}

/**
 * Non-relative value-import specifiers only — what a package's
 * `dependencies` should actually list, since a type-only import is erased
 * before anything is bundled and never needs a runtime package present.
 */
function externalValueSpecifiers(pkg: string): string[] {
  return [...valueSpecifiersOf(pkg).keys()]
    .filter((s) => !s.startsWith('.'))
    .map((s) => (s.startsWith('@') ? s : s.split('/')[0]!))
    .filter((s, i, all) => all.indexOf(s) === i)
    .sort()
}

/**
 * A relative specifier that climbs out of `packages/<name>/src` — i.e. a
 * reach-around into the umbrella's `src/` or into a sibling package. The
 * many legitimate `../` hops inside `svg-renderer` (`layout-engine/*.ts`
 * importing `../styles.ts`, and — since #624 — each `class/`, `er/`,
 * `sequence/`, `xychart/` subdirectory's `layout.ts`/`renderer.ts`
 * importing sibling modules like `../elk-instance.ts`/`../renderer.ts`)
 * stay within the package and are resolved, not pattern-matched, so this
 * can't be fooled by depth.
 */
function escapingRelativeImports(pkg: string): string[] {
  const packageSrc = resolve(PACKAGES, pkg, 'src')
  const escapes: string[] = []
  for (const file of tsFilesUnder(packageSrc)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(SPECIFIER_RE)) {
      const specifier = match[1] ?? match[2] ?? match[3]!
      if (!specifier.startsWith('.')) continue
      const target = resolve(file, '..', specifier)
      if (!target.startsWith(packageSrc + '/')) {
        escapes.push(`${relative(REPO_ROOT, file)} -> ${specifier}`)
      }
    }
  }
  return escapes
}

describe('@zombie-mermaid/core is a workspace sink', () => {
  it('imports no workspace package and no npm dependency but elkjs', () => {
    // `elkjs` is `import type { ElkNode }` in `types.ts` only — carried for
    // `RenderOptions.layoutCache`'s shape and erased at compile time. Adding
    // any *runtime* dependency here would land in `dist/ascii.js`, which is
    // exactly what the `./ascii` subpath export (#300) exists to prevent.
    expect(externalSpecifiers('core')).toEqual(['elkjs'])
  })

  it('never reaches outside its own src/ by relative path', () => {
    expect(escapingRelativeImports('core')).toEqual([])
  })
})

describe('@zombie-mermaid/mermaid-parser is a workspace sink', () => {
  // Verified (#624, umbrella #620): no file under packages/mermaid-parser/src
  // imports `elkjs`, `@zombie-mermaid/svg-renderer`, or anything from the
  // umbrella — the property that lets both `svg-renderer` and the future
  // `ascii-renderer` depend on it without either dragging the other in.
  it('imports no workspace package and no npm dependency other than @zombie-mermaid/core', () => {
    expect(externalSpecifiers('mermaid-parser')).toEqual([
      '@zombie-mermaid/core',
    ])
  })

  it('never reaches outside its own src/ by relative path', () => {
    expect(escapingRelativeImports('mermaid-parser')).toEqual([])
  })
})

describe('@zombie-mermaid/svg-renderer depends only on core and mermaid-parser', () => {
  it('imports no workspace package other than @zombie-mermaid/core and @zombie-mermaid/mermaid-parser', () => {
    expect(externalSpecifiers('svg-renderer')).toEqual([
      '@zombie-mermaid/core',
      '@zombie-mermaid/mermaid-parser',
      'elkjs',
    ])
  })

  it('never reaches outside its own src/ by relative path', () => {
    expect(escapingRelativeImports('svg-renderer')).toEqual([])
  })
})

describe('workspace package manifests', () => {
  // The umbrella bundles all three packages into its own `dist/` (they are
  // absent from `isExternal` in vite.config.lib.ts), so nothing resolves
  // these names at install time and publishing them would be misleading.
  // Recommendation 2 of the scoping doc; the umbrella declares them as
  // devDependencies for the same reason.
  it.each(['core', 'mermaid-parser', 'svg-renderer'])(
    '%s is private and unpublished',
    (pkg) => {
      const manifest = JSON.parse(
        readFileSync(resolve(PACKAGES, pkg, 'package.json'), 'utf8'),
      ) as { name: string; private: boolean }
      expect(manifest.name).toBe(`@zombie-mermaid/${pkg}`)
      expect(manifest.private).toBe(true)
    },
  )

  // Declared `dependencies` must match actual *runtime* imports, not the
  // over-approximating `externalSpecifiers` above — a type-only import
  // (e.g. `core`'s `import type { ElkNode } from 'elkjs'`) is erased before
  // bundling and belongs in `devDependencies` instead, or a published
  // consumer of the package would pull in a runtime dependency it never
  // executes (#742).
  it('declares every runtime (non-type-only) external specifier its source actually imports', () => {
    for (const pkg of ['core', 'mermaid-parser', 'svg-renderer'] as const) {
      const manifest = JSON.parse(
        readFileSync(resolve(PACKAGES, pkg, 'package.json'), 'utf8'),
      ) as { dependencies?: Record<string, string> }
      expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
        externalValueSpecifiers(pkg),
      )
    }
  })
})
