/**
 * Rot guard for the editor skill (#1608): every repo path named in a
 * backticked first table cell of `.agents/skills/editor.md` must exist, so a
 * rename/delete fails here instead of silently stranding the skill.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const md = readFileSync(join(REPO_ROOT, '.agents/skills/editor.md'), 'utf8')

// First table cell of each row; a cell may hold several `a` / `b` paths.
const paths = [...md.matchAll(/^\|\s*([^|]+?)\s*\|/gm)]
  .flatMap((m) => [...m[1].matchAll(/`([^`]+)`/g)].map((p) => p[1]))
  .filter((p) => /[./]/.test(p))

// Generated output (gitignored), not a source file.
const GENERATED = new Set(['editor.html'])

describe('.agents/skills/editor.md file table', () => {
  it('lists some paths', () => {
    expect(paths.length).toBeGreaterThan(5)
  })

  it.each([...new Set(paths)].filter((p) => !GENERATED.has(p)))(
    'path exists: %s',
    (p) => {
      // `editor/css/*.css`-style globs: check the directory part.
      const target = p.includes('*') ? dirname(p) : p
      expect(existsSync(join(REPO_ROOT, target)), p).toBe(true)
    },
  )
})
