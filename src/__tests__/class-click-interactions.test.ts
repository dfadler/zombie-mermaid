/**
 * `click` href/tooltip interaction support for class diagrams (issue #292).
 *
 * Mirrors the flowchart coverage in interactivity-config.test.ts and
 * interactivity-option.test.ts — same grammar, same href-sanitization rules,
 * same interactivity gating — since both parsers delegate to the shared
 * src/click-directive.ts. Mermaid's own class-diagram syntax documents this
 * exact form (`click className call callback() "tooltip"` /
 * `click className href "url" "tooltip"`), unlike erDiagram — see
 * src/__tests__/er-click-unsupported.test.ts for that side of issue #292.
 */
import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '../class/parser.ts'
import { renderMermaidSVG } from '../index.ts'

/** Helper to parse — preprocesses text the same way index.ts does */
function parse(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))
  return parseClassDiagram(lines)
}

describe('parseClassDiagram – click interactions', () => {
  const parseClick = (statement: string) =>
    parse(`classDiagram\n  class Animal\n  ${statement}`).interactions.get(
      'Animal',
    )

  it.each([
    ['click Animal "https://example.com"', { href: 'https://example.com' }],
    [
      'click Animal "https://example.com" "Go to example"',
      { href: 'https://example.com', tooltip: 'Go to example' },
    ],
    [
      'click Animal "https://example.com" _blank',
      { href: 'https://example.com', target: '_blank' },
    ],
    [
      'click Animal href "https://example.com" "Tip" _blank',
      { href: 'https://example.com', tooltip: 'Tip', target: '_blank' },
    ],
    ['click Animal call myHandler()', { callback: 'myHandler()' }],
    [
      'click Animal call myHandler() "With tooltip"',
      { callback: 'myHandler()', tooltip: 'With tooltip' },
    ],
  ])('parses %s', (statement, expected) => {
    expect(parseClick(statement)).toEqual(expected)
  })

  it('leaves classes without a click statement untouched', () => {
    const d = parse(`classDiagram\n  class Animal`)
    expect(d.interactions.size).toBe(0)
  })
})

describe('renderMermaidSVG – class diagram click interactions', () => {
  it('wraps the class box in a real SVG <a> link with target', () => {
    const svg = renderMermaidSVG(
      'classDiagram\n  class Animal\n  click Animal "https://example.com" _blank',
    )
    expect(svg).toContain('<a href="https://example.com" target="_blank">')
    expect(svg).toContain('</a>')
  })

  it('renders a tooltip as a <title>, which needs no script', () => {
    const svg = renderMermaidSVG(
      'classDiagram\n  class Animal\n  click Animal "https://example.com" "Helpful"',
    )
    expect(svg).toContain('<title>Helpful</title>')
  })

  it('escapes a tooltip containing markup', () => {
    const svg = renderMermaidSVG(
      'classDiagram\n  class Animal\n  click Animal "https://x.test" "a <b> & c"',
    )
    expect(svg).not.toContain('<title>a <b>')
    expect(svg).toContain('&lt;b&gt;')
  })

  it('keeps the class box content (label, members) intact alongside the link', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal {
        +String name
        +eat() void
      }
      click Animal "https://example.com"`)
    expect(svg).toContain('data-id="Animal"')
    expect(svg).toContain('>Animal<')
    expect(svg).toContain('name')
    expect(svg).toContain('eat')
  })

  describe('href sanitization (same rules as flowchart — src/click-directive.ts)', () => {
    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ])('drops the script-capable scheme %s', (href) => {
      const svg = renderMermaidSVG(
        `classDiagram\n  class Animal\n  click Animal "${href}"`,
      )
      expect(svg).not.toContain('<a href=')
      expect(svg.toLowerCase()).not.toContain('javascript:')
      expect(svg.toLowerCase()).not.toContain('vbscript:')
    })

    it.each([
      'https://example.com',
      'http://example.com',
      'mailto:a@b.test',
      '/relative/path',
      './sibling',
      '#anchor',
    ])('keeps the safe href %s', (href) => {
      const svg = renderMermaidSVG(
        `classDiagram\n  class Animal\n  click Animal "${href}"`,
      )
      expect(svg).toContain('<a href=')
    })
  })

  describe('a call/callback binding (#216)', () => {
    const WITH_CALLBACK =
      'classDiagram\n  class Animal\n  click Animal call handler()'

    it('surfaces only through the parsed interactions map', () => {
      expect(parse(WITH_CALLBACK).interactions.get('Animal')).toEqual({
        callback: 'handler()',
      })
    })

    it('leaves no trace of the callback in the SVG', () => {
      const svg = renderMermaidSVG(WITH_CALLBACK)
      // The inert `data-click-callback` attribute was removed in #216.
      expect(svg).not.toContain('data-click-callback')
      expect(svg).not.toContain('handler()')
      expect(svg).not.toContain('<script')
      expect(svg).not.toContain('onclick')
    })

    it('keeps the data-id hook a host binds the callback to', () => {
      expect(renderMermaidSVG(WITH_CALLBACK)).toContain('data-id="Animal"')
    })

    it('still renders the href link and <title> tooltip alongside it', () => {
      const svg = renderMermaidSVG(
        'classDiagram\n  class Animal\n  class Dog\n  click Animal "https://example.com" "Tip"\n  click Dog call handler()',
      )
      expect(svg).toContain('<a href="https://example.com">')
      expect(svg).toContain('<title>Tip</title>')
      expect(svg).not.toContain('data-click-callback')
    })
  })

  describe('unaffected diagrams (no accidental behavior change)', () => {
    it('a class diagram with no click statement gets no link or callback markup', () => {
      const svg = renderMermaidSVG(`classDiagram
        class Animal {
          +String name
          +eat() void
        }
        class Dog
        Animal <|-- Dog`)
      expect(svg).not.toContain('<a href=')
      expect(svg).not.toContain('data-click-callback')
      expect(svg).not.toContain('<title>')
      // The rest of the diagram still renders normally.
      expect(svg).toContain('Animal')
      expect(svg).toContain('Dog')
      expect(svg).toContain('cls-inherit')
    })

    it('a click on one class does not affect a sibling class without one', () => {
      const svg = renderMermaidSVG(`classDiagram
        class Animal
        class Dog
        click Animal "https://example.com"`)
      const dogGroup = svg
        .split('<g class="class-node"')
        .find((chunk) => chunk.includes('data-id="Dog"'))
      expect(dogGroup).toBeDefined()
      expect(dogGroup).not.toContain('<a href=')
    })
  })

  describe('gated by interactivity: none (#231)', () => {
    const WITH_HREF_AND_TOOLTIP =
      'classDiagram\n  class Animal\n  click Animal "https://example.com" "Helpful"'

    it('strips the <a href> link', () => {
      const svg = renderMermaidSVG(WITH_HREF_AND_TOOLTIP, {
        interactivity: 'none',
      })
      expect(svg).not.toContain('<a href=')
    })

    it('strips the <title> tooltip', () => {
      const svg = renderMermaidSVG(WITH_HREF_AND_TOOLTIP, {
        interactivity: 'none',
      })
      expect(svg).not.toContain('<title>Helpful</title>')
    })

    it('leaves the class box itself intact (id, label)', () => {
      const svg = renderMermaidSVG(WITH_HREF_AND_TOOLTIP, {
        interactivity: 'none',
      })
      expect(svg).toContain('data-id="Animal"')
      expect(svg).toContain('>Animal<')
    })

    it('emits nothing for a click callback at any level (never a link/tooltip, never an attribute)', () => {
      const svg = renderMermaidSVG(
        'classDiagram\n  class Animal\n  click Animal call handler()',
        { interactivity: 'none' },
      )
      expect(svg).not.toContain('data-click-callback')
      expect(svg).not.toContain('handler()')
    })

    it.each(['static', 'full'] as const)(
      'keeps the link and tooltip under interactivity: %s',
      (interactivity) => {
        const svg = renderMermaidSVG(WITH_HREF_AND_TOOLTIP, { interactivity })
        expect(svg).toContain('<a href=')
        expect(svg).toContain('<title>Helpful</title>')
      },
    )
  })
})
