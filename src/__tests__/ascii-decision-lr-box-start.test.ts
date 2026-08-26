/**
 * Regression test for GitHub issue #86 — ASCII: stray ├ character on
 * flowchart decision-node edge labels (LR, Unicode).
 *
 * Repro (from the issue): a decision node with two outgoing labeled edges,
 * rendered LR with the default Unicode box-drawing charset. The box-start
 * connector for the first ("Yes") edge landed on a blank grid cell — one
 * that had no real vertical border line above or below it — and still
 * unconditionally emitted a ├ tee character there, producing a stray,
 * disconnected junction glyph instead of a plain horizontal line.
 *
 * Not reproducible in TD direction or with the ASCII charset (`useAscii:
 * true`), since ASCII mode skips box-start connectors entirely.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import { findOrphanedJunctions } from '../ascii/validate.ts'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ISSUE_86_REPRO = `flowchart LR
  A{Decision} -->|Yes| B[Do thing]
  A -->|No| C[Other thing]`

describe('issue #86: stray ├ on decision-node edge labels (LR, Unicode)', () => {
  it('does not emit an orphaned ├ where the "Yes" edge exits the decision box', () => {
    const out = renderMermaidASCII(ISSUE_86_REPRO, { colorMode: 'none' })

    const orphans = findOrphanedJunctions(out)
    expect(orphans).toEqual([])
  })

  it('places the "Yes" edge box-start exactly on the decision box\'s real right border, not drifted onto a blank cell', () => {
    // A sibling fix (issue #64 bug 5, box-start connector drift) re-anchors
    // horizontal connectors to the node's *actual* rendered border column
    // instead of a grid-centered position that a sibling label could widen.
    // Combined with this fix's validation, the "Yes" connector now lands
    // exactly on the decision box's real border — so the correct output
    // *is* a genuine ├ junction there (replacing what's a plain │ on every
    // other row of that same border column), not a stray one. The
    // structural check above (findOrphanedJunctions) is what actually
    // proves it's not orphaned; this test locks in that the junction's
    // column lines up with the box's own border on adjacent rows, which is
    // what "not drifted" means concretely.
    const out = renderMermaidASCII(ISSUE_86_REPRO, { colorMode: 'none' })
    const lines = out.split('\n')
    const yesLineIdx = lines.findIndex((l) => l.includes('Yes'))
    expect(yesLineIdx).toBeGreaterThanOrEqual(0)

    const yesRow = lines[yesLineIdx]!
    const junctionCol = yesRow.indexOf('├')
    expect(junctionCol).toBeGreaterThanOrEqual(0)

    // The same column on the rows immediately above/below must be the
    // decision box's own plain vertical border — confirming the junction
    // sits exactly on a real border line, not on a blank/drifted cell.
    expect(lines[yesLineIdx - 1]?.[junctionCol]).toBe('│')
    expect(lines[yesLineIdx + 1]?.[junctionCol]).toBe('│')
  })

  it('still renders a genuine ├ junction for a normal single-edge box-start', () => {
    // Sanity check: the fix must not turn into a false negative that
    // removes legitimate tee/junction characters where a real vertical
    // border line does exist above and below.
    const out = renderMermaidASCII(
      `flowchart LR
  A[Box A] --> B[Box B]`,
      { colorMode: 'none' },
    )
    expect(out).toContain('├')
    expect(findOrphanedJunctions(out)).toEqual([])
  })

  it('still renders a genuine ┬ junction for a TD fan-out box-start', () => {
    // Labeled edges opt out of edge bundling (see analyzeEdgeBundles'
    // canBundle check), so both edges go through the plain drawArrow /
    // drawBoxStart path exercised by this fix rather than the separate
    // fan-out bundle trunk/junction logic.
    const out = renderMermaidASCII(
      `flowchart TD
  A[Box A] -->|one| B[Box B]
  A -->|two| C[Box C]`,
      { colorMode: 'none' },
    )
    expect(out).toContain('┬')
    expect(findOrphanedJunctions(out)).toEqual([])
  })

  it('has no orphaned junctions across all Unicode golden fixtures', () => {
    const dir = join(
      dirname(fileURLToPath(import.meta.url)),
      'testdata',
      'unicode',
    )
    const files = readdirSync(dir).filter((f) => f.endsWith('.txt'))

    for (const file of files) {
      const content = readFileSync(join(dir, file), 'utf-8')
      const expected = content.split('\n---\n')[1] ?? content.split('---')[1]
      if (!expected) continue
      const orphans = findOrphanedJunctions(expected)
      expect(orphans, `orphaned junction(s) in fixture: ${file}`).toEqual([])
    }
  })
})
