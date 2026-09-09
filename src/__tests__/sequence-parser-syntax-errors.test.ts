/**
 * Syntactic error-detection tests for the sequence diagram parser
 * (issue #762).
 *
 * The 8 pre-existing `throw` sites in `parseSequenceDiagram` all guard
 * *semantic* rules mirrored from mermaid.js (duplicate actor ids, box
 * nesting, create/destroy message mismatch — see
 * sequence-parser.test.ts/sequence-activation-check.test.ts for those). No
 * *syntactic* error was ever raised: a malformed arrow like `->>>` silently
 * absorbed the extra character into the actor name instead of being
 * rejected (verified: `Alice->>>Bob: Hello` created an actor literally
 * named `">Bob"`), an unmatched `end` was silently ignored, and an
 * `alt`/`loop`/`box` left open at EOF was silently accepted as if closed.
 * These tests assert the parser now throws an actionable error instead,
 * while confirming valid syntax — including short arrows, activation
 * shorthand, and actor names that legitimately start with "x" — is
 * unaffected.
 */
import { describe, it, expect } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'

function parse(text: string) {
  return parseSequenceDiagram(splitStatements(text))
}

describe('parseSequenceDiagram – malformed arrows', () => {
  it('throws on an extra ">" past the longest known long-arrow token', () => {
    // The issue's own verified repro: silently created an actor named
    // `">Bob"` before this pass.
    expect(() =>
      parse(`sequenceDiagram
        Alice->>>Bob: Hello`),
    ).toThrow(/Malformed sequence-diagram arrow.*"->>>"/)
  })

  it('throws on an extra ")" past a short open-arrow token', () => {
    expect(() =>
      parse(`sequenceDiagram
        Alice-))Bob: Hello`),
    ).toThrow(/Malformed sequence-diagram arrow.*"-\)\)"/)
  })

  it('throws on an extra ")" past a short dashed-open-arrow token', () => {
    expect(() =>
      parse(`sequenceDiagram
        Alice--))Bob: Hello`),
    ).toThrow(/Malformed sequence-diagram arrow/)
  })

  it('mentions the known-good arrow set in the message', () => {
    expect(() =>
      parse(`sequenceDiagram
        Alice->>>Bob: Hello`),
    ).toThrow(/->, -->, ->>, -->>, -x, --x, -\), --\)/)
  })

  it('reports the 1-based line number', () => {
    expect(() =>
      parse(`sequenceDiagram
        participant Alice
        Alice->>>Bob: Hello`),
    ).toThrow(/^Line 3:/)
  })
})

describe('parseSequenceDiagram – unmatched "end"', () => {
  it('throws on an "end" with no open block or box', () => {
    expect(() =>
      parse(`sequenceDiagram
        Alice->>Bob: Hi
        end`),
    ).toThrow(/"end" does not match any open block/)
  })
})

describe('parseSequenceDiagram – unclosed blocks/boxes at EOF', () => {
  it('throws when a loop is never closed', () => {
    expect(() =>
      parse(`sequenceDiagram
        loop Every 5s
        Alice->>Bob: Hi`),
    ).toThrow(/unclosed "loop" block/)
  })

  it('throws when an alt is never closed', () => {
    expect(() =>
      parse(`sequenceDiagram
        alt Happy path
        Alice->>Bob: Hi`),
    ).toThrow(/unclosed "alt" block/)
  })

  it('throws when a box is never closed', () => {
    expect(() =>
      parse(`sequenceDiagram
        box Group1
        participant Alice
        Alice->>Alice: Hi`),
    ).toThrow(/unclosed "box Group1"/)
  })

  it('reports the line the block opened on', () => {
    expect(() =>
      parse(`sequenceDiagram
        Alice->>Bob: Hi
        loop Every 5s
        Bob->>Alice: Pong`),
    ).toThrow(/^Line 3:/)
  })
})

describe('parseSequenceDiagram – valid syntax is unaffected', () => {
  it('still parses correct long arrows without throwing', () => {
    expect(() =>
      parse(`sequenceDiagram
        Alice->>Bob: Hi
        Bob-->>Alice: Hi back`),
    ).not.toThrow()
  })

  it('still parses activation shorthand (+/-) without throwing', () => {
    const d = parse(`sequenceDiagram
      Alice->>+Bob: Hi
      Bob-->>-Alice: Hi back`)
    expect(d.messages[0]!.activate).toBe(true)
    expect(d.messages[1]!.deactivate).toBe(true)
  })

  it('still parses short open/cross arrows without throwing', () => {
    const d = parse(`sequenceDiagram
      Alice-)Bob: fire and forget
      Bob--xAlice: lost message`)
    expect(d.messages).toHaveLength(2)
  })

  it('still parses bidirectional arrows without throwing', () => {
    expect(() =>
      parse(`sequenceDiagram
        Alice<<->>Bob: sync
        Alice<<-->>Bob: async sync`),
    ).not.toThrow()
  })

  it('does not throw for an actor name that legitimately starts with "x" after a -x arrow', () => {
    const d = parse(`sequenceDiagram
      Alice-xXavier: lost`)
    expect(d.actors.map((a) => a.id)).toContain('Xavier')
  })

  it('still parses a properly closed loop/alt/box without throwing', () => {
    expect(() =>
      parse(`sequenceDiagram
        box Group1
        participant Alice
        participant Bob
        end
        loop Every 5s
          alt Happy path
            Alice->>Bob: Hi
          else Sad path
            Alice-xBob: nope
          end
        end`),
    ).not.toThrow()
  })

  it('still closes an "end" that matches a block nested inside a box', () => {
    const d = parse(`sequenceDiagram
      box Group1
      participant Alice
      loop Every 5s
        Alice->>Alice: ping
      end
      end`)
    expect(d.blocks).toHaveLength(1)
    expect(d.boxes).toHaveLength(1)
  })
})
