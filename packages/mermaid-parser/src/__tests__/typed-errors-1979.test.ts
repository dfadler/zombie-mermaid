import { describe, it, expect } from 'vitest'
import { MermaidParseError, splitStatements } from '@zombie-mermaid/core'
import {
  fixActivationBalance,
  parseArchitecture,
  parseC4Diagram,
  parseClassDiagram,
  parseErDiagram,
  parseMermaid,
  parsePieChart,
  parseSequenceDiagram,
  parseXYChart,
  toBlockType,
} from '../index.ts'

function thrown(fn: () => unknown): MermaidParseError {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(MermaidParseError)
    return e as MermaidParseError
  }
  throw new Error('expected a throw')
}

const lines = (s: string) => splitStatements(s)

// [description, thrower, diagramType, line]
const CASES: Array<[string, () => unknown, string, number | undefined]> = [
  ['flowchart: empty', () => parseMermaid(''), 'flowchart', undefined],
  [
    'flowchart: bad header',
    () => parseMermaid('graph XX\nA-->B'),
    'flowchart',
    1,
  ],
  [
    'state: unterminated note',
    () => parseMermaid('stateDiagram-v2\n  note right of A\n    hi'),
    'flowchart',
    undefined,
  ],
  [
    'architecture: bad statement',
    () => parseArchitecture(lines('architecture-beta\nbogus')),
    'architecture',
    2,
  ],
  [
    'architecture: self-nested group',
    () => parseArchitecture(lines('architecture-beta\ngroup a in b\ngroup b in a')),
    'architecture',
    undefined,
  ],
  ['c4: bad header', () => parseC4Diagram(lines('nope')), 'c4', undefined],
  [
    'c4: unknown macro',
    () => parseC4Diagram(lines('C4Context\nWat(a, "b")')),
    'c4',
    2,
  ],
  [
    'c4: unclosed boundary',
    () =>
      parseC4Diagram(lines('C4Context\nBoundary(b, "B") {\nPerson(p, "P")')),
    'c4',
    undefined,
  ],
  [
    'c4: undeclared alias',
    () => parseC4Diagram(lines('C4Context\nRel(x, y, "r")')),
    'c4',
    undefined,
  ],
  [
    'sequence: unmatched end',
    () => parseSequenceDiagram(lines('sequenceDiagram\nend')),
    'sequence',
    2,
  ],
  [
    'sequence: invalid block type',
    () => toBlockType('nope'),
    'sequence',
    undefined,
  ],
  [
    'sequence: activation fix on non-sequence',
    () => fixActivationBalance('graph TD\nA-->B'),
    'sequence',
    undefined,
  ],
  [
    'class: unclosed body',
    () => parseClassDiagram(lines('classDiagram\nclass A {')),
    'class',
    2,
  ],
  [
    'er: bad cardinality',
    () => parseErDiagram(lines('erDiagram\nA ||--zz B : x')),
    'er',
    2,
  ],
  [
    'xychart: bad value',
    () => parseXYChart(lines('xychart-beta\nbar [1, oops]')),
    'xychart',
    2,
  ],
  ['pie: negative', () => parsePieChart('pie\n"a" : -1'), 'pie', 2],
]

describe('every parser throw is a typed MermaidParseError (#1979)', () => {
  it.each(CASES)('%s', (_name, fn, diagramType, line) => {
    const err = thrown(fn)
    expect(err.diagramType).toBe(diagramType)
    expect(err.line).toBe(line)
  })
})

describe('pie column (#1979)', () => {
  it('reports the 1-based column of an unexpected token', () => {
    expect(thrown(() => parsePieChart('pie\n"a" : 1 x')).column).toBe(9)
  })

  it('reports the column of a lexer failure', () => {
    expect(thrown(() => parsePieChart('pie\n  bogus')).column).toBe(3)
  })

  it('is undefined where no token position exists', () => {
    expect(thrown(() => parsePieChart('pie\n"a" : -1')).column).toBeUndefined()
  })
})
