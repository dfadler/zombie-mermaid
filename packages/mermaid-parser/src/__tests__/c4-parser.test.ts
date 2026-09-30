import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseC4Diagram } from '../index.ts'

const parse = (src: string) => parseC4Diagram(splitStatements(src))

describe('parseC4Diagram', () => {
  it('parses every variant header', () => {
    const cases = [
      ['C4Context', 'context'],
      ['C4Container', 'container'],
      ['C4Component', 'component'],
      ['C4Dynamic', 'dynamic'],
      ['C4Deployment', 'deployment'],
    ] as const
    for (const [header, variant] of cases) {
      expect(parse(header).variant).toBe(variant)
    }
  })

  it('rejects a non-C4 header', () => {
    expect(() => parse('flowchart TD')).toThrow(
      /expected a header of C4Context/,
    )
  })

  it('parses persons, systems and external variants', () => {
    const d = parse(`C4Context
  title Bank
  Person(c, "Customer", "A user")
  Person_Ext(x, "Auditor")
  System(s, "Banking", "Core")
  SystemDb_Ext(db, "Ledger", "Books")
  SystemQueue(q, "Bus")`)
    expect(d.title).toBe('Bank')
    expect(
      d.elements.map((e) => [e.alias, e.kind, e.shape, e.external]),
    ).toEqual([
      ['c', 'person', 'default', false],
      ['x', 'person', 'default', true],
      ['s', 'system', 'default', false],
      ['db', 'system', 'db', true],
      ['q', 'system', 'queue', false],
    ])
    expect(d.elements[0]).toMatchObject({
      label: 'Customer',
      description: 'A user',
    })
  })

  it('reads technology before description for containers and components', () => {
    const d = parse(`C4Container
  Container(api, "API", "Node.js", "Serves JSON")
  ComponentDb(store, "Store", "Postgres")`)
    expect(d.elements[0]).toMatchObject({
      technology: 'Node.js',
      description: 'Serves JSON',
    })
    expect(d.elements[1]).toMatchObject({
      kind: 'component',
      shape: 'db',
      technology: 'Postgres',
    })
    expect(d.elements[1]!.description).toBeUndefined()
  })

  it('keeps commas and parentheses inside quoted arguments', () => {
    const d = parse('C4Context\nSystem(s, "A, B (C)", "one, two")')
    expect(d.elements[0]).toMatchObject({
      label: 'A, B (C)',
      description: 'one, two',
    })
  })

  it('drops $named arguments', () => {
    const d = parse(
      'C4Context\nSystem(s, "S", "d", $tags="t", $link="https://x.test")',
    )
    expect(d.elements[0]).toMatchObject({ label: 'S', description: 'd' })
  })

  it('nests boundaries and assigns elements to the innermost one', () => {
    const d = parse(`C4Container
  Enterprise_Boundary(e, "Corp") {
    System_Boundary(sb, "Sys") {
      Container(a, "A", "Go")
    }
    Person(p, "P")
  }
  Container(out, "Out", "Go")`)
    expect(d.boundaries).toHaveLength(1)
    const e = d.boundaries[0]!
    expect(e.elementAliases).toEqual(['p'])
    expect(e.children[0]).toMatchObject({ alias: 'sb', elementAliases: ['a'] })
    expect(d.elements.map((x) => x.alias)).toEqual(['a', 'p', 'out'])
  })

  it('accepts a brace on its own line and a boundary type', () => {
    const d = parse(`C4Context
  Boundary(b, "B", "region")
  {
    System(s, "S")
  }`)
    expect(d.boundaries[0]).toMatchObject({
      alias: 'b',
      type: 'region',
      elementAliases: ['s'],
    })
  })

  it('parses deployment nodes as boundaries with type and description', () => {
    const d = parse(`C4Deployment
  Deployment_Node(n, "Server", "Ubuntu", "Prod box") {
    Container(app, "App", "Java")
  }`)
    expect(d.boundaries[0]).toMatchObject({
      type: 'Ubuntu',
      description: 'Prod box',
      elementAliases: ['app'],
    })
  })

  it('parses relationships, BiRel, directional variants and RelIndex', () => {
    const d = parse(`C4Dynamic
  System(a, "A")
  System(b, "B")
  Rel(a, b, "Calls", "HTTPS")
  BiRel(a, b, "Syncs")
  Rel_Back(b, a, "Replies")
  RelIndex(1, a, b, "First")`)
    expect(d.relationships).toEqual([
      {
        from: 'a',
        to: 'b',
        label: 'Calls',
        technology: 'HTTPS',
        bidirectional: false,
      },
      { from: 'a', to: 'b', label: 'Syncs', bidirectional: true },
      {
        from: 'b',
        to: 'a',
        label: 'Replies',
        bidirectional: false,
        reversed: true,
      },
      { from: 'a', to: 'b', label: 'First', bidirectional: false, index: '1' },
    ])
  })

  it('records Rel_U/D/L/R placement hints and leaves the rest unhinted', () => {
    const d = parse(`C4Context
  System(a, "A")
  System(b, "B")
  Rel_U(a, b, "1")
  Rel_Up(a, b, "2")
  Rel_D(a, b, "3")
  Rel_Down(a, b, "4")
  Rel_L(a, b, "5")
  Rel_Left(a, b, "6")
  Rel_R(a, b, "7")
  Rel_Right(a, b, "8")
  Rel(a, b, "9")
  Rel_Back(a, b, "10")`)
    expect(d.relationships.map((r) => r.layout)).toEqual([
      'up',
      'up',
      'down',
      'down',
      'left',
      'left',
      'right',
      'right',
      undefined,
      undefined,
    ])
  })

  it('silently ignores style and layout macros', () => {
    const d = parse(`C4Context
  System(a, "A")
  UpdateElementStyle(a, $bgColor="red")
  UpdateLayoutConfig($c4ShapeInRow="2")
  SHOW_LEGEND()`)
    expect(d.elements).toHaveLength(1)
  })

  describe('errors', () => {
    it('reports duplicate aliases with a line number', () => {
      expect(() => parse('C4Context\nSystem(a, "A")\nSystem(a, "B")')).toThrow(
        /line 3: duplicate alias "a"/,
      )
    })
    it('reports unknown macros', () => {
      expect(() => parse('C4Context\nWidget(a, "A")')).toThrow(
        /unknown C4 macro "Widget"/,
      )
    })
    it('reports unrecognized statements', () => {
      expect(() => parse('C4Context\nnonsense here')).toThrow(
        /unrecognized statement/,
      )
    })
    it('reports relationships to undeclared aliases', () => {
      expect(() =>
        parse('C4Context\nSystem(a, "A")\nRel(a, ghost, "x")'),
      ).toThrow(/undeclared alias "ghost"/)
    })
    it('reports unbalanced braces', () => {
      expect(() =>
        parse('C4Context\nBoundary(b, "B") {\nSystem(a, "A")'),
      ).toThrow(/missing its closing/)
      expect(() => parse('C4Context\n}')).toThrow(/unmatched "}"/)
    })
    it('reports unbalanced quotes', () => {
      expect(() => parse('C4Context\nSystem(a, "A)')).toThrow(
        /unbalanced quotes/,
      )
    })
  })
})
