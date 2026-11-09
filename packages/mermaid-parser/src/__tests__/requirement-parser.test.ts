import { describe, expect, it } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseRequirementDiagram, requirementBodyRows } from '../index.ts'

const H = 'requirementDiagram\n'
const req = (body: string, kind = 'requirement', name = 'r') =>
  `${kind} ${name} {\n${body}\n}\n`

describe('parseRequirementDiagram', () => {
  it('parses a requirement, an element and a relationship', () => {
    const d = parseRequirementDiagram(
      H +
        req('id: 1\ntext: the test text.\nrisk: high\nverifymethod: test', 'requirement', 'test_req') +
        req('type: simulation\ndocref: a/b', 'element', 'test_entity') +
        'test_entity - satisfies -> test_req',
    )
    expect(d.nodes).toEqual([
      {
        id: 'test_req',
        kind: 'requirement',
        typeLabel: 'Requirement',
        requirementId: '1',
        text: 'the test text.',
        risk: 'High',
        verifyMethod: 'Test',
        elementType: '',
        docRef: '',
      },
      {
        id: 'test_entity',
        kind: 'element',
        typeLabel: 'Element',
        requirementId: '',
        text: '',
        risk: '',
        verifyMethod: '',
        elementType: 'simulation',
        docRef: 'a/b',
      },
    ])
    expect(d.relationships).toEqual([
      { type: 'satisfies', src: 'test_entity', dst: 'test_req' },
    ])
    expect(requirementBodyRows(d.nodes[0]!)).toEqual([
      'ID: 1',
      'Text: the test text.',
      'Risk: High',
      'Verification: Test',
    ])
    expect(requirementBodyRows(d.nodes[1]!)).toEqual([
      'Type: simulation',
      'Doc Ref: a/b',
    ])
  })

  it('knows all six kinds, case-insensitively, and lists requirements before elements', () => {
    const d = parseRequirementDiagram(
      H +
        'element e {\n}\n' +
        'FunctionalRequirement a {\n}\n' +
        'interfaceRequirement b {\n}\n' +
        'performanceRequirement c {\n}\n' +
        'physicalRequirement d {\n}\n' +
        'designConstraint f {\n}\n',
    )
    expect(d.nodes.map((n) => [n.id, n.typeLabel])).toEqual([
      ['a', 'Functional Requirement'],
      ['b', 'Interface Requirement'],
      ['c', 'Performance Requirement'],
      ['d', 'Physical Requirement'],
      ['f', 'Design Constraint'],
      ['e', 'Element'],
    ])
  })

  it('reads `<-` relationships from the other end, and every type', () => {
    const types = 'contains copies derives satisfies verifies refines traces'
    const d = parseRequirementDiagram(
      H +
        req('', 'requirement', 'a') +
        req('', 'requirement', 'b') +
        types
          .split(' ')
          .map((t) => `a - ${t} -> b\n`)
          .join('') +
        'a <- TRACES - b\n',
    )
    expect(d.relationships.map((r) => r.type)).toEqual([
      ...types.split(' '),
      'traces',
    ])
    expect(d.relationships.at(-1)).toEqual({
      type: 'traces',
      src: 'b',
      dst: 'a',
    })
  })

  it('is case-insensitive in keywords and values', () => {
    const d = parseRequirementDiagram(
      H + req('ID: 7\nTEXT: hi\nRISK: HIGH\nVERIFYMETHOD: DEMONSTRATION'),
    )
    expect(d.nodes[0]).toMatchObject({
      requirementId: '7',
      text: 'hi',
      risk: 'High',
      verifyMethod: 'Demonstration',
    })
  })

  it('accepts quoted names and values with the characters an unquoted one cannot hold', () => {
    const d = parseRequirementDiagram(
      H +
        'requirement "my-req" {\nid: "R-1"\ntext: "a, b: c - d"\n}\n' +
        'element my e {\n}\n' +
        '"my-req" - verifies -> my e',
    )
    expect(d.nodes.map((n) => n.id)).toEqual(['my-req', 'my e'])
    expect(d.nodes[0]).toMatchObject({ requirementId: 'R-1', text: 'a, b: c - d' })
    expect(d.relationships).toHaveLength(1)
  })

  it('keeps a trailing semicolon in an unquoted value, as Mermaid does', () => {
    expect(parseRequirementDiagram(H + req('id: 1;')).nodes[0]!.requirementId).toBe(
      '1;',
    )
  })

  it('rejects what Mermaid 12.3.0 rejects', () => {
    const bad: Record<string, string> = {
      'hyphen in an unquoted value': H + req('text: a-b'),
      'comma in an unquoted value': H + req('text: a, b'),
      'colon in an unquoted value': H + req('text: a: b'),
      'a non-ASCII unquoted value': H + req('id: é'),
      'unknown risk': H + req('risk: huge'),
      'a quoted risk': H + req('risk: "high"'),
      'unknown verifymethod': H + req('verifymethod: x'),
      'a body on the opening line': H + 'requirement r { id: 1 }\n',
      'an element property on a requirement': H + req('type: x'),
      'a requirement property on an element': H + req('id: 1', 'element'),
      'an unknown relationship type': H + req('', 'element', 'e') + req('') + 'e - foo -> r',
      'a relationship to an unknown name': H + req('') + 'r - satisfies -> nope',
      'a bare title': H + 'title foo\n' + req(''),
      'direction TD': H + 'direction TD\n',
      'a missing header': req(''),
      'an unclosed block': H + 'requirement r {\nid: 1\n',
      'a stray word': H + 'banana\n',
    }
    for (const [what, src] of Object.entries(bad)) {
      expect(() => parseRequirementDiagram(src), what).toThrow(
        MermaidParseError,
      )
    }
  })

  it('reports the line of an error', () => {
    try {
      parseRequirementDiagram(H + req('risk: huge'))
      expect.unreachable()
    } catch (e) {
      expect((e as MermaidParseError).message).toMatch(/^Line 3: /)
    }
  })

  it('keeps the first definition of a repeated name', () => {
    const d = parseRequirementDiagram(H + req('id: 1') + req('id: 2'))
    expect(d.nodes).toHaveLength(1)
    expect(d.nodes[0]!.requirementId).toBe('1')
  })

  it('reads direction, the last one winning', () => {
    expect(parseRequirementDiagram(H + 'direction LR\n').direction).toBe('LR')
    expect(
      parseRequirementDiagram(H + 'direction bt\ndirection RL\n').direction,
    ).toBe('RL')
    expect(parseRequirementDiagram(H).direction).toBeUndefined()
  })

  it('reads classDef, class, style and the ::: shorthand', () => {
    const d = parseRequirementDiagram(
      H +
        'classDef big fill:#ff0\n' +
        req('id: 1', 'requirement', 'a') +
        'requirement b:::big {\n}\n' +
        'element c {\n}\n' +
        'class c big\nstyle a fill:#f9f\nc:::big\n',
    )
    expect(d.classDefs.get('big')).toEqual({ fill: '#ff0' })
    expect(d.classAssignments.get('b')).toBe('big')
    expect(d.classAssignments.get('c')).toBe('big')
    expect(d.nodeStyles.get('a')).toEqual({ fill: '#f9f' })
  })

  it('skips comments, directives and accessibility statements', () => {
    const d = parseRequirementDiagram(
      '%%{init: {"theme": "dark"}}%%\n' +
        H +
        '%% a comment\n# another\naccTitle: T\naccDescr: D\naccDescr {\nmulti\n}\n' +
        req('id: 1'),
    )
    expect(d.nodes).toHaveLength(1)
  })

  it('accepts a bare header and CRLF line ends', () => {
    expect(parseRequirementDiagram('requirementDiagram').nodes).toEqual([])
    expect(
      parseRequirementDiagram('requirementDiagram\r\nrequirement r {\r\nid: 1\r\n}\r\n')
        .nodes[0]!.requirementId,
    ).toBe('1')
  })

  it('shows only the rows that are set', () => {
    const d = parseRequirementDiagram(H + req('text: only'))
    expect(requirementBodyRows(d.nodes[0]!)).toEqual(['Text: only'])
    expect(requirementBodyRows(parseRequirementDiagram(H + req('')).nodes[0]!)).toEqual(
      [],
    )
  })
})
