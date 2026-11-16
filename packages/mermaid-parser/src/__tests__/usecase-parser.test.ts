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
      'icon with a type',
      H + 'actor A@{ icon: x, type: awesome }',
      /cannot combine/,
    ],
    ['unknown metadata key', H + 'actor A@{ foo: bar }', /invalid for actor/],
    ['metadata on an undeclared name', H + 'Z@{ type: hollow }', /unresolved/],
    ['unclosed metadata', H + 'actor A@{ type: hollow', /Unclosed/],
    ['bad json', H + 'json J @ {"a": }', /Invalid JSON/],
    ['json array root', H + 'json J @ {"a": [1,', /Invalid JSON|Unclosed/],
    ['circle marker on json', H + 'A --o J\njson J @ {"a":1}', /permits only/],
    ['json twice', H + 'json J @ {"a":1}\njson J @ {"a":2}', /more than once/],
    [
      'json too deep',
      H + 'json J @ ' + '{"a":'.repeat(120) + '1' + '}'.repeat(120),
      /deeply/,
    ],
    ['json bad escape', H + 'json J @ {"a": "\\q"}', /Invalid JSON/],
    ['json trailing text', H + 'json J @ {"a":1} x', /Unexpected/],
    ['class on an undeclared endpoint', H + 'A:::c --> B', /without being/],
    ['classDef without styles', H + 'classDef c', /keyword/],
    ['class with no name', H + 'A\nclass A', /keyword/],
    ['class for an undeclared node', H + 'class Z c', /not declared/],
    [
      'metadata type on a use case',
      H + 'A\nA@{ type: hollow }',
      /invalid for usecase/,
    ],
  ]
  it.each(bad)('rejects %s', (_n, src, re) => {
    expect(() => parseUsecase(src)).toThrow(re)
  })

  it('reads markers, edge ids, stereotypes, classes and styles', () => {
    const arrows = (s: string) => p(`A ${s} B`).relationships[0]!.arrow
    expect(arrows('--o')).toBe('circleEnd')
    expect(arrows('--x')).toBe('crossEnd')
    expect(arrows('o--')).toBe('circleStart')
    expect(arrows('x--')).toBe('crossStart')
    expect(arrows('-- hi --x')).toBe('crossEnd')
    const d = p(
      [
        'classDef foo fill:#f00,stroke:#333',
        'actor A(Alice) <<sys>>:::foo',
        'U:::foo',
        'U(Do) <<ui>>',
        'style U stroke:#0f0',
        'class A foo',
        'A e1@--> U',
        'e1@{ animate: true, animation: fast }',
        'M("`**bold**`") --> U',
      ].join('\n'),
    )
    expect(d.classDefs).toEqual([
      { id: 'foo', styles: ['fill:#f00', 'stroke:#333'] },
    ])
    expect(d.useCases.find((u) => u.id === 'M')!.label).toBe('**bold**')
    expect(d.actors[0]).toMatchObject({
      label: 'Alice',
      stereotype: 'sys',
      classes: ['foo'],
    })
    expect(d.useCases.find((u) => u.id === 'U')).toMatchObject({
      label: 'Do',
      stereotype: 'ui',
      classes: ['foo'],
      styles: ['stroke:#0f0'],
    })
    expect(d.relationships[0]).toMatchObject({
      id: 'e1',
      animate: true,
      animation: 'fast',
    })
  })

  it('lowers them to the flowchart model', () => {
    const g = usecaseToGraph(
      p(
        'classDef foo fill:#f00\nactor A <<s>>:::foo\nU\nstyle U stroke:#0f0\nA e1@--o U\nU x-- A\ne1@{ animate: true }\nA --> U',
      ),
    )
    expect(g.nodes.get('A')!.label).toBe('«s»\nA')
    expect(g.classDefs.get('foo')).toEqual({ fill: '#f00' })
    expect(g.classAssignments.get('A')).toBe('foo')
    expect(g.nodeStyles.get('U')).toEqual({ stroke: '#0f0' })
    expect(g.edges[0]).toMatchObject({
      id: 'e1',
      animate: true,
      hasArrowEnd: true,
      endMarker: 'circle',
    })
    expect(g.edges[1]).toMatchObject({
      hasArrowStart: true,
      startMarker: 'cross',
    })
    expect(g.edges[2]).not.toHaveProperty('animate')
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

  it('reads node metadata, package boundaries and json tables', () => {
    const d = p(
      'actor A@{ type: hollow, business: true }\nactor B@{ icon: user }\nU\nU@{ business: true }\n' +
        'systemBoundary S@{ type: package }\nV\nend\n' +
        'json J @ {"x": [1, 2], "y": {"z": null}, "e": {}, "n": [{"k": 1}]} :::c\nA --> J',
    )
    expect(d.actors[0]).toMatchObject({ type: 'hollow', business: true })
    expect(d.actors[1]).toMatchObject({ type: 'icon', icon: 'user' })
    expect(d.useCases[0]!.business).toBe(true)
    expect(d.boundaries[0]!.type).toBe('package')
    expect(d.jsonNodes[0]).toEqual({
      id: 'J',
      classes: ['c'],
      rows: [
        { key: 'x', value: '1' },
        { key: '', value: '2' },
        { key: 'y.z', value: 'null' },
        { key: 'e', value: '{}' },
        { key: 'n[0].k', value: '1' },
      ],
    })
  })

  it('keeps json key order and takes the last of a repeated key', () => {
    const rows = p('json J @ {"b":1,"2":2,"a":3,"b":4}').jsonNodes[0]!.rows
    expect(rows.map((r) => r.key)).toEqual(['2', 'a', 'b'])
    expect(rows[2]!.value).toBe('4')
  })
})
