// Statically verifies the load-order contract that only lives in editor.ts's
// readJsFiles() `order` array: each editor/js/*.js file is a plain,
// `var`/`function`-scoped global-scope script with no import/export,
// concatenated into one inline <script type="module"> in that exact order.
// A file that reads a global another file defines relies entirely on that
// other file appearing earlier in the array -- nothing in the individual
// .js files documents this. See
// https://github.com/dfadler/zombie-mermaid/issues/744.
//
// Because the 18 files execute as ONE synchronous script (no top-level
// await anywhere in them), a global declared by a later file is still safe
// to reference from *inside* an earlier file's function body or event
// handler -- by the time that callback actually runs (a click, a timer, a
// render), the whole script has already finished loading top-to-bottom, so
// every file's top-level `var`/`function` exists by then. `rendering.js`'s
// applyThemeToPage() reading `isDark` (declared later, in dark-mode.js) is
// exactly this: safe, deferred, and unrelated to file order.
//
// The one place order actually matters at runtime is a file's *top-level*
// code -- statements that run immediately when that file's slice of the
// concatenated script executes, before any event has fired. If such a
// statement reads a global from a file that hasn't run yet, that's a real
// ReferenceError/TypeError waiting to happen the moment someone reorders
// `order` without understanding the dependency (e.g. pan.js's top-level
// `previewBody.addEventListener(...)` requires elements.js, which declares
// `previewBody`, to have already run).
//
// So this test walks each file's AST and, for every identifier referenced
// directly in its top-level scope (not inside a nested function/callback),
// checks that the identifier is either a known browser/JS global or was
// declared by an earlier file in JS_FILES. It uses `eslint`'s own scope
// analysis (already a project devDependency) rather than hand-rolling a
// scope resolver.
import { readFileSync } from 'node:fs'
import { Linter } from 'eslint'
import type { Rule, Scope } from 'eslint'
import { describe, expect, it } from 'vitest'

const EDITOR_DIR = new URL('../', import.meta.url)
const EDITOR_TS_PATH = new URL('../../editor.ts', import.meta.url)

/**
 * Reads the `order` array out of readJsFiles() in editor.ts as plain text,
 * rather than importing editor.ts (which would run its top-level side
 * effects -- esbuild-bundling src/browser.ts and writing editor.html to
 * disk; see ./support/harness.ts's own JS_FILES constant for the same
 * constraint, which duplicates the array for that reason).
 *
 * Extracting it from source instead of hand-duplicating it here means this
 * test always checks the *actual* order array, so a reorder in editor.ts
 * is caught even if a contributor doesn't know a duplicate needs updating.
 */
function readJsFilesOrder(): string[] {
  const source = readFileSync(EDITOR_TS_PATH, 'utf-8')
  const fnMatch = source.match(
    /async function readJsFiles\(\)[^{]*\{([\s\S]*?)\n\}/,
  )
  if (!fnMatch) {
    throw new Error(
      'Could not find readJsFiles() in editor.ts -- has it been renamed or restructured? ' +
        'Update the extraction regex in editor/__tests__/module-load-order.test.ts.',
    )
  }
  const orderMatch = fnMatch[1].match(/const order = \[([\s\S]*?)\]/)
  if (!orderMatch) {
    throw new Error(
      "Could not find readJsFiles()'s `order` array in editor.ts -- has it been renamed or restructured? " +
        'Update the extraction regex in editor/__tests__/module-load-order.test.ts.',
    )
  }
  const entries = [...orderMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]!)
  if (entries.length === 0) {
    throw new Error(
      "Found readJsFiles()'s `order` array in editor.ts but couldn't parse " +
        'any file entries out of it.',
    )
  }
  return entries
}

const JS_FILES = readJsFilesOrder()

/**
 * Standard ECMAScript and browser globals the editor/js/*.js files use.
 * None of these are declared by any editor/js/*.js file, so they're seeded
 * up front rather than being treated as an ordering dependency.
 */
const KNOWN_RUNTIME_GLOBALS = [
  // ECMAScript builtins
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Math',
  'JSON',
  'console',
  'RegExp',
  'Set',
  'Map',
  'WeakMap',
  'WeakSet',
  'Promise',
  'Symbol',
  'Error',
  'TypeError',
  'RangeError',
  'isNaN',
  'isFinite',
  'parseInt',
  'parseFloat',
  'NaN',
  'Infinity',
  'undefined',
  'globalThis',
  // Browser/DOM
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'performance',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'atob',
  'btoa',
  'Blob',
  'URL',
  'Image',
  'XMLSerializer',
  'ClipboardItem',
  'fetch',
  'CustomEvent',
  'Event',
  'MutationObserver',
]

interface FileScope {
  /** Names declared at the top level of this file (var/function). */
  declared: string[]
  /**
   * Names referenced directly in this file's top-level scope (i.e. NOT
   * inside a nested function/arrow function/callback body) that this file
   * does not itself declare.
   */
  topLevelReferences: string[]
}

const linter = new Linter()

/**
 * Parses `code` and returns its top-level declarations and top-level-scope
 * references, using ESLint's own scope analysis (`eslint-scope` under the
 * hood) via a throwaway custom rule rather than a hand-rolled AST walk.
 *
 * `knownGlobals` are the identifiers considered already defined by the time
 * this file runs (seeded runtime globals + every earlier file's top-level
 * declarations) -- anything not in that set that this file's top-level code
 * still references comes back in `topLevelReferences`.
 */
function analyzeFileScope(
  code: string,
  knownGlobals: ReadonlySet<string>,
): FileScope {
  const result: FileScope = { declared: [], topLevelReferences: [] }

  const collectScopeRule: Rule.RuleModule = {
    create(context) {
      return {
        Program() {
          const globalScope = context.sourceCode.scopeManager
            .globalScope as Scope.Scope
          for (const variable of globalScope.variables) {
            if (variable.defs.length > 0) result.declared.push(variable.name)
          }
          for (const ref of globalScope.through) {
            // `through` includes every unresolved reference anywhere in the
            // file, including inside nested function bodies. Keep only the
            // ones whose enclosing scope IS the top-level scope itself --
            // those are the statements that run immediately, in file order,
            // as opposed to a deferred callback/handler.
            if (ref.from === globalScope) {
              result.topLevelReferences.push(ref.identifier.name)
            }
          }
        },
      }
    },
  }

  const globals = Object.fromEntries(
    [...knownGlobals].map((name) => [name, 'readonly'] as const),
  )

  const messages = linter.verify(code, {
    languageOptions: {
      sourceType: 'script',
      ecmaVersion: 2022,
      globals,
    },
    plugins: {
      'load-order-check': { rules: { 'collect-scope': collectScopeRule } },
    },
    rules: { 'load-order-check/collect-scope': 'error' },
  })

  // A genuine syntax error would otherwise fail silently (empty results).
  const fatal = messages.find((m) => m.fatal)
  if (fatal) {
    throw new Error(`Failed to parse: ${fatal.message}`)
  }

  return result
}

describe('editor/js load order (editor.ts readJsFiles order array)', () => {
  it('every top-level statement only references globals already declared by an earlier file or the runtime', () => {
    const knownGlobals = new Set(KNOWN_RUNTIME_GLOBALS)
    const violations: string[] = []

    for (const file of JS_FILES) {
      const code = readFileSync(new URL(file, EDITOR_DIR), 'utf-8')
      const { declared, topLevelReferences } = analyzeFileScope(
        code,
        knownGlobals,
      )

      const undeclared = [...new Set(topLevelReferences)]
      if (undeclared.length > 0) {
        violations.push(
          `${file} references ${undeclared.join(', ')} at its top level, ` +
            `but no earlier file in the \`order\` array declares ${
              undeclared.length > 1 ? 'them' : 'it'
            }`,
        )
      }

      for (const name of declared) knownGlobals.add(name)
    }

    expect(violations).toEqual([])
  })
})
