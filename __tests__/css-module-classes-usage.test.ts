/**
 * Enforces both halves of zombie-mermaid#969's acceptance criteria for
 * every `.module.css` file in `scripts/load-css-module.ts`'s
 * `HASHED_MODULE_CSS_BASENAMES`:
 *
 * 1. Its committed generated classes map (what a browser-safe consumer
 *    like primitives.tsx actually imports — see
 *    `scripts/generate-primitives-classes.ts`'s header comment) has to
 *    match a fresh build of the `.module.css` source. If someone edits the
 *    CSS without regenerating, this fails instead of the map silently
 *    going stale.
 * 2. Nothing outside that file and its own generated classes module may
 *    hardcode one of its source class names as a literal `className="..."`
 *    string. This is the actual "mechanism… prevents a future .module.css
 *    file from silently keeping unhashed names" the issue asks for: adding
 *    a file to `HASHED_MODULE_CSS_BASENAMES` is a deliberate, reviewed
 *    step, and this test is what makes "did every consumer really migrate"
 *    a checked fact rather than a claim in a PR description.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PRIMITIVES_CLASSES } from '../demo/components/generated/primitives-classes.ts'
import { loadCssModule } from '../scripts/load-css-module.ts'

interface HashedModule {
  /** Repo-relative path to the `.module.css` source. */
  cssPath: string
  /** Repo-relative path to its generated classes map. */
  generatedPath: string
  /** That classes map, as committed. */
  committed: Record<string, string>
}

const REPO_ROOT_URL = new URL('../', import.meta.url)
const REPO_ROOT = fileURLToPath(REPO_ROOT_URL)

const HASHED_MODULES: HashedModule[] = [
  {
    cssPath: 'demo/components/primitives.module.css',
    generatedPath: 'demo/components/generated/primitives-classes.ts',
    committed: PRIMITIVES_CLASSES,
  },
]

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(full)))
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

/**
 * True if `content` has a plain, quoted JSX `className="…"`/`className='…'`
 * attribute whose whitespace-separated tokens include `token` exactly.
 * Deliberately narrow: a migrated consumer's className is a JS expression
 * (`className={...}`), which this pattern never matches, so it flags only
 * the literal-string shape #969 set out to eliminate — not every substring
 * that happens to contain the token (e.g. `gallery-card` for `card`).
 */
function hasLiteralClassToken(content: string, token: string): boolean {
  const attrRe = /className=(["'])((?:(?!\1).)*)\1/g
  for (const match of content.matchAll(attrRe)) {
    if (match[2].split(/\s+/).includes(token)) return true
  }
  return false
}

describe('hashed .module.css classes stay in sync and unmigrated', () => {
  for (const mod of HASHED_MODULES) {
    it(`${mod.generatedPath} matches a fresh build of ${mod.cssPath}`, async () => {
      const { classes } = await loadCssModule(
        new URL(mod.cssPath, REPO_ROOT_URL),
      )
      expect(mod.committed).toEqual(classes)
    })

    it(`no demo/ file outside ${mod.cssPath}/${mod.generatedPath} hardcodes one of its class names`, async () => {
      const allowed = new Set([mod.cssPath, mod.generatedPath])
      const files = await listSourceFiles(path.join(REPO_ROOT, 'demo'))
      const offenders: string[] = []
      for (const file of files) {
        const relPath = path.relative(REPO_ROOT, file)
        if (allowed.has(relPath)) continue
        const content = await readFile(file, 'utf8')
        for (const sourceName of Object.keys(mod.committed)) {
          if (hasLiteralClassToken(content, sourceName)) {
            offenders.push(`${relPath}: literal "${sourceName}"`)
          }
        }
      }
      expect(offenders).toEqual([])
    })
  }
})
