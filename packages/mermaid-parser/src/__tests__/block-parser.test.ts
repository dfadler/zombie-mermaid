import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseBlock } from '../block/parser.ts'

const kids = (src: string) => parseBlock(src).root.children

describe('parseBlock', () => {
  it('reads blocks, labels, shapes and column spans', () => {
    const root = parseBlock(
      'block-beta\n  columns 3\n  a["A label"] b:2 c("round")\n  d:3',
    ).root
    expect(root.columns).toBe(3)
    expect(
      root.children.map((c) => [
        c.id,
        c.label,
        c.shape,
        c.widthInColumns,
        c.type,
      ]),
    ).toEqual([
      ['a', 'A label', 'square', 1, 'node'],
      ['b', 'b', 'square', 2, 'node'],
      ['c', 'round', 'round', 1, 'node'],
      ['d', 'd', 'square', 3, 'node'],
    ])
  })

  it('accepts the plain `block` header, `columns auto`, comments and front matter', () => {
    const root = parseBlock(
      '---\ntitle: T\n---\n%% a comment\nblock\n  %%{init: {}}%%\n  columns auto\n  a b',
    ).root
    expect(root.columns).toBe(-1)
    expect(root.children.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('expands `space` and `space:N` into cells', () => {
    const c = kids('block-beta\n  a space b space:2 c')
    expect(c.map((x) => x.type)).toEqual([
      'node',
      'space',
      'node',
      'space',
      'space',
      'node',
    ])
  })

  it('reads groups with their own columns and span, and anonymous groups', () => {
    const [g, anon] = kids(
      'block-beta\n  block:grp:2\n    columns 2\n    x y z\n  end\n  block\n    q\n  end',
    )
    expect(g).toMatchObject({
      id: 'grp',
      type: 'composite',
      widthInColumns: 2,
      columns: 2,
      label: '',
    })
    expect(g!.children.map((c) => c.id)).toEqual(['x', 'y', 'z'])
    expect(anon).toMatchObject({ id: 'block-1', type: 'composite' })
  })

  it('lets a repeated id change the first block instead of adding one', () => {
    const c = kids('block-beta\n  a\n  b\n  a("again")')
    expect(c.map((x) => [x.id, x.label, x.shape])).toEqual([
      ['a', 'again', 'round'],
      ['b', 'b', 'square'],
    ])
    // A bare repeat keeps the first label and type.
    expect(kids('block-beta\n  a["x"]\n  a')[0]).toMatchObject({
      label: 'x',
      shape: 'square',
    })
  })

  it('treats `end` and `block` as keywords only on a word boundary', () => {
    const c = kids('block-beta\n  endpoint blocks')
    expect(c.map((x) => x.id)).toEqual(['endpoint', 'blocks'])
  })

  it('decodes entities and skips accessibility statements', () => {
    const c = kids(
      'block-beta\n  accTitle: t\n  accDescr: d\n  accDescr { x }\n  a["x #9829; y"]',
    )
    expect(c[0]!.label).toBe('x ♥ y')
  })

  it('parses an empty diagram', () => {
    expect(kids('block-beta')).toEqual([])
  })

  it('rejects columns 0 as Mermaid does', () => {
    expect(() => parseBlock('block-beta\n  columns 0')).toThrow(
      /Columns must be an integer/,
    )
  })

  describe('errors', () => {
    const fails = (src: string, re: RegExp) => {
      let err: unknown
      try {
        parseBlock(src)
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(MermaidParseError)
      expect((err as Error).message).toMatch(re)
    }

    it('needs the header', () =>
      fails('a b', /expected the "block-beta" header/))
    it('needs a label in quotes', () =>
      fails('block-beta\n  a[text]', /Expected a quoted label/))
    it('needs a closing quote', () =>
      fails('block-beta\n  a["text', /Unterminated string/))
    it('needs a closing bracket', () =>
      fails('block-beta\n  a["text"', /Expected a closing bracket/))
    it('rejects a stray string', () =>
      fails('block-beta\n  "x"', /Unexpected a string/))
    it('rejects an unclosed group', () =>
      fails('block-beta\n  block:g\n    a', /expected "end"/))
    it('rejects an unclosed anonymous group', () =>
      fails('block-beta\n  block\n    a', /expected "end"/))
    it('rejects a stray end', () =>
      fails('block-beta\n  a\n  end', /expected the end of the diagram/))
    it('needs an id after block:', () =>
      fails('block-beta\n  block:\n  end', /expected a block id/))
    it('rejects a stray colon', () =>
      fails('block-beta\n  a\n  =', /Unexpected "="/))
    it('rejects a size with nothing in front of it', () =>
      fails('block-beta\n  :2', /expected a block/))
  })

  describe('links', () => {
    const edges = (src: string) => parseBlock(src).edges

    it('reads every link style and declares both blocks', () => {
      const d = parseBlock(
        'block-beta\n  a --> b\n  a --- b\n  a ==> b\n  a -.- b\n  a --x b\n  a --o b\n  a <--> b\n  a -.-> b\n  a ===  b',
      )
      expect(d.root.children.map((c) => c.id)).toEqual(['a', 'b'])
      expect(
        d.edges.map((e) => [
          e.id,
          e.thickness,
          e.pattern,
          e.arrowTypeStart,
          e.arrowTypeEnd,
        ]),
      ).toEqual([
        ['1-a-b', 'normal', 'solid', 'arrow_open', 'arrow_point'],
        ['2-a-b', 'normal', 'solid', 'arrow_open', ''],
        ['3-a-b', 'thick', 'solid', 'arrow_open', 'arrow_point'],
        ['4-a-b', 'normal', 'dotted', 'arrow_open', ''],
        ['5-a-b', 'normal', 'solid', 'arrow_open', 'arrow_cross'],
        ['6-a-b', 'normal', 'solid', 'arrow_open', 'arrow_circle'],
        ['7-a-b', 'normal', 'solid', 'arrow_point', 'arrow_point'],
        ['8-a-b', 'normal', 'dotted', 'arrow_open', 'arrow_point'],
        ['9-a-b', 'thick', 'solid', 'arrow_open', ''],
      ])
    })

    it('reads a quoted label, shapes on either side and links with no spaces', () => {
      const d = parseBlock('block-beta\n  a["A"]-- "text" -->b("B")\n  c-->d')
      expect(d.edges[0]).toMatchObject({ id: '1-a-b', label: 'text' })
      expect(d.edges[1]).toMatchObject({ id: '1-c-d', label: '' })
      expect(d.root.children.map((c) => [c.id, c.label, c.shape])).toEqual([
        ['a', 'A', 'square'],
        ['b', 'B', 'round'],
        ['c', 'c', 'square'],
        ['d', 'd', 'square'],
      ])
    })

    it('reads a link inside a group, to a group and to a block declared later', () => {
      const d = parseBlock(
        'block-beta\n  block:g\n    x --> y\n  end\n  g --> z\n  z',
      )
      expect(d.edges.map((e) => e.id)).toEqual(['1-x-y', '1-g-z'])
    })

    it('keeps `~~~` an id, as Mermaid 12.3.0 does', () => {
      expect(edges('block-beta\n  a ~~~ b')).toEqual([])
      expect(parseBlock('block-beta\n  a ~~~ b').root.children).toHaveLength(3)
    })

    it('rejects what Mermaid rejects', () => {
      const fails = (src: string, re: RegExp) =>
        expect(() => parseBlock(src)).toThrow(re)
      fails('block-beta\n  a:2 --> b', /expected a block/)
      fails('block-beta\n  a --> b:2', /expected the next statement/)
      fails('block-beta\n  a -->', /expected a block id/)
      fails('block-beta\n  --> b', /expected a block/)
      fails('block-beta\n  a -- text --> b', /Expected a quoted link label/)
      fails('block-beta\n  a -- "text', /Unterminated string/)
      fails('block-beta\n  a -- "text" b', /Expected a link after "text"/)
    })
  })

  describe('styling and config', () => {
    it('reads classDef, class and style', () => {
      const d = parseBlock(
        'block-beta\n  a b c\n  classDef blue fill:#66f,stroke:#33a;\n  classDef default fill:#0f0\n  class a,c blue\n  class a other\n  style b fill:#969, stroke:#333\n  block:g\n    d\n  end\n  style g fill:#eee',
      )
      expect(d.classDefs).toEqual({
        blue: ['fill:#66f', 'stroke:#33a'],
        default: ['fill:#0f0'],
      })
      const [a, b, c, g] = d.root.children
      expect(a!.classes).toEqual(['blue', 'other'])
      expect(c!.classes).toEqual(['blue'])
      expect(b!.styles).toEqual(['fill:#969', 'stroke:#333'])
      expect(g!.styles).toEqual(['fill:#eee'])
    })

    it('ignores a class on a block that does not exist and merges repeated classDefs', () => {
      const d = parseBlock(
        'block-beta\n  a\n  class zz blue\n  classDef k fill:#111\n  classDef k stroke:#222',
      )
      expect(d.root.children.map((c) => c.id)).toEqual(['a'])
      expect(d.classDefs.k).toEqual(['fill:#111', 'stroke:#222'])
    })

    it('rejects what Mermaid rejects', () => {
      const fails = (src: string, re: RegExp) =>
        expect(() => parseBlock(src)).toThrow(re)
      fails('block-beta\n  style a fill:#123\n  a', /declared above/)
      fails('block-beta\n  a b\n  style a,b fill:#123', /declared above/)
      fails('block-beta\n  a\n  class a', /Expected a class name/)
      fails('block-beta\n  a\n  style a', /Expected style items/)
      fails('block-beta\n  classDef a', /Expected a name and style items/)
    })

    it('treats a markdown string as the parse error Mermaid 12.3.0 gives', () => {
      expect(() => parseBlock('block-beta\n  a["`**x**`"]')).toThrow(/MD_STR/)
      expect(() => parseBlock('block-beta\n  a b\n  a -- "`x`" --> b')).toThrow(
        /MD_STR/,
      )
    })

    it('reads block.padding from front matter or an init directive, default 8', () => {
      expect(parseBlock('block-beta\n  a').padding).toBe(8)
      expect(
        parseBlock(
          '---\nconfig:\n  block:\n    padding: 20\n---\nblock-beta\n  a',
        ).padding,
      ).toBe(20)
      expect(
        parseBlock('%%{init: {"block": {"padding": 0}}}%%\nblock-beta\n  a')
          .padding,
      ).toBe(0)
      expect(
        parseBlock('%%{init: {"block": {"padding": -1}}}%%\nblock-beta\n  a')
          .padding,
      ).toBe(8)
    })

    it('ignores accTitle and accDescr in the body', () => {
      expect(
        parseBlock('block-beta\n  accTitle: T\n  accDescr: D\n  a').root
          .children,
      ).toHaveLength(1)
    })
  })

  describe('shapes and block arrows', () => {
    const shapeOf = (src: string) =>
      parseBlock(`block-beta\n  ${src}`).root.children[0]!

    it("maps each pair of delimiters to Mermaid's type", () => {
      const cases: [string, string][] = [
        ['a["x"]', 'square'],
        ['a("x")', 'round'],
        ['a(("x"))', 'circle'],
        ['a((("x")))', 'doublecircle'],
        ['a{"x"}', 'diamond'],
        ['a{{"x"}}', 'hexagon'],
        ['a(["x"])', 'stadium'],
        ['a[["x"]]', 'subroutine'],
        ['a[("x")]', 'cylinder'],
        ['a>"x"]', 'rect_left_inv_arrow'],
        ['a[/"x"/]', 'lean_right'],
        ['a[\\"x"\\]', 'lean_left'],
        ['a[/"x"\\]', 'trapezoid'],
        ['a[\\"x"/]', 'inv_trapezoid'],
        ['a<["x"]>(right)', 'block_arrow'],
      ]
      for (const [src, shape] of cases) {
        const node = shapeOf(src)
        expect(node.shape, src).toBe(shape)
        expect(node.label, src).toBe('x')
        expect(node.type, src).toBe('node')
      }
    })

    it("reads a block arrow's directions as Mermaid lexes them", () => {
      expect(shapeOf('a<["x"]>(right, down)').directions).toEqual([
        'right',
        'down',
      ])
      expect(shapeOf('a<["x"]>(x)').directions).toEqual(['x'])
      expect(shapeOf('a<["x"]>(up,left , y)').directions).toEqual([
        'up',
        'left ',
        'y',
      ])
      expect(shapeOf('a["x"]').directions).toEqual([])
    })

    it('draws a pair of delimiters Mermaid has no shape for as a square block', () => {
      for (const src of ['a("x"]', 'a(("x")]', 'a{"x"}}', 'a)"x")'])
        expect(shapeOf(src).shape, src).toBe('square')
    })

    it("rejects what Mermaid's lexer or parser rejects", () => {
      for (const src of [
        'a<["x"]>',
        'a<["x"]>()',
        'a<["x"]>(Right)',
        'a<["x"]>(foo)',
        'a<["x"]>(right',
        'a<["x"]>(right,)',
        'a[|"x"|]',
        'a(((x)))',
        'a{x}',
      ])
        expect(() => parseBlock(`block-beta\n  ${src}`), src).toThrow(
          MermaidParseError,
        )
    })

    it('takes a size and links after a shape, and a redeclaration changes the type', () => {
      expect(shapeOf('a{{"x"}}:2').widthInColumns).toBe(2)
      const d = parseBlock('block-beta\n  a b\n  a{{"x"}}\n  a --> b')
      expect(d.root.children[0]).toMatchObject({ shape: 'hexagon', label: 'x' })
      expect(d.edges).toHaveLength(1)
      const e = parseBlock('block-beta\n  a(("x"))\n  a b')
      expect(e.root.children[0]!.shape).toBe('circle')
    })
  })

  it('treats a class named like an Object.prototype member as an ordinary name', () => {
    const d = parseBlock(
      'block-beta\n  classDef constructor fill:red\n  classDef constructor stroke:blue\n  a\n  class a toString',
    )
    expect(d.classDefs.constructor).toEqual(['fill:red', 'stroke:blue'])
    const p = parseBlock(
      'block-beta\n  a\n  classDef __proto__ fill:red\n  class a __proto__',
    )
    expect(Object.hasOwn(p.classDefs, '__proto__')).toBe(true)
    expect(p.classDefs.__proto__).toEqual(['fill:red'])
    expect(d.root.children[0]!.classes).toEqual(['toString'])
  })
})
