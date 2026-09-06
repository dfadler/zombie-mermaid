/**
 * Opt-in OSC 8 terminal hyperlinks in ASCII output (issue #216, piece 4).
 *
 * `renderMermaidASCII(text, { hyperlinks: true })` wraps the label of every
 * node whose `click` directive declared a safe href in an OSC 8 escape
 * pair. The sequences are zero-width, so the load-bearing property is that
 * stripping them yields exactly the non-hyperlinked output — checked here
 * per feature, and against every gallery sample in
 * __tests__/ascii-hyperlinks-samples.test.ts (which lives outside src/ so it
 * can import samples-data.ts without tripping tsconfig's rootDir).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import {
  OSC8_CLOSE,
  OSC8_SEQUENCE,
  osc8Open,
  stripOsc8,
  joinWithLinks,
  LinkRunTracker,
  markBoxLabelLinks,
  mkLinkCanvas,
} from '../ascii/hyperlinks.ts'
import { colorizeLine, DEFAULT_ASCII_THEME } from '../ascii/ansi.ts'
import { mkCanvas, write } from '../ascii/canvas.ts'
import { addCoordsOverlay } from '../ascii/coords.ts'
import { runRender } from '../cli/render.ts'
import { createMockStdout, renderArgs } from './cli-test-helpers.ts'
import type { CharRole } from '../ascii/types.ts'

const OSC8_PREFIX = '\x1b]8;;'

/** Every `open … close` span in `output`: [href, visible text]. */
function linkSpans(output: string): [string, string][] {
  const spans: [string, string][] = []
  const re = /\x1b\]8;;([^\x1b]*)\x1b\\([\s\S]*?)\x1b\]8;;\x1b\\/g
  for (const m of output.matchAll(re)) spans.push([m[1]!, m[2]!])
  return spans
}

const LINKED_FLOW = `graph LR
  A[Docs] --> B[Other]
  click A "https://example.com" "Docs"`

describe('renderMermaidASCII – hyperlinks option', () => {
  it('is off by default: no OSC 8 anywhere, even with click hrefs present', () => {
    expect(renderMermaidASCII(LINKED_FLOW)).not.toContain(OSC8_PREFIX)
    expect(
      renderMermaidASCII(LINKED_FLOW, { hyperlinks: false }),
    ).not.toContain(OSC8_PREFIX)
  })

  it('wraps only the linked node label when enabled', () => {
    const out = renderMermaidASCII(LINKED_FLOW, { hyperlinks: true })
    expect(linkSpans(out)).toEqual([['https://example.com', 'Docs']])
    // The unlinked node's label is present and bare.
    expect(stripOsc8(out)).toContain('Other')
    expect(out).toContain(`${osc8Open('https://example.com')}Docs${OSC8_CLOSE}`)
  })

  it('never changes layout: stripping the sequences gives the plain render', () => {
    const plain = renderMermaidASCII(LINKED_FLOW)
    const linked = renderMermaidASCII(LINKED_FLOW, { hyperlinks: true })
    expect(linked).not.toBe(plain)
    expect(stripOsc8(linked)).toBe(plain)
  })

  it('links a multi-word label as one span, interior space included', () => {
    const out = renderMermaidASCII(
      `graph TD
  A[Web Server] --> B[DB]
  click A "https://example.com/web"`,
      { hyperlinks: true },
    )
    expect(linkSpans(out)).toEqual([['https://example.com/web', 'Web Server']])
  })

  it('links each line of a multi-line label separately', () => {
    const out = renderMermaidASCII(
      `graph TD
  A["Line one<br/>Line two"] --> B[Next]
  click A "https://example.com/multi"`,
      { hyperlinks: true },
    )
    expect(linkSpans(out)).toEqual([
      ['https://example.com/multi', 'Line one'],
      ['https://example.com/multi', 'Line two'],
    ])
    expect(stripOsc8(out)).toBe(
      renderMermaidASCII(
        `graph TD
  A["Line one<br/>Line two"] --> B[Next]
  click A "https://example.com/multi"`,
      ),
    )
  })

  it('links only the node that declared the click when labels repeat', () => {
    const src = `graph LR
  A[Same] --> B[Same]
  click B "https://example.com/b"`
    const out = renderMermaidASCII(src, { hyperlinks: true })
    expect(linkSpans(out)).toEqual([['https://example.com/b', 'Same']])
    // Both labels are still rendered; exactly one of them is wrapped.
    expect(stripOsc8(out).match(/Same/g)).toHaveLength(2)
  })

  it('links the whole label when another label is a prefix of it', () => {
    const out = renderMermaidASCII(
      `graph LR
  A[Doc] --> B[Docs]
  click B "https://example.com/docs"`,
      { hyperlinks: true },
    )
    expect(linkSpans(out)).toEqual([['https://example.com/docs', 'Docs']])
  })

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:msgbox'],
  ])('never emits an unsafe href (%s)', (href) => {
    const out = renderMermaidASCII(
      `graph LR
  A[Docs] --> B[Other]
  click A "${href}"`,
      { hyperlinks: true },
    )
    expect(out).not.toContain(OSC8_PREFIX)
    expect(out).not.toContain(href)
  })

  it('emits nothing for a callback-only interaction', () => {
    const out = renderMermaidASCII(
      `graph LR
  A[Docs] --> B[Other]
  click A call showDetail() "A tooltip"`,
      { hyperlinks: true },
    )
    expect(out).not.toContain(OSC8_PREFIX)
    expect(out).not.toContain('showDetail')
  })

  it('accepts mailto and relative hrefs', () => {
    const out = renderMermaidASCII(
      `graph LR
  A[Mail] --> B[Local]
  click A "mailto:me@example.com"
  click B "./guide.html"`,
      { hyperlinks: true },
    )
    expect(linkSpans(out)).toEqual([
      ['mailto:me@example.com', 'Mail'],
      ['./guide.html', 'Local'],
    ])
  })

  it('keeps links on their labels after the BT vertical flip', () => {
    const src = `graph BT
  A[Bottom] --> B[Top]
  click B "https://example.com/top"`
    const out = renderMermaidASCII(src, { hyperlinks: true })
    expect(linkSpans(out)).toEqual([['https://example.com/top', 'Top']])
    expect(stripOsc8(out)).toBe(renderMermaidASCII(src))
  })

  it('links a class name in a class diagram, but not its annotation or members', () => {
    const src = `classDiagram
  class Animal {
    <<interface>>
    +String name
    +speak()
  }
  class Dog
  Animal <|-- Dog
  click Animal href "https://example.com/animal"`
    const out = renderMermaidASCII(src, { hyperlinks: true })
    expect(linkSpans(out)).toEqual([['https://example.com/animal', 'Animal']])
    expect(stripOsc8(out)).toBe(renderMermaidASCII(src))
  })

  it("is ignored in 'html' color mode (browser mockups never get escapes)", () => {
    const out = renderMermaidASCII(LINKED_FLOW, {
      hyperlinks: true,
      colorMode: 'html',
    })
    expect(out).not.toContain('\x1b')
    expect(out).toContain('<span')
  })

  it('composes with ANSI colors without disturbing the SGR runs', () => {
    const plain = renderMermaidASCII(LINKED_FLOW, { colorMode: 'truecolor' })
    const linked = renderMermaidASCII(LINKED_FLOW, {
      colorMode: 'truecolor',
      hyperlinks: true,
    })
    expect(plain).toContain('\x1b[38;2;')
    expect(linkSpans(linked).map(([href]) => href)).toEqual([
      'https://example.com',
    ])
    expect(stripOsc8(linked)).toBe(plain)
  })

  it('does not widen the --coords ruler', () => {
    const plain = addCoordsOverlay(renderMermaidASCII(LINKED_FLOW))
    const linked = addCoordsOverlay(
      renderMermaidASCII(LINKED_FLOW, { hyperlinks: true }),
    )
    expect(linked.split('\n')[0]).toBe(plain.split('\n')[0])
    expect(stripOsc8(linked)).toBe(plain)
  })
})

describe('hyperlinks – escape sequence helpers', () => {
  it('uses the ESC \\ string terminator, not BEL', () => {
    expect(osc8Open('https://example.com')).toBe(
      '\x1b]8;;https://example.com\x1b\\',
    )
    expect(OSC8_CLOSE).toBe('\x1b]8;;\x1b\\')
    expect(osc8Open('https://example.com')).not.toContain('\x07')
  })

  it('percent-encodes characters outside printable ASCII, leaving the rest alone', () => {
    expect(osc8Open('https://例.jp/a b?q=1&r=%20#x')).toBe(
      '\x1b]8;;https://%E4%BE%8B.jp/a%20b?q=1&r=%20#x\x1b\\',
    )
    // A surrogate pair encodes as one code point, not two lone surrogates.
    expect(osc8Open('https://x.test/😀')).toBe(
      '\x1b]8;;https://x.test/%F0%9F%98%80\x1b\\',
    )
  })

  it('stripOsc8 removes ST- and BEL-terminated sequences and nothing else', () => {
    const st = `${osc8Open('https://a.test')}A${OSC8_CLOSE} \x1b[31mB\x1b[0m`
    expect(stripOsc8(st)).toBe('A \x1b[31mB\x1b[0m')
    const bel = '\x1b]8;;https://a.test\x07A\x1b]8;;\x07'
    expect(stripOsc8(bel)).toBe('A')
    expect(OSC8_SEQUENCE.flags).toContain('g')
  })

  it('LinkRunTracker closes and reopens between adjacent different links', () => {
    const t = new LinkRunTracker()
    expect(t.advance(null)).toBe('')
    expect(t.advance('https://a.test')).toBe(osc8Open('https://a.test'))
    expect(t.advance('https://a.test')).toBe('')
    expect(t.advance('https://b.test')).toBe(
      OSC8_CLOSE + osc8Open('https://b.test'),
    )
    expect(t.advance(null)).toBe(OSC8_CLOSE)
    expect(t.finish()).toBe('')
    t.advance('https://c.test')
    expect(t.finish()).toBe(OSC8_CLOSE)
  })

  it('joinWithLinks wraps runs and closes a run open at end of line', () => {
    const chars = ['x', 'y', 'z', 'w']
    const links = [null, 'https://a.test', 'https://a.test', 'https://b.test']
    expect(joinWithLinks(chars, links)).toBe(
      `x${osc8Open('https://a.test')}yz${OSC8_CLOSE}${osc8Open('https://b.test')}w${OSC8_CLOSE}`,
    )
    expect(joinWithLinks(chars, [null, null, null, null])).toBe('xyzw')
  })

  it('colorizeLine keeps SGR grouping intact around a link inside a color run', () => {
    // Zero border padding: the label touches the border, so the link
    // boundary falls inside what would otherwise be one 'border' SGR run if
    // the label's first char were border-like. Assert the general property.
    const chars = ['│', '-', 'x', '│']
    const roles: (CharRole | null)[] = ['border', 'border', 'text', 'border']
    const links = [null, 'https://a.test', 'https://a.test', null]
    const plain = colorizeLine(chars, roles, DEFAULT_ASCII_THEME, 'truecolor')
    const linked = colorizeLine(
      chars,
      roles,
      DEFAULT_ASCII_THEME,
      'truecolor',
      links,
    )
    expect(stripOsc8(linked)).toBe(plain)
    expect(linkSpans(stripSgr(linked))).toEqual([['https://a.test', '-x']])
  })

  it('markBoxLabelLinks marks first..last non-space cells of the requested interior rows', () => {
    // 7 wide x 5 tall box: row 1 "ab cd", row 2 blank, row 3 "e"
    const box = mkCanvas(6, 4)
    for (let x = 1; x <= 5; x++) {
      write(box, x, 0, '─')
      write(box, x, 4, '─')
    }
    for (let y = 1; y <= 3; y++) {
      write(box, 0, y, '│')
      write(box, 6, y, '│')
    }
    for (const [i, ch] of ['a', 'b', ' ', 'c', 'd'].entries())
      write(box, 1 + i, 1, ch)
    write(box, 3, 3, 'e')

    const all = mkLinkCanvas(20, 20)
    markBoxLabelLinks(all, box, { x: 10, y: 5 }, 'https://a.test')
    const marked = (lc: (string | null)[][]) =>
      lc.flatMap((col, x) =>
        col.flatMap((v, y) => (v === null ? [] : [`${x},${y}`])),
      )
    expect(marked(all).sort()).toEqual(
      ['11,6', '12,6', '13,6', '14,6', '15,6', '13,8'].sort(),
    )

    const headerOnly = mkLinkCanvas(20, 20)
    markBoxLabelLinks(headerOnly, box, { x: 0, y: 0 }, 'https://a.test', {
      from: 3,
      to: 3,
    })
    expect(marked(headerOnly)).toEqual(['3,3'])

    // Out-of-range cells are clipped, not thrown on.
    const tiny = mkLinkCanvas(1, 1)
    expect(() =>
      markBoxLabelLinks(tiny, box, { x: 0, y: 0 }, 'https://a.test'),
    ).not.toThrow()
  })
})

describe('CLI – render --ascii --hyperlinks', () => {
  it('emits OSC 8 only when the flag is set', async () => {
    const off = createMockStdout()
    await runRender(renderArgs({ ascii: true }), off, LINKED_FLOW)
    expect(off.output()).not.toContain(OSC8_PREFIX)

    const on = createMockStdout()
    await runRender(
      renderArgs({ ascii: true, hyperlinks: true }),
      on,
      LINKED_FLOW,
    )
    expect(linkSpans(on.output())).toEqual([['https://example.com', 'Docs']])
    expect(stripOsc8(on.output())).toBe(off.output())
  })

  it('measures --max-width on visible columns, ignoring the escapes', async () => {
    const stderr = createMockStdout()
    const out = createMockStdout()
    // Wide enough that the plain render fits; the escape bytes alone would
    // push a naive length measurement past the limit and trigger a warning.
    const width = renderMermaidASCII(LINKED_FLOW)
      .split('\n')
      .reduce((m, l) => Math.max(m, l.length), 0)
    await runRender(
      renderArgs({ ascii: true, hyperlinks: true, maxWidth: width }),
      out,
      LINKED_FLOW,
      stderr,
    )
    expect(stderr.output()).toBe('')
    expect(out.output()).toContain(OSC8_PREFIX)
  })
})

/** SGR-only strip, for asserting link spans inside colored output. */
function stripSgr(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}
