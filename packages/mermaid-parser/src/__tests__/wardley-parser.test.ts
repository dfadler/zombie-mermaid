/**
 * Wardley parser (#2820): the model, and which sources mermaid 12.3.0 accepts.
 * The accept/reject table was recorded from mermaid 12.3.0's own render of each
 * source (mermaid.render succeeds or throws); the drawing is checked by
 * __tests__/wardley-agreement.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseWardley } from '../wardley/parser.ts'

const H = 'wardley-beta\n'

// [name, source, accepted by mermaid 12.3.0]
const ACCEPTED: Array<[string, string, boolean]> = [
  ['not the header', 'wardley\ncomponent A [0.5,0.5]', false],
  ['integer coordinates', H + 'component A [50, 50]', false],
  ['no leading zero', H + 'component A [.5, .5]', false],
  ['above 100', H + 'component A [150.0, 0.5]', false],
  ['1.5 is 1.5%', H + 'component A [1.5, 0.5]', true],
  ['decimal size', H + 'size [900.5, 600]', false],
  ['size', H + 'size [900, 600]', true],
  ['one stage', H + 'evolution Solo', false],
  ['integer boundary', H + 'evolution A@1 -> B@2', false],
  ['pipeline without parent', H + 'pipeline X {\ncomponent A [0.5]\n}', false],
  ['empty pipeline', H + 'component X [0.5,0.5]\npipeline X {\n}', false],
  [
    'pipeline on one line',
    H + 'component X [0.5,0.5]\npipeline X { component A [0.5] }',
    false,
  ],
  [
    'unclosed pipeline',
    H + 'component X [0.5,0.5]\npipeline X {\ncomponent A [0.5]',
    false,
  ],
  [
    'pipeline component with visibility',
    H + 'component X [0.5,0.5]\npipeline X {\ncomponent A [0.5, 0.5]\n}',
    false,
  ],
  [
    'link without arrow or port',
    H + 'component A [0.5,0.5]\ncomponent B [0.2,0.2]\nA B',
    false,
  ],
  [
    'link without spaces',
    H + 'component A [0.5,0.5]\ncomponent B [0.2,0.2]\nA->B',
    true,
  ],
  [
    'link port after the target',
    H + 'component A [0.5,0.5]\ncomponent B [0.2,0.2]\nA -> B +>',
    true,
  ],
  [
    'empty link label',
    H + 'component A [0.5,0.5]\ncomponent B [0.2,0.2]\nA -> B;',
    false,
  ],
  [
    'two statements on a line',
    H + 'component A [0.5,0.5] component B [0.2,0.2]',
    false,
  ],
  ['trailing words', H + 'component A [0.5,0.5] nonsense', false],
  ['signed label offset', H + 'component A [0.5,0.5] label [+5, 5]', false],
  ['decimal label offset', H + 'component A [0.5,0.5] label [5.5, 5]', false],
  ['spaced minus', H + 'component A [0.5,0.5] label [- 5, - 5]', true],
  ['unknown strategy', H + 'component A [0.5,0.5] (rent)', false],
  ['inertia before strategy', H + 'component A [0.5,0.5] inertia (buy)', false],
  ['title', H + 'title Hello', true],
  ['upper case title', H + 'TITLE Hello', false],
  ['integer evolve target', H + 'component A [0.5,0.5]\nevolve A 1', false],
  ['unquoted note', H + 'note hello [0.5, 0.5]', false],
  ['annotation without comma', H + 'annotation 1 [0.5, 0.5] "x"', false],
  ['decimal annotation number', H + 'annotation 1.5,[0.5, 0.5] "x"', false],
  ['unquoted annotation text', H + 'annotation 1,[0.5, 0.5] x', false],
  ['keyword as a name', H + 'component component [0.5,0.5]', false],
  ['name starting like a keyword', H + 'anchor Anchored [0.5,0.5]', true],
  ['hyphen in a name', H + 'component Foo-Bar [0.5,0.5]', true],
  ['dot in a name', H + 'component Foo.Bar [0.5,0.5]', false],
  ['digit-led word after a space', H + 'component Foo 2 [0.5,0.5]', false],
  ['tabs', H + '\tcomponent\tA\t[0.5,\t0.5]', true],
  ['CRLF', H.replace('\n', '\r\n') + 'component A [0.5,0.5]', true],
  ['comment on the header', 'wardley-beta %% c\ncomponent A [0.5,0.5]', true],
  ['title on the header line', 'wardley-beta title X', true],
  ['colon after the header', 'wardley-beta:\ncomponent A [0.5,0.5]', false],
  [
    'evolve before its component',
    H + 'evolve A 0.9\ncomponent A [0.5,0.5]',
    true,
  ],
  ['accDescr block', H + 'accDescr {\nhello\n}\ncomponent A [0.5,0.5]', true],
  ['accTitle', H + 'accTitle: T\ncomponent A [0.5,0.5]', true],
  ['repeated size', H + 'size [100,100]\nsize [200,200]', true],
]

describe('parseWardley accepts what mermaid 12.3.0 accepts', () => {
  for (const [name, source, ok] of ACCEPTED) {
    it(`${ok ? 'accepts' : 'rejects'}: ${name}`, () => {
      if (ok) expect(() => parseWardley(source)).not.toThrow()
      else expect(() => parseWardley(source)).toThrow(MermaidParseError)
    })
  }
})

describe('parseWardley model', () => {
  const map = parseWardley(`wardley-beta
  title Tea & Biscuits
  size [800, 500]
  evolution A@0.2 -> B@0.6 / C -> D@1.0
  anchor Me [0.9, 0.5]
  component Cup [0.7, 0.4] label [-20, 5] (buy) inertia
  component Tea [0.5, 0.6]
  Me -> Cup
  Cup +> Tea; hot
  Cup -.-> Tea
  Tea +'pour'<> Cup
  evolve Tea 0.9
  note "Remember" [0.3, 0.3]
  annotations [0.1, 0.9]
  annotation 2,[0.5, 0.5] "Second"
  accelerator Fast [0.4, 0.4]
  deaccelerator Slow [0.6, 0.6]`)

  it('reads the header-level settings', () => {
    expect(map.title).toBe('Tea & Biscuits')
    expect(map.size).toEqual({ width: 800, height: 500 })
    expect(map.stages).toEqual(['A', 'B / C', 'D'])
    expect(map.stageBoundaries).toEqual([0.2, 0.6, 1])
  })

  it('turns fractions into percentages, x being evolution and y visibility', () => {
    expect(map.nodes.map((n) => [n.id, n.kind, n.x, n.y])).toEqual([
      ['Me', 'anchor', 50, 90],
      ['Cup', 'component', 40, 70],
      ['Tea', 'component', 60, 50],
    ])
    const cup = map.nodes[1]!
    expect(cup).toMatchObject({
      labelOffsetX: -20,
      labelOffsetY: 5,
      strategy: 'buy',
      inertia: true,
    })
  })

  it('reads links, flows and labels', () => {
    expect(map.links).toEqual([
      { source: 'Me', target: 'Cup', dashed: false },
      {
        source: 'Cup',
        target: 'Tea',
        dashed: false,
        flow: 'forward',
        label: 'hot',
      },
      { source: 'Cup', target: 'Tea', dashed: true },
      {
        source: 'Tea',
        target: 'Cup',
        dashed: false,
        flow: 'bidirectional',
        label: 'pour',
      },
    ])
  })

  it('reads trends, notes, annotations and arrows', () => {
    expect(map.trends).toEqual([{ nodeId: 'Tea', targetX: 90, targetY: 50 }])
    expect(map.notes).toEqual([{ text: 'Remember', x: 30, y: 30 }])
    expect(map.annotationsBox).toEqual({ x: 90, y: 10 })
    expect(map.annotations).toEqual([
      { number: 2, x: 50, y: 50, text: 'Second' },
    ])
    expect(map.accelerators).toEqual([{ name: 'Fast', x: 40, y: 40 }])
    expect(map.deaccelerators).toEqual([{ name: 'Slow', x: 60, y: 60 }])
  })
})

describe('parseWardley database rules', () => {
  it('fills nodes anchors first, then components, whatever the source order', () => {
    const map = parseWardley(H + 'component B [0.1, 0.1]\nanchor A [0.2, 0.2]')
    expect(map.nodes.map((n) => n.id)).toEqual(['A', 'B'])
  })

  it('lets a later component replace an anchor and an earlier component, keeping the label offset', () => {
    const map = parseWardley(
      H +
        'component A [0.2, 0.2] label [5, 6] inertia\ncomponent A [0.7, 0.7]\nanchor A [0.5, 0.5]',
    )
    expect(map.nodes).toEqual([
      {
        id: 'A',
        label: 'A',
        x: 70,
        y: 70,
        kind: 'component',
        labelOffsetX: 5,
        labelOffsetY: 6,
      },
    ])
  })

  it('moves a pipeline component onto its parent’s row and ids it by parent', () => {
    const map = parseWardley(
      H +
        'component P [0.5, 0.3]\npipeline P {\n  component One [0.2] label [-3, 4]\n  component Two [0.8]\n}',
    )
    expect(map.nodes.map((n) => [n.id, n.kind, n.x, n.y])).toEqual([
      ['P', 'component', 30, 50],
      ['P_One', 'pipeline-component', 20, 50],
      ['P_Two', 'pipeline-component', 80, 50],
    ])
    expect(map.nodes[0]!.isPipelineParent).toBe(true)
    expect(map.nodes[1]).toMatchObject({
      label: 'One',
      labelOffsetX: -3,
      labelOffsetY: 4,
    })
    expect(map.pipelines).toEqual([
      { nodeId: 'P', componentIds: ['P_One', 'P_Two'] },
    ])
  })

  it('resolves a link to a node by its label and keeps unknown names as written', () => {
    const map = parseWardley(
      H + 'component A [0.5, 0.5]\nA -> Nowhere\n"Nowhere" -> A',
    )
    expect(map.links.map((l) => [l.source, l.target])).toEqual([
      ['A', 'Nowhere'],
      ['Nowhere', 'A'],
    ])
    const pipe = parseWardley(
      H +
        'component P [0.5, 0.5]\npipeline P {\n component One [0.2]\n}\nP -> One',
    )
    expect(pipe.links[0]).toMatchObject({ source: 'P', target: 'P_One' })
  })

  it('keeps one trend per node, at the first one’s place with the last target', () => {
    const map = parseWardley(
      H +
        'component A [0.2, 0.5]\ncomponent B [0.4, 0.5]\nevolve A 0.7\nevolve B 0.8\nevolve A 0.9\nevolve Nope 0.5',
    )
    expect(map.trends).toEqual([
      { nodeId: 'A', targetX: 90, targetY: 20 },
      { nodeId: 'B', targetX: 80, targetY: 40 },
    ])
  })

  it('takes the arrow’s own flow and label when there is no port', () => {
    const map = parseWardley(
      H +
        "component A [0.5, 0.5]\ncomponent B [0.2, 0.2]\nA +'x'< B\nA +'y'> B ; ignored\nA +<> B +>\nA -> B +<",
    )
    expect(map.links.map((l) => [l.flow, l.label])).toEqual([
      ['backward', 'x'],
      ['forward', 'y'],
      ['bidirectional', undefined],
      ['backward', undefined],
    ])
  })

  it('names the line and the problem in errors', () => {
    expect(() => parseWardley(H + 'component A [0.5, 0.5]\nbogus')).toThrow(
      /Line 3: Unexpected "bogus"/,
    )
    expect(() => parseWardley(H + 'component A [2.0, 0.5]\n')).not.toThrow()
    expect(() => parseWardley(H + 'component A [101.0, 0.5]\n')).toThrow(
      /Component "A" visibility must be between 0-1 \(decimal\) or 0-100 \(percentage\)\. Received: 101/,
    )
    expect(() =>
      parseWardley(H + 'pipeline X {\ncomponent A [0.5]\n}'),
    ).toThrow(/Pipeline "X" must reference an existing component/)
    expect(() => parseWardley('')).toThrow(/Expected the "wardley-beta" header/)
  })

  it('ignores comments, blank lines, directives and front matter', () => {
    const map = parseWardley(
      '---\ntitle: x\n---\n%%{init: {"theme":"dark"}}%%\n\n%% c\nwardley-beta\n\ncomponent A [0.5, 0.5] %% t\n',
    )
    expect(map.nodes).toHaveLength(1)
  })

  it('reads quoted names and escapes', () => {
    const map = parseWardley(
      H + 'component "A \\"b\\"" [0.5, 0.5]\nnote \'it\\\'s\' [0.1, 0.1]',
    )
    expect(map.nodes[0]!.id).toBe('A "b"')
    expect(map.notes[0]!.text).toBe("it's")
  })

  it('collapses the title’s blanks and sanitizes it', () => {
    expect(parseWardley(H + 'title   a   b  ').title).toBe('a b')
    expect(parseWardley(H + 'title').title).toBeUndefined()
  })

  it('skips an accDescr block over several lines', () => {
    expect(
      parseWardley(H + 'accDescr {\n a\n b\n}\ncomponent A [0.5,0.5]').nodes,
    ).toHaveLength(1)
  })

  it('keeps the evolution stages without boundaries unset', () => {
    const map = parseWardley(H + 'evolution A -> B')
    expect(map.stages).toEqual(['A', 'B'])
    expect(map.stageBoundaries).toBeUndefined()
  })
})
