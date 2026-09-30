/**
 * Hermetic guard for the #1151 Option B prototype
 * (scripts/ascii-pty-snapshot.sh; docs/decisions/ascii-pty-snapshot-suite-1151.md).
 * It never spawns a PTY, Docker, or agg. It only checks that the curated
 * sample list still points at the samples it names and that every listed
 * sample has both goldens, so a reordered samples-data.ts or a forgotten
 * `--update` fails here instead of as a confusing CI diff.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { samples } from '../packages/site/samples-data'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LIST = join(REPO_ROOT, 'scripts/ascii-pty-snapshot-samples.txt')
const GOLDENS = join(REPO_ROOT, '__tests__/ascii-pty-snapshots')

// Must match the slug derivation in scripts/ascii-pty-snapshot.sh.
function slugOf(index: string, title: string): string {
  return `${index}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const entries = readFileSync(LIST, 'utf8')
  .split('\n')
  .filter((line) => line !== '' && !line.startsWith('#'))
  .map((line) => {
    const [index = '', title = ''] = line.split(' :: ')
    return { index, title, slug: slugOf(index, title) }
  })

describe('ascii-pty-snapshot sample list', () => {
  it('lists a curated 10-15 samples', () => {
    expect(entries.length).toBeGreaterThanOrEqual(10)
    expect(entries.length).toBeLessThanOrEqual(15)
  })

  it.each(entries)('$index still points at "$title"', ({ index, title }) => {
    expect(samples[Number(index)]?.title).toBe(title)
  })

  it.each(entries)('$slug has a text and a png golden', ({ slug }) => {
    expect(existsSync(join(GOLDENS, `${slug}.txt`))).toBe(true)
    expect(existsSync(join(GOLDENS, `${slug}.png`))).toBe(true)
  })

  it('script --help exits 0 without touching any dependency', () => {
    const out = execFileSync(
      'bash',
      [join(REPO_ROOT, 'scripts/ascii-pty-snapshot.sh'), '--help'],
      { encoding: 'utf8' },
    )
    expect(out).toContain('PROPOSAL')
  })
})
