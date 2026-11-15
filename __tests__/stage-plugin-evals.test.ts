import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { stagePluginEvals } from '../scripts/lib/stage-plugin-evals'

it('stages .claude without worktrees or results, resolving live symlinks (#3170)', () => {
  const root = mkdtempSync(join(tmpdir(), 'stage-test-'))
  const src = join(root, '.claude')
  mkdirSync(join(src, 'skills/a'), { recursive: true })
  mkdirSync(join(src, 'evals/results/run1'), { recursive: true })
  mkdirSync(join(src, 'worktrees/old/evals/skills'), { recursive: true })
  writeFileSync(join(root, 'real.md'), 'real')
  writeFileSync(join(src, 'evals/results/run1/r.json'), '{}')
  symlinkSync(join(root, 'real.md'), join(src, 'skills/a/SKILL.md'))
  symlinkSync(
    '../nowhere',
    join(src, 'worktrees/old/evals/skills/zombie-mermaid'),
  )

  const dest = join(root, 'out')
  stagePluginEvals(src, dest)

  expect(readFileSync(join(dest, 'skills/a/SKILL.md'), 'utf8')).toBe('real')
  expect(existsSync(join(dest, 'worktrees'))).toBe(false)
  expect(existsSync(join(dest, 'evals/results'))).toBe(false)
})
