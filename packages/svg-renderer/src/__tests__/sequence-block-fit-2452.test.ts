/**
 * #2452: blocks, notes, dividers and nested blocks are fitted to their labels
 * (the rest of lukilabs/beautiful-mermaid#167), asserted on the layout geometry.
 */
import { describe, it, expect } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutSequenceDiagram } from '../sequence/layout.ts'

function layout(src: string) {
  return layoutSequenceDiagram(
    parseSequenceDiagram(
      ('sequenceDiagram\n' + src)
        .split('\n')
        .map((text, line) => ({ text: text.trim(), line })),
    ),
  )
}

const gap = (l: ReturnType<typeof layout>, i: number) =>
  l.actors[i + 1]!.x - l.actors[i]!.x

describe('gaps widen so labels clear the next lifeline (#2452)', () => {
  it('widens for a right note, a left note and an over note on one actor', () => {
    const text = 'a note with quite a lot of words in it'
    expect(
      gap(layout(`A->>B: x\nNote right of A: ${text}`), 0),
    ).toBeGreaterThan(200)
    expect(gap(layout(`A->>B: x\nNote left of B: ${text}`), 0)).toBeGreaterThan(
      200,
    )
    const over = layout(`A->>B: x\nB->>C: y\nNote over B: ${text} ${text}`)
    expect(gap(over, 0)).toBeGreaterThan(140)
    expect(gap(over, 1)).toBeGreaterThan(140)
  })

  it('leaves the gap alone for a note over several actors', () => {
    const l = layout(
      'A->>B: x\nNote over A,B: a note with quite a lot of words in it',
    )
    expect(gap(l, 0)).toBe(140)
  })

  it("widens for a block's header tab and divider labels", () => {
    const tab = layout(
      'A->>B: x\nloop a block title that is rather long indeed\nA->>B: y\nend',
    )
    expect(gap(tab, 0)).toBeGreaterThan(200)
    const div = layout(
      'A->>B: x\nalt ok\nA->>B: y\nelse a divider label that is rather long indeed\nA->>B: z\nend',
    )
    expect(gap(div, 0)).toBeGreaterThan(150)
    // An unlabeled divider needs no room.
    const bare = layout('A->>B: x\nalt ok\nA->>B: y\nelse\nA->>B: z\nend')
    expect(gap(bare, 0)).toBe(140)
  })

  it('ignores a highlight rect (no tab) and an empty block', () => {
    const rect = layout('A->>B: x\nrect rgb(200, 220, 255)\nA->>B: y\nend')
    expect(gap(rect, 0)).toBe(140)
    const empty = layout(
      'A->>B: x\nloop a block title that is rather long indeed\nend',
    )
    expect(empty.blocks).toHaveLength(1)
    expect(empty.blocks[0]!.height).toBeGreaterThan(0)
  })
})

describe('blocks grow to hold their contents (#2452)', () => {
  const nested = layout(`A->>B: x
alt outer
loop inner
A->>B: fetch
Note right of B: waits for the upstream response
end
else other
opt warm
B->>B: rebuild
end
Note over A,B: done
end`)
  const [loop, opt, alt] = nested.blocks as [
    (typeof nested.blocks)[number],
    (typeof nested.blocks)[number],
    (typeof nested.blocks)[number],
  ]
  const noteWaits = nested.notes[0]!
  const noteDone = nested.notes[1]!

  it('encloses a block note and nested blocks on every side', () => {
    expect(loop.x + loop.width).toBeGreaterThanOrEqual(
      noteWaits.x + noteWaits.width,
    )
    expect(loop.y + loop.height).toBeGreaterThanOrEqual(
      noteWaits.y + noteWaits.height,
    )
    expect(alt.x).toBeLessThanOrEqual(loop.x)
    expect(alt.x + alt.width).toBeGreaterThanOrEqual(loop.x + loop.width)
    expect(alt.y).toBeLessThan(loop.y)
    expect(alt.y + alt.height).toBeGreaterThan(opt.y + opt.height)
  })

  it('puts a note written after `end` below the block, inside the outer one', () => {
    expect(noteDone.y).toBeGreaterThanOrEqual(opt.y + opt.height)
    expect(alt.y + alt.height).toBeGreaterThanOrEqual(
      noteDone.y + noteDone.height,
    )
  })

  it('puts a divider above a nested block that opens right after it', () => {
    const divider = alt.dividers[0]!
    expect(divider.y).toBeLessThan(opt.y)
  })

  it('stacks the headers of blocks opening at the same message', () => {
    const l = layout('A->>B: x\nalt a\nloop b\nA->>B: y\nend\nend')
    const [inner, outer] = l.blocks as [
      (typeof l.blocks)[number],
      (typeof l.blocks)[number],
    ]
    expect(outer.y).toBeLessThan(inner.y)
  })

  it('makes a multi-line note as tall as its text', () => {
    const one = layout('A->>B: x\nNote right of B: one')
    const three = layout('A->>B: x\nNote right of B: a<br/>b<br/>c')
    expect(three.notes[0]!.height).toBeGreaterThan(one.notes[0]!.height * 2)
  })

  it('keeps a self-message loop inside its block', () => {
    const l = layout('A->>A: x\nloop l\nA->>A: y\nend')
    const msg = l.messages[1]!
    const block = l.blocks[0]!
    expect(block.y + block.height).toBeGreaterThanOrEqual(msg.y + 20)
  })

  it('places a note before the first message of a block', () => {
    const l = layout('Note over A: hi\nloop l\nA->>A: y\nend')
    expect(l.notes).toHaveLength(1)
    expect(l.blocks).toHaveLength(1)
  })
})
