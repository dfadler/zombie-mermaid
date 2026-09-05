/**
 * Tests for the sequence diagram parser.
 *
 * Covers: participants, actors, messages (solid/dashed, filled/open arrows),
 * activation/deactivation, blocks (loop/alt/opt/par), notes, auto-created actors.
 */
import { describe, it, expect } from 'vitest'
import {
  parseSequenceDiagram,
  isBlockType,
  toBlockType,
} from '../sequence/parser.ts'

/** Helper to parse — preprocesses text the same way index.ts does */
function parse(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))
  return parseSequenceDiagram(lines)
}

// ============================================================================
// Actor / Participant declarations
// ============================================================================

describe('parseSequenceDiagram – actors', () => {
  it('parses participant declarations', () => {
    const d = parse(`sequenceDiagram
      participant A as Alice
      participant B as Bob
      A->>B: Hello`)
    expect(d.actors).toHaveLength(2)
    expect(d.actors[0]!.id).toBe('A')
    expect(d.actors[0]!.label).toBe('Alice')
    expect(d.actors[0]!.type).toBe('participant')
  })

  it('parses actor declarations (stick figures)', () => {
    const d = parse(`sequenceDiagram
      actor U as User
      participant S as System
      U->>S: Click`)
    expect(d.actors[0]!.type).toBe('actor')
    expect(d.actors[1]!.type).toBe('participant')
  })

  it('auto-creates participants from messages', () => {
    const d = parse(`sequenceDiagram
      Alice->>Bob: Hello`)
    expect(d.actors).toHaveLength(2)
    expect(d.actors[0]!.id).toBe('Alice')
    expect(d.actors[0]!.label).toBe('Alice')
    expect(d.actors[0]!.type).toBe('participant')
  })

  it('does not duplicate declared actors when also used in messages', () => {
    const d = parse(`sequenceDiagram
      participant A as Alice
      A->>B: Hello
      B->>A: Hi`)
    expect(d.actors).toHaveLength(2)
    expect(d.actors[0]!.label).toBe('Alice')
    expect(d.actors[1]!.id).toBe('B')
  })

  it('participant without alias uses id as label', () => {
    const d = parse(`sequenceDiagram
      participant Server
      Server->>Server: Ping`)
    expect(d.actors[0]!.label).toBe('Server')
  })
})

// ============================================================================
// Messages
// ============================================================================

describe('parseSequenceDiagram – messages', () => {
  it('parses solid arrow message: A->>B', () => {
    const d = parse(`sequenceDiagram
      A->>B: Hello`)
    expect(d.messages).toHaveLength(1)
    expect(d.messages[0]!.from).toBe('A')
    expect(d.messages[0]!.to).toBe('B')
    expect(d.messages[0]!.label).toBe('Hello')
    expect(d.messages[0]!.lineStyle).toBe('solid')
    expect(d.messages[0]!.arrowHead).toBe('filled')
  })

  it('parses dashed arrow message: A-->>B', () => {
    const d = parse(`sequenceDiagram
      A-->>B: Response`)
    expect(d.messages[0]!.lineStyle).toBe('dashed')
    expect(d.messages[0]!.arrowHead).toBe('filled')
  })

  it('parses open arrow message: A-)B', () => {
    const d = parse(`sequenceDiagram
      A-)B: Async`)
    expect(d.messages[0]!.arrowHead).toBe('open')
    expect(d.messages[0]!.lineStyle).toBe('solid')
  })

  it('parses multiple messages in order', () => {
    const d = parse(`sequenceDiagram
      A->>B: First
      B->>C: Second
      C->>A: Third`)
    expect(d.messages).toHaveLength(3)
    expect(d.messages[0]!.label).toBe('First')
    expect(d.messages[1]!.label).toBe('Second')
    expect(d.messages[2]!.label).toBe('Third')
  })

  it('parses activation marker (+)', () => {
    const d = parse(`sequenceDiagram
      A->>+B: Activate`)
    expect(d.messages[0]!.activate).toBe(true)
  })

  it('parses deactivation marker (-)', () => {
    const d = parse(`sequenceDiagram
      B-->>-A: Deactivate`)
    expect(d.messages[0]!.deactivate).toBe(true)
  })
})

// ============================================================================
// Blocks (loop, alt, opt, par)
// ============================================================================

describe('parseSequenceDiagram – blocks', () => {
  it('parses loop block', () => {
    const d = parse(`sequenceDiagram
      A->>B: Start
      loop Every 5s
        A->>B: Ping
      end
      A->>B: Done`)
    expect(d.blocks).toHaveLength(1)
    expect(d.blocks[0]!.type).toBe('loop')
    expect(d.blocks[0]!.label).toBe('Every 5s')
    expect(d.blocks[0]!.startIndex).toBe(1) // second message
  })

  it('parses alt/else block', () => {
    const d = parse(`sequenceDiagram
      A->>B: Request
      alt Success
        B->>A: 200 OK
      else Failure
        B->>A: 500 Error
      end`)
    expect(d.blocks).toHaveLength(1)
    expect(d.blocks[0]!.type).toBe('alt')
    expect(d.blocks[0]!.label).toBe('Success')
    expect(d.blocks[0]!.dividers).toHaveLength(1)
    expect(d.blocks[0]!.dividers[0]!.label).toBe('Failure')
  })

  it('parses opt block', () => {
    const d = parse(`sequenceDiagram
      opt Extra logging
        A->>Logger: Log
      end`)
    expect(d.blocks[0]!.type).toBe('opt')
  })

  it('parses par block with and dividers', () => {
    const d = parse(`sequenceDiagram
      par Task A
        A->>B: Do A
      and Task B
        A->>C: Do B
      end`)
    expect(d.blocks[0]!.type).toBe('par')
    expect(d.blocks[0]!.dividers).toHaveLength(1)
    expect(d.blocks[0]!.dividers[0]!.label).toBe('Task B')
  })
})

// ============================================================================
// Notes
// ============================================================================

describe('parseSequenceDiagram – notes', () => {
  it('parses "Note left of" note', () => {
    const d = parse(`sequenceDiagram
      A->>B: Hello
      Note left of A: Important note`)
    expect(d.notes).toHaveLength(1)
    expect(d.notes[0]!.position).toBe('left')
    expect(d.notes[0]!.actorIds).toEqual(['A'])
    expect(d.notes[0]!.text).toBe('Important note')
  })

  it('parses "Note right of" note', () => {
    const d = parse(`sequenceDiagram
      Note right of B: Side note
      A->>B: Hello`)
    expect(d.notes[0]!.position).toBe('right')
  })

  it('parses "Note over" spanning multiple actors', () => {
    const d = parse(`sequenceDiagram
      Note over A,B: Shared note
      A->>B: Hello`)
    expect(d.notes[0]!.position).toBe('over')
    expect(d.notes[0]!.actorIds).toEqual(['A', 'B'])
  })
})

// ============================================================================
// Full diagram
// ============================================================================

describe('parseSequenceDiagram – full diagram', () => {
  it('parses a complete authentication flow', () => {
    const d = parse(`sequenceDiagram
      participant C as Client
      participant S as Server
      participant DB as Database
      C->>S: POST /login
      S->>DB: SELECT user
      alt User found
        DB-->>S: User record
        S-->>C: 200 OK + token
      else Not found
        DB-->>S: null
        S-->>C: 401 Unauthorized
      end`)

    expect(d.actors).toHaveLength(3)
    expect(d.messages).toHaveLength(6)
    expect(d.blocks).toHaveLength(1)
    expect(d.blocks[0]!.type).toBe('alt')
    expect(d.blocks[0]!.dividers).toHaveLength(1)
  })
})

// ============================================================================
// isBlockType — block-keyword guard used to replace the former
// `as Block['type']` cast on the regex-captured block keyword
// ============================================================================

describe('isBlockType', () => {
  it('accepts all seven valid block keywords', () => {
    expect(isBlockType('loop')).toBe(true)
    expect(isBlockType('alt')).toBe(true)
    expect(isBlockType('opt')).toBe(true)
    expect(isBlockType('par')).toBe(true)
    expect(isBlockType('critical')).toBe(true)
    expect(isBlockType('break')).toBe(true)
    expect(isBlockType('rect')).toBe(true)
  })

  it('rejects invalid or uppercase keywords', () => {
    expect(isBlockType('LOOP')).toBe(false)
    expect(isBlockType('foo')).toBe(false)
    expect(isBlockType('')).toBe(false)
  })
})

describe('toBlockType', () => {
  it('passes through a valid keyword unchanged', () => {
    expect(toBlockType('loop')).toBe('loop')
    expect(toBlockType('critical')).toBe('critical')
  })

  it('throws on an invalid keyword', () => {
    expect(() => toBlockType('foo')).toThrow('Invalid block type: "foo"')
  })
})

// ============================================================================
// autonumber directive
// ============================================================================

describe('parseSequenceDiagram – autonumber', () => {
  it('bare autonumber numbers messages sequentially starting at 1', () => {
    const d = parse(`sequenceDiagram
      autonumber
      A->>B: First
      A->>B: Second
      A->>B: Third`)
    expect(d.messages.map((m) => m.seqNumber)).toEqual([1, 2, 3])
  })

  it('messages before autonumber are not numbered', () => {
    const d = parse(`sequenceDiagram
      A->>B: Unnumbered
      autonumber
      A->>B: Numbered`)
    expect(d.messages[0]!.seqNumber).toBeUndefined()
    expect(d.messages[1]!.seqNumber).toBe(1)
  })

  it('notes and blocks do not consume a sequence number', () => {
    const d = parse(`sequenceDiagram
      autonumber
      A->>B: First
      Note over A: a note
      loop Every 5s
        A->>B: Second
      end`)
    expect(d.messages.map((m) => m.seqNumber)).toEqual([1, 2])
  })

  it('autonumber off stops numbering, and a later bare autonumber restarts at 1', () => {
    const d = parse(`sequenceDiagram
      autonumber
      A->>B: One
      autonumber off
      A->>B: Two
      autonumber
      A->>B: Three`)
    expect(d.messages.map((m) => m.seqNumber)).toEqual([1, undefined, 1])
  })

  it('autonumber <start> <step> sets a custom starting value and increment', () => {
    const d = parse(`sequenceDiagram
      autonumber 10 5
      A->>B: One
      A->>B: Two
      A->>B: Three`)
    expect(d.messages.map((m) => m.seqNumber)).toEqual([10, 15, 20])
  })

  it('autonumber <start> alone defaults the step to 1', () => {
    const d = parse(`sequenceDiagram
      autonumber 100
      A->>B: One
      A->>B: Two`)
    expect(d.messages.map((m) => m.seqNumber)).toEqual([100, 101])
  })
})

// ============================================================================
// Bidirectional arrows
// ============================================================================

describe('parseSequenceDiagram – bidirectional arrows', () => {
  it('parses a bidirectional solid arrow: A<<->>B', () => {
    const d = parse(`sequenceDiagram
      A<<->>B: Sync call`)
    expect(d.messages[0]!.lineStyle).toBe('solid')
    expect(d.messages[0]!.arrowHead).toBe('filled')
    expect(d.messages[0]!.bidirectional).toBe(true)
  })

  it('parses a bidirectional dashed arrow: A<<-->>B', () => {
    const d = parse(`sequenceDiagram
      A<<-->>B: Async call`)
    expect(d.messages[0]!.lineStyle).toBe('dashed')
    expect(d.messages[0]!.arrowHead).toBe('filled')
    expect(d.messages[0]!.bidirectional).toBe(true)
  })

  it('a regular one-way arrow is not marked bidirectional', () => {
    const d = parse(`sequenceDiagram
      A->>B: One way`)
    expect(d.messages[0]!.bidirectional).toBeUndefined()
  })
})

// ============================================================================
// Undeclared actor names with spaces/dashes/equals
// ============================================================================

describe('parseSequenceDiagram – multi-word inline actor names', () => {
  it('parses an undeclared actor name containing a space', () => {
    const d = parse(`sequenceDiagram
      cron job->>customer-notifier: hi`)
    expect(d.messages[0]!.from).toBe('cron job')
    expect(d.messages[0]!.to).toBe('customer-notifier')
    expect(d.actors.map((a) => a.id)).toEqual(['cron job', 'customer-notifier'])
  })

  it('does not regress simple single-word actor names', () => {
    const d = parse(`sequenceDiagram
      Alice->>Bob: Hello`)
    expect(d.messages[0]!.from).toBe('Alice')
    expect(d.messages[0]!.to).toBe('Bob')
  })

  it('handles a multi-word name combined with activation markers', () => {
    const d = parse(`sequenceDiagram
      cron job->>+customer notifier: start
      customer notifier-->>-cron job: done`)
    expect(d.messages[0]!.from).toBe('cron job')
    expect(d.messages[0]!.to).toBe('customer notifier')
    expect(d.messages[0]!.activate).toBe(true)
    expect(d.messages[1]!.from).toBe('customer notifier')
    expect(d.messages[1]!.deactivate).toBe(true)
  })
})

// ============================================================================
// Issue #341 — hyphenated actor name containing an embedded arrow-like
// substring (e.g. `-x`, `-)`, `--x`, `--)`) must not be mis-split at that
// substring instead of the real arrow later in the line.
// ============================================================================

describe('parseSequenceDiagram – actor names with embedded arrow-like substrings', () => {
  it('does not mis-split on an embedded "-x" substring (issue #341 repro)', () => {
    const d = parse(`sequenceDiagram
      foo-x-bar->>baz: hi`)
    expect(d.messages[0]!.from).toBe('foo-x-bar')
    expect(d.messages[0]!.to).toBe('baz')
    expect(d.messages[0]!.label).toBe('hi')
    expect(d.actors.map((a) => a.id)).toEqual(['foo-x-bar', 'baz'])
  })

  it('does not mis-split on an embedded "-)" substring', () => {
    const d = parse(`sequenceDiagram
      foo-)bar->>baz: hi`)
    expect(d.messages[0]!.from).toBe('foo-)bar')
    expect(d.messages[0]!.to).toBe('baz')
  })

  it('does not mis-split on an embedded "--x" substring', () => {
    const d = parse(`sequenceDiagram
      foo--x-bar->>baz: hi`)
    expect(d.messages[0]!.from).toBe('foo--x-bar')
    expect(d.messages[0]!.to).toBe('baz')
  })

  it('does not mis-split on an embedded "--)" substring', () => {
    const d = parse(`sequenceDiagram
      foo--)bar->>baz: hi`)
    expect(d.messages[0]!.from).toBe('foo--)bar')
    expect(d.messages[0]!.to).toBe('baz')
  })

  it('handles the arrow-like substring at the very start of the name', () => {
    const d = parse(`sequenceDiagram
      -x-foo->>Bob: hi`)
    expect(d.messages[0]!.from).toBe('-x-foo')
    expect(d.messages[0]!.to).toBe('Bob')
  })

  it('handles the arrow-like substring at the very end of the name', () => {
    const d = parse(`sequenceDiagram
      foo-x->>Bob: hi`)
    expect(d.messages[0]!.from).toBe('foo-x')
    expect(d.messages[0]!.to).toBe('Bob')
  })

  it('handles multiple embedded arrow-like substrings in one name', () => {
    const d = parse(`sequenceDiagram
      foo-x-bar-)-baz->>qux: multi`)
    expect(d.messages[0]!.from).toBe('foo-x-bar-)-baz')
    expect(d.messages[0]!.to).toBe('qux')
  })

  it('still parses a genuinely short arrow message (no long arrow to fall back past)', () => {
    const d = parse(`sequenceDiagram
      A-)B: open arrow`)
    expect(d.messages[0]!.from).toBe('A')
    expect(d.messages[0]!.to).toBe('B')
    expect(d.messages[0]!.arrowHead).toBe('open')
  })

  it('still parses a genuine cross/lost message ("-x") with no embedded substring elsewhere', () => {
    const d = parse(`sequenceDiagram
      A-xB: lost message`)
    expect(d.messages[0]!.from).toBe('A')
    expect(d.messages[0]!.to).toBe('B')
    expect(d.messages[0]!.arrowHead).toBe('filled')
  })

  it('a legitimate arrow elsewhere in the diagram still parses correctly alongside the fix', () => {
    const d = parse(`sequenceDiagram
      foo-x-bar->>baz: hi
      baz-->>foo-x-bar: reply`)
    expect(d.messages[0]!.from).toBe('foo-x-bar')
    expect(d.messages[0]!.to).toBe('baz')
    expect(d.messages[1]!.from).toBe('baz')
    expect(d.messages[1]!.to).toBe('foo-x-bar')
    expect(d.messages[1]!.lineStyle).toBe('dashed')
  })

  it('does not regress bidirectional arrow detection', () => {
    const d = parse(`sequenceDiagram
      Alice<<->>Bob: sync`)
    expect(d.messages[0]!.from).toBe('Alice')
    expect(d.messages[0]!.to).toBe('Bob')
    expect(d.messages[0]!.bidirectional).toBe(true)
  })

  it('CodeRabbit-cited example still parses correctly (not a bug on its own)', () => {
    const d = parse(`sequenceDiagram
      customer-notifier->>Bob: ping`)
    expect(d.messages[0]!.from).toBe('customer-notifier')
    expect(d.messages[0]!.to).toBe('Bob')
  })
})

// ============================================================================
// Pre-message notes
// ============================================================================

describe('parseSequenceDiagram – pre-message notes', () => {
  it('note before first message gets afterIndex -1', () => {
    const d = parse(`sequenceDiagram
      participant A as Alice
      participant B as Bob
      Note over A: note 1
      A->>B: Hello`)
    expect(d.notes).toHaveLength(1)
    expect(d.notes[0]!.afterIndex).toBe(-1)
    expect(d.notes[0]!.text).toBe('note 1')
    expect(d.notes[0]!.position).toBe('over')
  })

  it('multiple notes before first message all get afterIndex -1', () => {
    const d = parse(`sequenceDiagram
      participant A as Alice
      participant B as Bob
      Note over A: note 1
      Note over B: note 2
      A->>B: Hello`)
    expect(d.notes).toHaveLength(2)
    expect(d.notes[0]!.afterIndex).toBe(-1)
    expect(d.notes[1]!.afterIndex).toBe(-1)
  })

  it('note in notes-only diagram (0 messages) gets afterIndex -1', () => {
    const d = parse(`sequenceDiagram
      participant A
      Note over A: lonely`)
    expect(d.notes).toHaveLength(1)
    expect(d.notes[0]!.afterIndex).toBe(-1)
    expect(d.messages).toHaveLength(0)
  })
})

// ============================================================================
// Standalone activate / deactivate (#419)
// ============================================================================

describe('parseSequenceDiagram – standalone activate/deactivate', () => {
  it('records activate/deactivate statements as events keyed to the preceding message', () => {
    const d = parse(`sequenceDiagram
      Alice->>John: Hello
      activate John
      John-->>Alice: Great!
      deactivate John`)
    expect(d.messages).toHaveLength(2)
    expect(d.activations).toEqual([
      { actorId: 'John', kind: 'start', afterIndex: 0 },
      { actorId: 'John', kind: 'end', afterIndex: 1 },
    ])
    // The standalone form leaves the shorthand flags untouched
    expect(d.messages[0]!.activate).toBeUndefined()
    expect(d.messages[1]!.deactivate).toBeUndefined()
  })

  it('an activate before any message gets afterIndex -1 and auto-creates the actor', () => {
    const d = parse(`sequenceDiagram
      activate Server
      Client->>Server: ping`)
    expect(d.activations[0]).toEqual({
      actorId: 'Server',
      kind: 'start',
      afterIndex: -1,
    })
    expect(d.actors.map((a) => a.id)).toEqual(['Server', 'Client'])
  })

  it('is not confused by an actor literally named "activate" used as a message source', () => {
    const d = parse(`sequenceDiagram
      activate->>B: hi`)
    expect(d.activations).toHaveLength(0)
    expect(d.messages[0]!.from).toBe('activate')
  })
})
