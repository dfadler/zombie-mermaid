/**
 * Mindmap parser. Expectations were taken from mermaid 12.3.0 itself (its
 * jison grammar and MindmapDB.addNode, rendered headless): which inputs it
 * accepts and rejects, and the tree it builds.
 */
import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseMindmap } from '../mindmap/parser.ts'
import { mindmapLabelLines, mindmapPlainLines } from '../mindmap/text.ts'
import type { MindmapNode } from '../mindmap/types.ts'

const outline = (n: MindmapNode): unknown => [
  n.text,
  n.shape,
  ...n.children.map(outline),
]

describe('parseMindmap: structure', () => {
  it("parses Mermaid's documented example", () => {
    const { root } = parseMindmap(`mindmap
  root((mindmap))
    Origins
      Long history
      Popularisation
    Research
      On effectiveness<br/>and features`)
    expect(outline(root)).toEqual([
      'mindmap',
      'circle',
      [
        'Origins',
        'default',
        ['Long history', 'default'],
        ['Popularisation', 'default'],
      ],
      ['Research', 'default', ['On effectiveness<br/>and features', 'default']],
    ])
    expect(root.id).toBe(0)
    // Mermaid's level is the indentation minus the root's, not the depth.
    expect(root.children[1]!.children[0]!.level).toBe(4)
  })

  it('reads every shape from its delimiters', () => {
    const { root } = parseMindmap(`mindmap
  r
    a[sq]
    b(round)
    c((circ))
    d))bang((
    e)cloud(
    f{{hex}}
    g(-dash-)
    -)other(-`)
    expect(root.children.map((c) => [c.text, c.shape])).toEqual([
      ['sq', 'rect'],
      ['round', 'rounded'],
      ['circ', 'circle'],
      ['bang', 'bang'],
      ['cloud', 'cloud'],
      ['hex', 'hexagon'],
      ['dash-', 'default'],
      ['other', 'default'],
    ])
  })

  it('reads a bare delimiter node and a cloud opened with ( and closed otherwise', () => {
    const { root } = parseMindmap('mindmap\n  [only]\n    (x((')
    expect(root.shape).toBe('rect')
    expect(root.children[0]!.shape).toBe('cloud')
  })

  it('takes the first node on the header line as the root', () => {
    expect(parseMindmap('mindmap root').root.text).toBe('root')
  })

  it('decides parents from indentation relative to the line above', () => {
    const { root } = parseMindmap('mindmap\nRoot\n  A\n B\n  C')
    // B is less indented than A, so a root child; C is a child of B.
    expect(outline(root)).toEqual([
      'Root',
      'default',
      ['A', 'default'],
      ['B', 'default', ['C', 'default']],
    ])
    const tabs = parseMindmap('mindmap\n\tr\n\t\ta\n\t\tb')
    expect(tabs.root.children).toHaveLength(2)
  })

  it('skips comments and blank lines, trailing whitespace included', () => {
    const { root } = parseMindmap(
      'mindmap\n  r\n    a\n      b\n   \n\n    %% c\n    d  \n',
    )
    expect(outline(root)).toEqual([
      'r',
      'default',
      ['a', 'default', ['b', 'default']],
      ['d', 'default'],
    ])
  })

  it('accepts CRLF, an init directive and front matter', () => {
    const { root } = parseMindmap(
      '---\ntitle: T\n---\n%%{init: {"theme":"dark"}}%%\r\nmindmap\r\n  r\r\n    a',
    )
    expect(root.children[0]!.text).toBe('a')
  })

  it('records icon and class lines on the node above', () => {
    const { root } = parseMindmap(`mindmap
  r
    a
      ::icon(fa fa-book)
    b
      :::urgent large
    c:::lit`)
    const [a, b, c] = root.children
    expect(a!.icon).toBe('fa fa-book')
    expect(b!.className).toBe('urgent large')
    expect(c!.text).toBe('c:::lit')
  })

  it('keeps text with brackets inside quotes and decodes entities', () => {
    const { root } = parseMindmap(
      'mindmap\n  r["a (b) c"]\n    id["`**m** (d)`"]\n    #quot;q#quot;',
    )
    expect(root.text).toBe('a (b) c')
    expect(root.children[0]!.text).toBe('**m** (d)')
    expect(root.children[1]!.text).toBe('"q"')
  })

  it('keeps a newline inside a delimiter as a line break', () => {
    const { root } = parseMindmap('mindmap\n  r\n    a[multi\nline]')
    expect(mindmapPlainLines(root.children[0]!.text)).toEqual(['multi', 'line'])
  })

  it('allows repeated labels', () => {
    expect(
      parseMindmap('mindmap\n  r\n    a\n    a').root.children,
    ).toHaveLength(2)
  })
})

describe('parseMindmap: errors, as Mermaid 12.3.0', () => {
  const bad = (src: string, message: RegExp) => {
    let error: unknown
    try {
      parseMindmap(src)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(MermaidParseError)
    expect((error as Error).message).toMatch(message)
  }

  it('needs the header', () => {
    bad('root\n  a', /mindmap" header/)
    bad('', /end of input/)
  })

  it('needs a node after the header', () => {
    bad('mindmap', /at least one node/)
    bad('mindmap\n\n  \n', /at least one node/)
  })

  it('refuses a second root and a node above the root', () => {
    bad('mindmap\n  Root\n A', /only one root/)
    bad('mindmap\n  Root\n  A', /only one root/)
  })

  it('refuses a class after a node on the same line', () => {
    bad('mindmap\n  r\n    A[A] :::urgent', /Line 3/)
  })

  it('refuses nested parentheses, an empty label and an unclosed node', () => {
    bad('mindmap\n  r\n    a(b(c)d)', /Line 3/)
    bad('mindmap\n  r\n    id[]', /node text/)
    bad('mindmap\n  r\n    id[open', /closing bracket/)
    bad('mindmap\n  r\n    id(', /node text/)
  })

  it('refuses a second header', () => {
    bad('mindmap\n  r\n    mindmap', /Unexpected/)
  })

  it('refuses an icon or class before any node', () => {
    bad('mindmap\n::icon(x)\n  r', /icon needs a node/)
    bad('mindmap\n:::c\n  r', /class needs a node/)
  })

  it('takes a lone closing bracket as a label, as Mermaid does', () => {
    expect(parseMindmap('mindmap\n  r\n    ]').root.children[0]!.text).toBe(']')
  })

  it('refuses an unterminated string', () => {
    bad('mindmap\n  r["`open', /Unexpected/)
    bad('mindmap\n  r["open', /Unexpected/)
    bad('mindmap\n  r["`a`b`"]', /Unexpected "`"/)
  })

  it('names the line and carries the diagram type', () => {
    try {
      parseMindmap('mindmap\n  r\n    a(b(c)d)')
    } catch (e) {
      expect((e as MermaidParseError).line).toBe(3)
      expect((e as MermaidParseError).diagramType).toBe('mindmap')
    }
  })
})

describe('parseMindmap: header', () => {
  it('accepts an indented header, as Mermaid does', () => {
    expect(parseMindmap('  mindmap\n  root\n    a').root.children).toHaveLength(
      1,
    )
  })
})

describe('mindmapLabelLines', () => {
  it('splits on newlines and <br> in any spelling', () => {
    expect(mindmapPlainLines('a<br>b<BR/>c<br />d\ne')).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
  })

  it('reads Markdown and HTML emphasis, drops other tags, keeps stray stars', () => {
    expect(
      mindmapLabelLines('**b** *i* <b>x</b><em>y</em><u>z</u> 2*3'),
    ).toEqual([
      [
        { text: 'b', bold: true, italic: false },
        { text: ' ', bold: false, italic: false },
        { text: 'i', bold: false, italic: true },
        { text: ' ', bold: false, italic: false },
        { text: 'x', bold: true, italic: false },
        { text: 'y', bold: false, italic: true },
        { text: 'z 2*3', bold: false, italic: false },
      ],
    ])
  })

  it('leaves no tag behind when one is built from the pieces of another', () => {
    expect(mindmapPlainLines('<<u>script>x')).toEqual(['x'])
    expect(mindmapPlainLines('a <img src=x onerror=y> b')).toEqual(['a  b'])
  })

  it('reads underscore emphasis at word boundaries and backslash escapes, as Mermaid does', () => {
    const runs = mindmapLabelLines(
      '_it_ and __bd__ and snake_case_word and \\*esc\\* and a_b',
    )[0]!
    expect(runs.map((r) => [r.text, r.bold, r.italic])).toEqual([
      ['it', false, true],
      [' and ', false, false],
      ['bd', true, false],
      [' and snake_case_word and *esc* and a_b', false, false],
    ])
  })

  it('ignores attributes on emphasis tags', () => {
    expect(
      mindmapLabelLines('<b class="x">bold</b> <i style="color:red">it</i>')[0],
    ).toEqual([
      { text: 'bold', bold: true, italic: false },
      { text: ' ', bold: false, italic: false },
      { text: 'it', bold: false, italic: true },
    ])
  })

  it('gives one empty line for empty text', () => {
    expect(mindmapLabelLines('')).toEqual([[]])
  })
})
