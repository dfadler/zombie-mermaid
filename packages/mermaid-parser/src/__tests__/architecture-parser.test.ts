import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseArchitecture } from '../index.ts'

const parse = (src: string) => parseArchitecture(splitStatements(src))
const body = (b: string) => parse(`architecture-beta\n${b}`)

describe('parseArchitecture', () => {
  it('accepts both header spellings', () => {
    expect(parse('architecture-beta\nservice a').services).toHaveLength(1)
    expect(parse('architecture\nservice a').services).toHaveLength(1)
  })

  it('parses a group with icon, title and no parent', () => {
    expect(body('group api(cloud)[API]').groups).toEqual([
      { id: 'api', icon: 'cloud', title: 'API', parent: undefined },
    ])
  })

  it('parses nested groups, including a parent declared later', () => {
    const d = body('group inner in outer\ngroup outer')
    expect(d.groups.map((g) => [g.id, g.parent])).toEqual([
      ['inner', 'outer'],
      ['outer', undefined],
    ])
  })

  it('parses services with and without icon/title/parent', () => {
    const d = body(
      'group g\nservice a(database)[DB] in g\nservice b[Bee]\nservice c(server)\nservice d',
    )
    expect(d.services).toEqual([
      { id: 'a', icon: 'database', title: 'DB', parent: 'g' },
      { id: 'b', icon: undefined, title: 'Bee', parent: undefined },
      { id: 'c', icon: 'server', title: 'c', parent: undefined },
      { id: 'd', icon: undefined, title: 'd', parent: undefined },
    ])
  })

  it('strips quotes from custom icon names and keeps hyphenated ids', () => {
    const d = body('service my-svc("logos:aws")[AWS]')
    expect(d.services[0]).toMatchObject({ id: 'my-svc', icon: 'logos:aws' })
  })

  it('parses junctions with and without a parent', () => {
    const d = body('group g\njunction j1 in g\njunction j2')
    expect(d.junctions).toEqual([
      { id: 'j1', parent: 'g' },
      { id: 'j2', parent: undefined },
    ])
  })

  it('ignores align statements', () => {
    const d = body('service a\nservice b\nalign row a b\nalign column a b')
    expect(d.edges).toEqual([])
    expect(d.services).toHaveLength(2)
  })

  it.each([
    ['--', false, false],
    ['-->', false, true],
    ['<--', true, false],
    ['<-->', true, true],
  ])('parses the %s edge operator', (op, start, end) => {
    const [e] = body(`service a\nservice b\na:R ${op} L:b`).edges
    expect(e).toMatchObject({ arrowStart: start, arrowEnd: end })
  })

  it.each(['L', 'R', 'T', 'B'] as const)(
    'parses source port %s and target port %s',
    (p) => {
      for (const q of ['L', 'R', 'T', 'B'] as const) {
        const [e] = body(`service a\nservice b\na:${p} -- ${q}:b`).edges
        expect(e).toMatchObject({
          source: 'a',
          sourcePort: p,
          target: 'b',
          targetPort: q,
          sourceGroup: false,
          targetGroup: false,
        })
      }
    },
  )

  it('parses {group} modifiers on either end', () => {
    const d = body(
      'group g\ngroup h\nservice a in g\nservice b in h\na{group}:R -- L:b\na:R -- L:b{group}\na{group}:R -- L:b{group}',
    )
    expect(d.edges.map((e) => [e.sourceGroup, e.targetGroup])).toEqual([
      [true, false],
      [false, true],
      [true, true],
    ])
  })

  it('allows edges to junctions and {group} on a junction', () => {
    const d = body('group g\njunction j in g\nservice a\na:R -- L:j{group}')
    expect(d.edges[0]).toMatchObject({ target: 'j', targetGroup: true })
  })

  it('allows an edge to precede the declaration it refers to', () => {
    const d = body('a:R -- L:b\nservice a\nservice b')
    expect(d.edges).toHaveLength(1)
  })

  it('splits statements on semicolons and ignores comments', () => {
    const d = parse(
      'architecture-beta\n%% a comment\nservice a; service b\na:R -- L:b',
    )
    expect(d.services.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('converts <br> in titles to newlines', () => {
    const d = body('service a[Line1<br/>Line2]')
    expect(d.services[0]?.title).toBe('Line1\nLine2')
  })

  describe('errors', () => {
    it.each([
      ['service a\nservice a', /line 3.*duplicate id "a"/s],
      ['group a\nservice a', /line 3.*duplicate id "a"/s],
      ['service a\njunction a', /line 3.*duplicate id "a"/s],
      ['service a in nope', /line 2.*must name a declared group/s],
      ['service a\nservice b in a', /line 3.*must name a declared group/s],
      ['junction j in nope', /line 2.*must name a declared group/s],
      ['group g in g', /line 2.*cannot be inside itself/s],
      ['group a in b\ngroup b in c\ngroup c in a', /nested inside itself/],
      ['service a\na:R -- L:zzz', /line 3.*unknown id "zzz"/s],
      ['service a\nzzz:R -- L:a', /line 3.*unknown id "zzz"/s],
      ['group g\nservice a\na:R -- L:g', /line 4.*not the group "g"/s],
      ['group g\nservice a\ng:R -- L:a', /line 4.*not the group "g"/s],
      ['service a\nservice b\na{group}:R -- L:b', /line 4.*needs "a" to be/s],
      ['service a\nservice b\na:R -- L:b{group}', /line 4.*needs "b" to be/s],
      ['service a\nbogus line', /line 3.*unrecognized statement/s],
      ['service a\nservice b\na:X -- L:b', /line 4.*unrecognized/s],
      ['service a\nservice b\na:R - L:b', /line 4.*unrecognized/s],
      ['service a\nservice b\na R -- L:b', /line 4.*unrecognized/s],
      ['align row a', /line 2.*unrecognized/s],
      ['group', /line 2.*unrecognized/s],
    ])('rejects %j', (b, message) => {
      expect(() => body(b)).toThrow(message)
    })
  })
})
