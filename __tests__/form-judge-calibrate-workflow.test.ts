import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  calibrationPrompt,
  renderPrompt,
} from '../scripts/lib/form-judge-calibration.ts'

const read = (p: string) => readFileSync(p, 'utf8')
const calib = read('.github/workflows/form-judge-calibrate.yml')
const weekly = read('.github/workflows/form-judge-weekly.yml')
const uses = (s: string, re: RegExp) => s.match(re)?.[0]

describe('renderPrompt', () => {
  it('fills every placeholder in the real judge prompt', () => {
    const out = calibrationPrompt(
      read('scripts/form-judge-category-prompt.md'),
      '/w/d.json',
      '/w/r.jsonl',
    )
    expect(out).toContain('/w/d.json')
    expect(out).not.toMatch(/__[A-Z_]+__/)
  })

  it('the CLI prompt subcommand writes the rendered file', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'fjp-')), 'p.md')
    const r = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/form-judge-calibrate.ts',
        'prompt',
        '--template=scripts/form-judge-category-prompt.md',
        '--data=/w/d.json',
        '--results=/w/r.jsonl',
        `--out=${out}`,
      ],
      { encoding: 'utf8' },
    )
    expect(r.status).toBe(0)
    expect(read(out)).toContain('/w/r.jsonl')
  }, 30_000)

  it('throws on a placeholder it was not given', () => {
    expect(() => renderPrompt('x __NOPE__', {})).toThrow('__NOPE__')
  })
})

describe('form-judge-calibrate.yml', () => {
  it('uses the same pinned judge action and tool restrictions as the weekly workflow', () => {
    const pin = /anthropics\/claude-code-base-action@[0-9a-f]{40}/
    expect(uses(calib, pin)).toBe(uses(weekly, pin))
    for (const re of [
      /--allowedTools "[^"]*"/,
      /--disallowedTools "[^"]*"/,
      /--model [\w.-]+/,
    ])
      expect(uses(calib, re)).toBe(uses(weekly, re))
  })

  it('is least-privilege, fork-safe and path-filtered', () => {
    expect(calib).not.toMatch(/(?<!contents: )write/)
    expect(calib).toContain('persist-credentials: false')
    expect(calib).toContain('head.repo.full_name == github.repository')
    expect(calib).toContain("'scripts/form-judge-category-prompt.md'")
    expect(calib).not.toMatch(/schedule:/)
  })
})
