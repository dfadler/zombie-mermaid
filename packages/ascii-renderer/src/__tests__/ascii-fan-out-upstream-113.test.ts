/**
 * Regression tests for upstream lukilabs/beautiful-mermaid#113 (fixing
 * upstream issues #111 and #112): ASCII fan-out routing.
 *
 * - #111: sibling edges from one source (TB, labelled) must share a single
 *   horizontal trunk leaving the source's right border, each label sitting on
 *   its own vertical branch, instead of later edges detouring to a lower row.
 * - #112: in an LR fan-out, a sibling edge's label widens the source's border
 *   column; the first edge's box-start connector must stay flush on the
 *   source box's real border rather than drifting right with the grid cell.
 *
 * This fork solves these through edge-bundling / draw-bundles / draw-arrows
 * rather than porting upstream's pathfinder changes; these tests pin the
 * rendered outcome, not the mechanism.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const lines = (s: string): string[] => s.split('\n').map((l) => l.trimEnd())

const TD_FANOUT = `flowchart TB
    Src["Source"]
    Left["Left Target"]
    Center["Center Target"]
    Right["Right Target"]
    Src -->|left*| Left
    Src -->|center*| Center
    Src -->|right*| Right`

const LR_FANOUT = `flowchart LR
  Src["Source"]
  Top["Top Target"]
  Mid["Middle Target"]
  Bot["Bottom Target"]
  Src -->|top*| Top
  Src -->|mid*| Mid
  Src -->|bot*| Bot`

describe('upstream #111: TB fan-out siblings share one trunk', () => {
  it('renders the shared trunk with labels on their own vertical branches (unicode)', () => {
    const out = renderMermaidASCII(TD_FANOUT, { colorMode: 'none' })
    expect(lines(out)).toEqual([
      '┌─────────────┐',
      '│             │',
      '│    Source   ├─────────────┬─────────────────────┐',
      '│             │             │                     │',
      '└──────┬──────┘          center*               right*',
      '       │                    │                     │',
      '     left*                  │                     │',
      '       │                    │                     │',
      '       │                    │                     │',
      '       ▼                    ▼                     ▼',
      '┌─────────────┐     ┌───────────────┐     ┌──────────────┐',
      '│             │     │               │     │              │',
      '│ Left Target │     │ Center Target │     │ Right Target │',
      '│             │     │               │     │              │',
      '└─────────────┘     └───────────────┘     └──────────────┘',
    ])
  })

  it('has exactly one horizontal trunk row off the source border (ASCII)', () => {
    const out = lines(
      renderMermaidASCII(TD_FANOUT, { colorMode: 'none', useAscii: true }),
    )
    // Box border rows start with '+'; only the source-border row carries a long horizontal run; the buggy
    // upstream output put a second run (the "right*" detour) on a lower row.
    const rowsWithRun = out.filter((l) => !l.startsWith('+') && /-{5,}/.test(l))
    expect(rowsWithRun).toHaveLength(1)
    expect(rowsWithRun[0]).toMatch(/^\|\s+Source\s+\+-+\+-+\+$/)
    // No label is stranded on a horizontal segment.
    expect(out.join('\n')).not.toMatch(/[-─]\/?(center|right)\*[-─]/)
  })
})

describe('upstream #112: LR fan-out box-start connector stays on the border', () => {
  it('places ├ directly under the source box right border column (unicode)', () => {
    const out = lines(renderMermaidASCII(LR_FANOUT, { colorMode: 'none' }))
    const sourceRow = out.find((l) => l.includes('Source'))!
    const borderCol = sourceRow.indexOf('├')
    expect(borderCol).toBe(out[0]!.indexOf('┐'))
    // Every row of the source box (top border down to bottom border) agrees
    // on the border column.
    expect(out[0]![borderCol]).toBe('┐')
    expect(out[4]![borderCol]).toBe('┘')
    // The connector is the border glyph itself, not preceded by a gap.
    expect(sourceRow[borderCol - 1]).toBe(' ')
    expect(sourceRow.slice(0, borderCol)).toBe('│ Source ')
  })

  it('renders the full fan-out with ├ flush on the border (unicode)', () => {
    const out = renderMermaidASCII(LR_FANOUT, { colorMode: 'none' })
    expect(lines(out).slice(0, 6)).toEqual([
      '┌────────┐      ┌───────────────┐',
      '│        │      │               │',
      '│ Source ├top*─►│   Top Target  │',
      '│        │      │               │',
      '└────┬───┘      └───────────────┘',
      '     │',
    ])
  })
})
