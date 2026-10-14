/**
 * #1973: `participant X@{ "type": "database" }` (mermaid 12). The config is
 * parsed and the type kept on the actor; the shape is not drawn. A config
 * that is not `@{ ... }` on a declaration is a precise parse error, not the
 * old misleading `unclosed "par"` (the `par` keyword matched `participant`).
 */
import { describe, it, expect } from 'vitest'
import { MermaidParseError, splitStatements } from '@zombie-mermaid/core'
import { parseSequenceDiagram } from '../index.ts'

const parse = (body: string) =>
  parseSequenceDiagram(splitStatements(`sequenceDiagram\n${body}`))

describe('participant @{ config }', () => {
  it.each([
    ['participant A@{ "type": "database" }'],
    ['participant A @{ "type" : "database" }'],
    ['participant A@{ type: database }'],
    ["participant A@{ 'type': 'DATABASE' }"],
  ])('parses %s', (decl) => {
    const d = parse(`${decl}\nA->>A: hi`)
    expect(d.actors).toEqual([
      { id: 'A', label: 'A', type: 'participant', participantType: 'database' },
    ])
    expect(d.messages).toHaveLength(1)
  })

  it('handles actor, hyphenated ids, `as` labels, alias key and create', () => {
    const d = parse(
      [
        'actor U@{ "type": "boundary" } as User',
        'participant my-svc@{ "type": "queue" }',
        'participant C@{ "type": "control", "alias": "Ctl" }',
        'create participant N@{ "type": "entity" } as New',
        'U->>N: go',
      ].join('\n'),
    )
    expect(
      d.actors.map((a) => [a.id, a.label, a.type, a.participantType]),
    ).toEqual([
      ['U', 'User', 'actor', 'boundary'],
      ['my-svc', 'my-svc', 'participant', 'queue'],
      ['C', 'Ctl', 'participant', 'control'],
      ['N', 'New', 'participant', 'entity'],
    ])
  })

  it('treats an unknown type as a plain participant, like mermaid 12.1', () => {
    const d = parse('participant A@{ "type": "bogus" }\nA->>A: hi')
    expect(d.actors[0]).toEqual({ id: 'A', label: 'A', type: 'participant' })
  })

  it('names the construct and line for a malformed config', () => {
    for (const bad of ['participant A@{ "type": "database"']) {
      let err: unknown
      try {
        parse(`participant B\n${bad}\nB->>B: hi`)
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(MermaidParseError)
      expect((err as Error).message).toMatch(
        /Line 3: .*malformed participant config/,
      )
      expect((err as Error).message).not.toMatch(/par"/)
    }
  })

  it('leaves ids containing @ untouched', () => {
    const d = parse('participant a@b\na@b->>a@b: hi')
    expect(d.actors[0]).toEqual({
      id: 'a@b',
      label: 'a@b',
      type: 'participant',
    })
  })
})
