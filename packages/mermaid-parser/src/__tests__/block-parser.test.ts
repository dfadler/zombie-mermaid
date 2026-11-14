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

    it('needs the header', () => fails('a b', /expected the "block-beta" header/))
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

  describe('syntax tracked in issues', () => {
    const tracked = (src: string, issue: number) =>
      expect(() => parseBlock(src)).toThrow(new RegExp(`issues/${issue}`))

    it('names the links issue', () => {
      for (const link of ['-->', '---', '==>', '-.-', '--x', '<-->'])
        tracked(`block-beta\n  a ${link} b`, 3105)
      tracked('block-beta\n  a -- "t" --> b', 3105)
    })
    it('names the shapes issue', () => {
      for (const shape of ['(("x"))', '{"x"}', '{{"x"}}', '(["x"])', '[["x"]]'])
        tracked(`block-beta\n  a${shape}`, 3106)
      tracked('block-beta\n  a<["x"]>(down)', 3106)
    })
    it('names the styling issue', () => {
      tracked('block-beta\n  a\n  classDef c fill:#f9f', 3107)
      tracked('block-beta\n  a\n  class a c', 3107)
      tracked('block-beta\n  a\n  style a fill:#f9f', 3107)
      tracked('block-beta\n  a["`**x**`"]', 3107)
    })
  })
})
