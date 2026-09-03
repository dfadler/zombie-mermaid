// ============================================================================
// ASCII ER diagram: a vertical relationship's "one" (`||`) cardinality
// marker was completely invisible when it sat on the upper or lower entity.
//
// getCrowsFootChars() was written for horizontal use, where a '│'/'|' tick
// is perpendicular to the horizontal line ('─'/'-') it crosses — that reads
// correctly. The same function was reused verbatim for vertical markers,
// where a '│'/'|' tick is instead *parallel* to the vertical connecting
// line ('│'/'|'), so for "one" cardinality specifically the marker glyph
// and the line-fill glyph were identical: drawing the marker produced no
// visible change at all, not just a subtle one.
//
// The fix adds a `vertical` parameter to getCrowsFootChars, used only for
// the 'one' case, so a vertical "one" marker renders as '─'/'-' (crossing
// the vertical line) instead of '│'/'|' (blending into it). 'zero-one',
// 'many', and 'zero-many' are untouched — they already render distinctly
// on the vertical axis.
//
// Found while reviewing PR #439's vertical-relationship example.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII ER vertical "one" cardinality marker (invisible-marker fix)', () => {
  it('renders a distinct tick for the upper entity\'s "one" marker, not the invisible line glyph', () => {
    // A connects to both B (horizontal) and C (vertical, forced by the
    // 3-entity sqrt-based row layout) — the exact repro that surfaced the
    // bug. Before the fix, A's vertical "one" marker toward C rendered as
    // '│', identical to the plain connecting-line fill character, so
    // nothing distinguished "here is A's cardinality marker" from "just
    // more line".
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--o{ C : ac`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')
    const markerLineIndex = lines.findIndex((l) => l.includes('─ ac'))
    expect(markerLineIndex).toBeGreaterThanOrEqual(0)

    // The marker line must NOT contain a lone '│' marker character in the
    // same column as the '─' tick (that would be the pre-fix, invisible
    // rendering). The surrounding plain vertical line (above and below the
    // marker) stays '│' — only the marker cell itself changes to '─'.
    expect(ascii).not.toMatch(/\n {2}│ ac\n/)
    expect(ascii).toContain('─ ac')

    // The line immediately above and below the marker is still the plain
    // vertical connector, unaffected by this fix.
    const markerCol = lines[markerLineIndex]!.indexOf('─')
    expect(lines[markerLineIndex - 1]![markerCol]).toBe('│')
  })

  it('renders distinct ticks at both ends when both entities have "one" cardinality', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--|| C : ac`,
      { colorMode: 'none' },
    )
    // Two separate '─' marker ticks: one at A's lower edge, one at C's
    // upper edge, both distinct from the '│' line between them.
    const tickCount = (ascii.match(/─/g) ?? []).length
    expect(tickCount).toBeGreaterThanOrEqual(2)
    expect(ascii).toContain('─ ac')
    // A plain '│' segment must still exist between the two ticks.
    expect(ascii).toMatch(/─[\s\S]*│[\s\S]*─/)
  })

  it('renders the ASCII-mode equivalent ("-" instead of "|") for the vertical "one" marker', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--o{ C : ac`,
      { colorMode: 'none', useAscii: true },
    )
    expect(ascii).toContain('- ac')
    // The pre-fix invisible rendering used a lone '|' on the marker line.
    expect(ascii).not.toMatch(/\n {2}\| ac\n/)
  })
})
