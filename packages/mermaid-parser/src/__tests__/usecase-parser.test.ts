import { describe, expect, it } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseUsecase, usecaseToGraph } from '../index.ts'

const H = 'usecase-beta\n'
const p = (body: string) => parseUsecase(H + body)

describe('parseUsecase', () => {
  it('reads actors, use cases, a boundary, relationships and a note', () => {
    const d = p(
      [
        'direction TB',
        'actor A(Alice), "Big Boss"',
        'systemBoundary S(Shop)',
        '  U1',
        '  U2[Two]',
        '  actor B',
        'end',
        'A --> U1',
        'A -- hi -- U2',
        'U1 ..> : include U2',
        'U2 ..>:extend U1',
        'note for A "hello"',
      ].join('\n'),
    )
    expect(d.direction).toBe('TB')
    expect(d.actors.map((a) => [a.id, a.label, a.parentId])).toEqual([
      ['A', 'Alice', undefined],
      ['Big_Boss', 'Big Boss', undefined],
      ['B', 'B', 'S'],
    ])
    expect(d.useCases).toEqual([
      { id: 'U1', label: 'U1', shape: 'ellipse', parentId: 'S' },
      { id: 'U2', label: 'Two', shape: 'rect', parentId: 'S' },
    ])
    expect(d.boundaries).toEqual([
      { id: 'S', label: 'Shop', members: ['U1', 'U2', 'B'] },
    ])
    expect(d.relationships.map((r) => [r.type, r.arrow, r.label])).toEqual([
      ['association', 'forward', undefined],
      ['association', 'none', 'hi'],
      ['include', 'forward', undefined],
      ['extend', 'forward', undefined],
    ])
    expect(d.notes).toEqual([{ target: 'A', label: 'hello' }])
  })

  it('reads every association form', () => {
    const arrows = (s: string) => p(`A ${s} B`).relationships[0]
    expect(arrows('<-- ')).toMatchObject({ arrow: 'backward' })
    expect(arrows('<-- hi --')).toMatchObject({
      arrow: 'backward',
      label: 'hi',
    })
    expect(arrows('<-- ')).not.toHaveProperty('label')
    expect(arrows('--"a b"-->')).toMatchObject({
      arrow: 'forward',
      label: 'a b',
    })
    expect(arrows('-- x --')).toMatchObject({ arrow: 'none', label: 'x' })
    expect(arrows('----->')).toMatchObject({ arrow: 'forward' })
    expect(arrows('--|>')).toMatchObject({ type: 'generalization' })
  })

  it('lets an actor statement claim a name a relationship used first', () => {
    const d = p('A --> B\nactor B')
    expect(d.actors.map((a) => a.id)).toEqual(['B'])
    expect(d.useCases.map((u) => u.id)).toEqual(['A'])
    expect(p('actor A --> B').relationships).toHaveLength(1)
  })

  it('takes a later label, tolerates comments, front matter, CRLF and TD', () => {
    expect(p('U\nU(Label)').useCases[0]!.label).toBe('Label')
    expect(p('U(Label)\nU').useCases[0]!.label).toBe('Label')
    expect(p('U(L)\nU(L)').useCases).toHaveLength(1)
    expect(
      parseUsecase('---\ntitle: T\n---\n%% c\r\nusecase-beta\r\n%% x\r\nA\r\n')
        .useCases,
    ).toHaveLength(1)
    expect(p('direction TD').direction).toBe('TB')
    expect(
      p('accTitle: t\naccDescr: d\naccDescr {\n x\n}\nA').useCases,
    ).toHaveLength(1)
    expect(p('accDescr { one line }\nA').useCases).toHaveLength(1)
    expect(p('').useCases).toEqual([])
  })

  const bad: Array<[string, string, RegExp]> = [
    ['no header', 'A --> B', /Expected 'usecase-beta'/],
    ['header with text', 'usecase-beta A', /Expected 'usecase-beta'/],
    ['second arrow', H + 'A --> B --> C', /Unexpected/],
    ['semicolon', H + 'A --> B; C', /Expected a name|Unexpected/],
    ['comment after a statement', H + 'A %% c', /Expected a name|Unexpected/],
    ['keyword as a name', H + 'end2 --> actor', /keyword/],
    ['dangling arrow', H + 'A -->', /Expected a name/],
    ['unclosed label', H + 'A(x', /Invalid label/],
    ['empty label', H + 'A()', /Invalid label/],
    ['nested parens', H + 'A(a (b))', /Invalid label/],
    ['bracket on an actor', H + 'actor A[x]', /Unexpected '\['/],
    ['conflicting labels', H + 'U(One)\nU(Two)', /conflicting labels/],
    ['rect then ellipse', H + 'U[One]\nU(One)', /conflicting labels/],
    ['usecase then actor', H + 'B\nactor B', /both usecase and actor/],
    [
      'include on an actor',
      H + 'actor A\nA ..> : include B',
      /use-case endpoints/,
    ],
    ['mixed generalization', H + 'actor A\nB\nA --|> B', /Generalization/],
    ['stray end', H + 'end', /without a systemBoundary/],
    ['unclosed boundary', H + 'systemBoundary S\nU', /not closed/],
    [
      'nested boundary',
      H + 'systemBoundary S\nsystemBoundary T\nend\nend',
      /nested/,
    ],
    ['boundary id clash', H + 'S\nsystemBoundary S\nend', /already declared/],
    ['boundary text', H + 'systemBoundary S x\nend', /Unexpected/],
    [
      'relation in a boundary',
      H + 'systemBoundary S\nA --> B\nend',
      /Unexpected/,
    ],
    [
      'two boundaries',
      H + 'systemBoundary S\nU\nend\nsystemBoundary T\nU\nend',
      /more than one/,
    ],
    [
      'boundary name as element',
      H + 'systemBoundary S\nend\nS',
      /already a system boundary/,
    ],
    [
      'actor in boundary with arrow',
      H + 'systemBoundary S\nactor A --> B\nend',
      /Unexpected/,
    ],
    ['unknown note target', H + 'note for Z "x"', /unresolved/],
    ['bad direction', H + 'direction XX', /Expected a name|keyword/],
    ['empty actor', H + 'actor', /Expected a name/],
    ['trailing comma', H + 'actor A,', /Expected a name/],
    [
      'unsupported metadata',
      H + 'actor A@{ type: hollow }',
      /not supported yet/,
    ],
    ['unsupported stereotype', H + 'A <<x>>', /not supported yet/],
    ['unsupported class suffix', H + 'A:::c', /not supported yet/],
    ['unsupported classDef', H + 'classDef c fill:#f00', /not supported yet/],
    ['unsupported json', H + 'json J @ {"a":1}', /not supported yet/],
    ['unsupported markdown', H + 'A("`x`")', /not supported yet/],
    ['unsupported circle arrow', H + 'A --o B', /not supported yet/],
    ['unsupported edge id', H + 'A e1@--> B', /not supported yet/],
  ]
  it.each(bad)('rejects %s', (_n, src, re) => {
    expect(() => parseUsecase(src)).toThrow(re)
  })

  it('reports the line of an error', () => {
    try {
      parseUsecase(H + 'A\nB -->')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(MermaidParseError)
      expect((e as MermaidParseError).line).toBe(3)
      expect((e as MermaidParseError).diagramType).toBe('usecase')
    }
  })
})

describe('usecaseToGraph', () => {
  it('lowers elements, boundaries, notes and relationship styles', () => {
    const g = usecaseToGraph(
      p(
        [
          'direction RL',
          'actor A',
          'systemBoundary S',
          '  U[Box]',
          '  V',
          'end',
          'A <-- U',
          'A -- V',
          'U ..> : include V',
          'V --|> U',
          'A -- x --> V',
          'note for A "n"',
        ].join('\n'),
      ),
    )
    expect(g.direction).toBe('RL')
    expect([...g.nodes.values()].map((n) => [n.id, n.shape])).toEqual([
      ['A', 'usecase-actor'],
      ['U', 'usecase-rect'],
      ['V', 'usecase-ellipse'],
      ['note-0', 'usecase-note'],
    ])
    expect(g.subgraphs).toMatchObject([{ id: 'S', nodeIds: ['U', 'V'] }])
    expect(
      g.edges.map((e) => [
        e.style,
        e.hasArrowStart,
        e.hasArrowEnd,
        e.label,
        e.endMarker,
      ]),
    ).toEqual([
      ['solid', true, false, undefined, undefined],
      ['solid', false, false, undefined, undefined],
      ['dotted', false, true, '«include»', undefined],
      ['solid', false, true, undefined, 'triangle'],
      ['solid', false, true, 'x', undefined],
      ['dotted', false, false, undefined, undefined],
    ])
  })
})
