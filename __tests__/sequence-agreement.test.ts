import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  parseOfficialSequence,
  parseOurSequence,
  sequenceAgreement,
  sequenceBreaches,
  summarizeSequence,
  worstSeq,
  type SeqLayout,
} from '../scripts/lib/sequence-agreement.ts'
import {
  scorecardMarkdown,
  summarize,
  type SampleResult,
} from '../scripts/lib/layout-agreement.ts'

// Trimmed from mermaid 12.2.0's render of `A->>B: Hello` and `A->>A: think`.
const OFFICIAL = `<svg>
<line id="actor1" x1="275" y1="74" x2="275" y2="311" class="actor-line 200" name="B" data-et="life-line" data-id="B"></line>
<line id="actor0" x1="75" y1="74" x2="75" y2="311" class="actor-line 200" name="A" data-et="life-line" data-id="A"></line>
<line x1="76" y1="120" x2="268" y2="120" class="messageLine0" data-et="message" data-id="i0" data-from="A" data-to="B"></line>
<path d="M 76,212 C 136,202 136,242 76,232" class="messageLine0" data-et="message" data-id="i1" data-from="A" data-to="A"></path>
</svg>`

const SRC = `sequenceDiagram
  participant A as Alice
  B->>A: first
  A->>A: second
  A->>B: third`

describe('sequence agreement (#1686)', () => {
  it('reads participants and messages from official mermaid', () => {
    expect(parseOfficialSequence(OFFICIAL)).toEqual({
      actors: { A: 75, B: 275 },
      messages: [
        { from: 'A', to: 'B', y: 120 },
        { from: 'A', to: 'A', y: 212 },
      ],
    })
  })

  it('reads participants, messages and a self-message from our SVG', () => {
    const l = parseOurSequence(renderMermaidSVG(SRC))
    expect(Object.keys(l.actors).sort()).toEqual(['A', 'B'])
    expect(l.actors.A).toBeLessThan(l.actors.B!)
    expect(l.messages.map((m) => `${m.from}>${m.to}`)).toEqual([
      'B>A',
      'A>A',
      'A>B',
    ])
    expect(l.messages[0]!.y).toBeLessThan(l.messages[1]!.y)
  })

  const same: SeqLayout = parseOfficialSequence(OFFICIAL)

  it('is 100% against itself', () => {
    expect(sequenceAgreement(same, same)).toEqual({
      participants: 1,
      messages: 1,
      direction: 1,
      actors: 2,
      msgs: 2,
    })
  })

  it('catches swapped participants, reordered messages and flipped direction', () => {
    const swapped = sequenceAgreement(same, {
      actors: { A: 275, B: 75 },
      messages: same.messages,
    })
    expect(swapped.participants).toBe(0)
    expect(swapped.direction).toBe(0.5) // The self-message still agrees.

    const reordered = sequenceAgreement(same, {
      actors: same.actors,
      messages: [...same.messages]
        .reverse()
        .map((m, i) => ({ ...m, y: 9 - i })),
    })
    expect(reordered.messages).toBe(0)
  })

  it('counts a missing participant or message as disagreement', () => {
    const a = sequenceAgreement(same, { actors: { A: 1 }, messages: [] })
    expect(a).toMatchObject({ participants: 0, messages: 0, direction: 0 })
  })

  it('has no figure with nothing to compare', () => {
    const lone = sequenceAgreement(
      { actors: { A: 1 }, messages: [] },
      { actors: { A: 1 }, messages: [] },
    )
    expect(lone).toMatchObject({
      participants: null,
      messages: null,
      direction: null,
    })
    expect(worstSeq(lone)).toBeNull()
  })

  it('gates samples on the floor and on errors', () => {
    const ok = sequenceAgreement(same, same)
    const bad = sequenceAgreement(same, { actors: {}, messages: [] })
    expect(sequenceBreaches({ ok })).toEqual([])
    expect(sequenceBreaches({ ok, bad }, ['boom'])).toEqual([
      'boom (error)',
      'bad (0% < 100%)',
    ])
  })

  it('shows the sequence section in the scorecard only with entries', () => {
    const entry = summarizeSequence(
      { a: sequenceAgreement(same, same) },
      { date: '2026-10-30', commit: 'abcdef0123', mermaid: '12.2.0' },
    )
    expect(entry).toMatchObject({ kind: 'sequence', samples: 1, messages: 1 })
    const results: Record<string, SampleResult> = {}
    const run = {
      results,
      entry: summarize(results, {
        date: 'd',
        commit: 'c',
        tolerance: 20,
        type: 'flowchart',
        mermaid: '12.2.0',
      }),
    }
    const md = scorecardMarkdown([run], [run.entry], undefined, [], [entry])
    expect(md).toContain('## Sequence diagrams (order)')
    expect(md).toContain(
      '| 2026-10-30 | abcdef0 | 12.2.0 | 1 | 100% | 100% | 100% |',
    )
    expect(scorecardMarkdown([run], [run.entry])).not.toContain(
      'Sequence diagrams',
    )
  })
})
