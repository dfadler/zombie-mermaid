import { describe, expect, it } from 'vitest'
import { parsePacket } from '../packet/parser.ts'
import { resolvePacketConfig } from '../packet/types.ts'
import { MermaidParseError } from '@zombie-mermaid/core'

const err = (src: string): string => {
  try {
    parsePacket(src)
  } catch (e) {
    expect(e).toBeInstanceOf(MermaidParseError)
    return (e as Error).message
  }
  throw new Error('expected a parse error')
}

describe('parsePacket', () => {
  it('reads ranges, single bits and +N counts, contiguous from bit 0', () => {
    const p = parsePacket('packet\n0-7: "a"\n8: "b"\n+4: "c"\n13-15: "d"')
    expect(p.blocks).toEqual([
      { start: 0, end: 7, label: 'a' },
      { start: 8, end: 8, label: 'b' },
      { start: 9, end: 12, label: 'c' },
      { start: 13, end: 15, label: 'd' },
    ])
    expect(p.words).toHaveLength(1)
  })

  it('accepts packet-beta, a field on the header line, CRLF, tabs and comments', () => {
    expect(parsePacket('packet-beta\r\n0-3:"a"\r\n').blocks).toHaveLength(1)
    expect(parsePacket('packet 0-3: "a"').blocks).toHaveLength(1)
    expect(
      parsePacket('packet%% c\n\t0\t-\t3\t:\t"a" %% t\n%% x').blocks,
    ).toEqual([{ start: 0, end: 3, label: 'a' }])
  })

  it('is case-sensitive about the header and needs one', () => {
    expect(err('Packet\n0: "a"')).toMatch(/header/)
    expect(err('')).toMatch(/header/)
  })

  it('unquotes with either quote mark and Langium escapes', () => {
    expect(parsePacket("packet\n0: 'it\"s'").blocks[0]!.label).toBe('it"s')
    const e = parsePacket('packet\n0-7: "a\\tb\\\\c\\qd\\n\\"e"')
    expect(e.blocks[0]!.label).toBe('a\tb\\cqd\n"e')
    expect(parsePacket('packet\n0: ""').blocks[0]!.label).toBe('')
  })

  it('takes the last title, collapses blanks, drops a trailing comment', () => {
    expect(parsePacket('packet\ntitle  A   B  %% c\n0: "x"').title).toBe('A B')
    expect(parsePacket('packet\ntitle A\n0: "x"\ntitle B').title).toBe('B')
    expect(parsePacket('packet\ntitle A\ntitle').title).toBeUndefined()
    expect(parsePacket('packet\n0: "x"\ntitle Mid\n1: "y"').title).toBe('Mid')
  })

  it('ignores accTitle and accDescr', () => {
    const p = parsePacket(
      'packet\naccTitle: T\naccDescr: D\naccDescr {\n x\n}\n0: "a"',
    )
    expect(p.blocks).toHaveLength(1)
  })

  it.each([
    [
      'a gap',
      'packet\n0-7: "a"\n9-15: "b"',
      /9 - 15 is not contiguous\. It should start from 8/,
    ],
    ['an overlap', 'packet\n0-7: "a"\n0-7: "b"', /not contiguous/],
    ['a late start', 'packet\n4-7: "a"', /should start from 0/],
    [
      'a zero count',
      'packet\n0-7: "a"\n+0: "b"',
      /Cannot have a zero bit field/,
    ],
    ['end before start', 'packet\n5-2: "a"', /End must be greater than start/],
  ])('rejects %s', (_n, src, msg) => {
    expect(err(src)).toMatch(msg)
  })

  it.each([
    ['an unquoted label', 'packet\n0-7: x'],
    ['two fields on a line', 'packet\n0: "a" 1: "b"'],
    ['a semicolon', 'packet\n0-7: "a"; 8-15: "b"'],
    ['a leading zero', 'packet\n00-7: "a"'],
    ['a fraction', 'packet\n1.5: "a"'],
    ['a second header', 'packet\npacket\n0: "a"'],
    ['a missing colon', 'packet\n0-7 "a"'],
    ['a dangling dash', 'packet\n0-: "a"'],
    ['a stray plus', 'packet\n+: "a"'],
    ['text after the label', 'packet\n0: "a" junk'],
    ['a bare label', 'packet\n"x"'],
  ])('rejects %s with its line number', (_n, src) => {
    expect(err(src)).toMatch(/^Line 2:/)
  })

  it('reports the line of a multi-line label’s next error', () => {
    expect(err('packet\n0: "a\nb"\n9: "c"')).toMatch(/^Line 4:/)
  })

  it('reports the end of the text when a field is cut short', () => {
    expect(err('packet\n0-7:')).toMatch(
      /Expected a quoted label.*end of the text/,
    )
  })
})

describe('packet rows', () => {
  it('cuts a field at the row boundary and repeats it', () => {
    const p = parsePacket('packet\n0-7: "a"\n8-39: "b"\n40-47: "c"')
    expect(p.words.map((w) => w.map((b) => [b.start, b.end, b.label]))).toEqual(
      [
        [
          [0, 7, 'a'],
          [8, 31, 'b'],
        ],
        [
          [32, 39, 'b'],
          [40, 47, 'c'],
        ],
      ],
    )
  })

  it('starts a row exactly when one fills, and never emits an empty row', () => {
    expect(parsePacket('packet\n0-31: "a"').words).toHaveLength(1)
    expect(parsePacket('packet\n0-31: "a"\n32: "b"').words).toHaveLength(2)
    expect(parsePacket('packet').words).toEqual([])
  })

  it('follows init bitsPerRow', () => {
    const p = parsePacket(
      '%%{init: {"packet": {"bitsPerRow": 8}}}%%\npacket\n0-11: "a"',
    )
    expect(p.words).toHaveLength(2)
    expect(p.config).toEqual({ bitsPerRow: 8 })
  })

  it('coerces numeric strings like mermaid, and reads showBits and bitOrder by truthiness', () => {
    const cfg = (o: string) =>
      parsePacket(`%%{init: {"packet": ${o}}}%%\npacket\n0: "a"`).config
    expect(
      cfg(
        '{"bitsPerRow": "8", "bitWidth": " 20 ", "paddingX": "5", "rowHeight": "40", "paddingY": true}',
      ),
    ).toEqual({
      bitsPerRow: 8,
      bitWidth: 20,
      paddingX: 5,
      rowHeight: 40,
      paddingY: 1,
    })
    // Not numbers (or not whole rows) stay ignored.
    expect(
      cfg('{"bitWidth": "x", "bitsPerRow": "8.5", "rowHeight": []}'),
    ).toEqual({})
    expect(cfg('{"showBits": "no"}')).toEqual({ showBits: true })
    expect(cfg('{"showBits": 0}')).toEqual({ showBits: false })
    expect(cfg('{"showBits": ""}')).toEqual({ showBits: false })
    expect(cfg('{"showBits": null}')).toEqual({})
    expect(cfg('{"bitOrder": "weird"}')).toEqual({ bitOrder: 'ascending' })
    expect(cfg('{"bitOrder": "descending"}')).toEqual({
      bitOrder: 'descending',
    })
  })

  it('keeps at most 10000 rows', () => {
    const p = parsePacket(
      '%%{init: {"packet": {"bitsPerRow": 1}}}%%\npacket\n0-99999: "x"',
    )
    expect(p.words).toHaveLength(1e4)
  })
})

describe('resolvePacketConfig', () => {
  it('uses mermaid 12.3.0 defaults, adding 10 to paddingY with bit numbers', () => {
    expect(resolvePacketConfig()).toEqual({
      rowHeight: 32,
      bitWidth: 32,
      bitsPerRow: 32,
      showBits: true,
      bitOrder: 'ascending',
      paddingX: 5,
      paddingY: 15,
    })
    expect(resolvePacketConfig({ showBits: false, paddingY: 7 }).paddingY).toBe(
      7,
    )
  })
})

describe('packet title (sanitized as mermaid 12.3.0 does)', () => {
  const title = (t: string) => parsePacket(`packet\ntitle ${t}\n0: "a"`).title
  it('keeps a title without a "<" as written', () => {
    expect(title('A & B &copy;')).toBe('A & B &copy;')
  })
  it('escapes & < > and keeps allowed tags as markup text', () => {
    expect(title('A & B <b>x</b> 1 < 2 > 0')).toBe(
      'A &amp; B <b>x</b> 1 &lt; 2 &gt; 0',
    )
  })
  it('drops scripts, unknown tags, comments, event handlers and javascript: links', () => {
    expect(title('<script>x</script>a<foo>b</foo><!-- c -->')).toBe('ab')
    expect(title('<div onclick="x()" class=c>d</div>')).toBe(
      '<div class="c">d</div>',
    )
    expect(title('<a href="javascript:x()">l</a>')).toBe('<a>l</a>')
    expect(title("<img src=x alt='y'>z<br/>")).toBe(
      '<img src="x" alt="y">z<br>',
    )
  })
  it('closes open tags, drops stray end tags and unterminated tags', () => {
    expect(title('<b>x</i>y<u>z')).toBe('<b>xy<u>z</u></b>')
    expect(title('<p>1<p>2')).toBe('<p>1</p><p>2</p>')
    expect(title('<table><tr><td>t</td></tr></table>')).toBe(
      '<table><tbody><tr><td>t</td></tr></tbody></table>',
    )
    expect(title('a<b')).toBe('a')
    expect(title('a <!-- open')).toBe('a ')
    expect(title('<style>p{}')).toBeUndefined()
    expect(title('<svg><circle/></svg>')).toBe('<svg><circle></circle></svg>')
  })
  it("decodes entities once a tag is present, and mermaid's #N; form always", () => {
    expect(title('<i>&copy; &amp; &#65; &nbsp; &foo; &#9999999;</i>')).toBe(
      '<i>© &amp; A &nbsp; &amp;foo; �</i>',
    )
    expect(title('#65; #amp; #foo; #9999999;')).toBe('A & &foo; �')
  })
  it('drops a title that sanitizes to nothing', () => {
    expect(parsePacket('packet\ntitle <script>x</script>\n0: "a"').title).toBe(
      undefined,
    )
  })
})
