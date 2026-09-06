/**
 * Tests for the strict-CSP render options (GitHub issue #216):
 * `nonce` and `styleAttribute`, plus the `themeCssVariables()` helper.
 *
 * A host page whose `Content-Security-Policy` has a `style-src` without
 * `'unsafe-inline'` blocks both inline-style surfaces the renderer emits —
 * the `<style>` element(s) and the root `<svg style="--bg: …">` attribute —
 * and the diagram silently renders unstyled. A nonce can authorise the
 * former (elements) but never the latter (attributes), so the fix is two
 * complementary options:
 *
 *  - `nonce` → `nonce="…"` on every `<style>` element, attribute-escaped.
 *  - `styleAttribute: false` → no root `style=` attribute; the host puts
 *    the same declarations in its own stylesheet, which
 *    `themeCssVariables(options)` hands it verbatim.
 *
 * Covers every diagram type (flowchart, state, sequence, class, ER,
 * xychart), the extra `<style>` blocks (edge animation, xychart chart
 * styles), composition with `embedSource`/`title`/`data-xychart-colors`
 * root-tag post-processing, and that default output is unchanged when
 * neither option is set.
 */
import { describe, it, expect } from 'vitest'
import {
  svgOpenTag,
  styleOpenTag,
  buildStyleBlock,
  themeStyleDeclarations,
  THEMES,
} from '../theme.ts'
import type { DiagramColors } from '../theme.ts'
import { renderMermaidSVG, themeCssVariables } from '../index.ts'
import type { RenderOptions } from '../types.ts'

const colors: DiagramColors = { bg: '#FFFFFF', fg: '#27272A' }

// One fixture per diagram type. `flowchart-animated` renders a second
// `<style>` (the @keyframes block) under `interactivity: 'full'`; xychart
// always renders a second one (its chart-specific rules).
const FIXTURES: Record<string, { src: string; options?: RenderOptions }> = {
  flowchart: { src: 'graph TD\n  A --> B' },
  'flowchart-animated': {
    src: 'flowchart TD\n  A e1@--> B\n  e1@{ animate: true }',
    options: { interactivity: 'full' },
  },
  state: { src: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Done' },
  sequence: { src: 'sequenceDiagram\n  Alice->>Bob: Hello' },
  class: { src: 'classDiagram\n  class Animal\n  Animal <|-- Dog' },
  er: { src: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places' },
  xychart: {
    src: 'xychart-beta\n  x-axis [jan, feb]\n  y-axis "Revenue" 0 --> 120\n  bar [50, 60]',
  },
}

const fixtureEntries = Object.entries(FIXTURES)

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** The root `<svg …>` opening tag of a rendered document. */
function rootTag(svg: string): string {
  const end = svg.indexOf('>')
  expect(svg.startsWith('<svg ')).toBe(true)
  expect(end).toBeGreaterThan(0)
  return svg.slice(0, end + 1)
}

/** The value of the root tag's `style="…"` attribute, or undefined. */
function rootStyleAttr(svg: string): string | undefined {
  const match = / style="([^"]*)"/.exec(rootTag(svg))
  return match?.[1]
}

/** Parse `a:b;c:d` into a map so comparisons ignore ordering/whitespace. */
function parseDeclarations(css: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const decl of css.split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    out.set(decl.slice(0, idx).trim(), decl.slice(idx + 1).trim())
  }
  return out
}

// ============================================================================
// styleOpenTag / buildStyleBlock — unit behavior
// ============================================================================

describe('styleOpenTag', () => {
  it('emits a bare <style> with no nonce', () => {
    expect(styleOpenTag()).toBe('<style>')
    expect(styleOpenTag(undefined)).toBe('<style>')
  })

  it('treats an empty or whitespace-only nonce as unset', () => {
    expect(styleOpenTag('')).toBe('<style>')
    expect(styleOpenTag('   ')).toBe('<style>')
  })

  it('emits nonce="…" when given', () => {
    expect(styleOpenTag('abc123')).toBe('<style nonce="abc123">')
  })

  it('attribute-escapes the nonce so it cannot break out of the attribute', () => {
    const tag = styleOpenTag('a"b<c>&d')
    expect(tag).toBe('<style nonce="a&quot;b&lt;c&gt;&amp;d">')
    expect(tag).not.toContain('"b<')
  })
})

describe('buildStyleBlock – nonce', () => {
  it('opens with a plain <style> by default (unchanged output)', () => {
    expect(buildStyleBlock('Inter', false).startsWith('<style>\n')).toBe(true)
  })

  it('opens with a nonced <style> when a nonce is given', () => {
    const block = buildStyleBlock('Inter', true, 'abc123')
    expect(block.startsWith('<style nonce="abc123">\n')).toBe(true)
    expect(block.endsWith('</style>')).toBe(true)
  })
})

// ============================================================================
// themeStyleDeclarations / svgOpenTag — unit behavior
// ============================================================================

describe('themeStyleDeclarations', () => {
  it('builds the compact declaration list with background', () => {
    expect(themeStyleDeclarations(colors)).toBe(
      '--bg:#FFFFFF;--fg:#27272A;background:var(--bg)',
    )
  })

  it('omits background when transparent', () => {
    expect(themeStyleDeclarations(colors, true)).toBe(
      '--bg:#FFFFFF;--fg:#27272A',
    )
  })

  it('includes only the enrichment variables that are set', () => {
    const decl = themeStyleDeclarations({
      ...colors,
      line: '#111',
      accent: '#222',
    })
    expect(decl).toBe(
      '--bg:#FFFFFF;--fg:#27272A;--line:#111;--accent:#222;background:var(--bg)',
    )
    expect(decl).not.toContain('--muted')
    expect(decl).not.toContain('--surface')
    expect(decl).not.toContain('--border')
  })
})

describe('svgOpenTag – styleAttribute', () => {
  it('carries the theme declarations in style="…" by default', () => {
    const tag = svgOpenTag(400, 300, colors)
    expect(tag).toContain(
      ' style="--bg:#FFFFFF;--fg:#27272A;background:var(--bg)">',
    )
  })

  it('is byte-identical whether styleAttribute is omitted or explicitly true', () => {
    // No `title`: a titled tag mints a fresh zm-title-N id per call.
    expect(
      svgOpenTag(400, 300, colors, false, undefined, false, false, true),
    ).toBe(svgOpenTag(400, 300, colors, false, undefined, false, false))
  })

  it('drops only the style attribute when styleAttribute is false', () => {
    const tag = svgOpenTag(400, 300, colors, false, 'T', false, false, false)
    expect(tag).not.toContain(' style=')
    expect(tag).not.toContain('--bg')
    expect(tag).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(tag).toContain('viewBox="0 0 400 300"')
    expect(tag).toContain('width="400" height="300"')
    expect(tag).toContain('role="img"')
    expect(tag).toMatch(/aria-labelledby="zm-title-\d+"/)
    expect(tag).toContain('<title id="zm-title-')
    // The tag still closes cleanly right after the a11y attributes.
    expect(tag).toMatch(/aria-labelledby="zm-title-\d+">/)
  })

  it('keeps aria-hidden when decorative and styleAttribute is false', () => {
    const tag = svgOpenTag(10, 10, colors, false, undefined, true, false, false)
    expect(tag).toContain(' aria-hidden="true">')
    expect(tag).not.toContain(' style=')
  })
})

// ============================================================================
// renderMermaidSVG – nonce across every diagram type
// ============================================================================

describe('renderMermaidSVG – nonce', () => {
  it.each(fixtureEntries)(
    '%s: every <style> element carries the nonce, and nothing else does',
    (_name, { src, options }) => {
      const svg = renderMermaidSVG(src, { ...options, nonce: 'abc123' })
      const styles = count(svg, '<style')
      expect(styles).toBeGreaterThan(0)
      expect(count(svg, 'nonce="abc123"')).toBe(styles)
      expect(count(svg, '<style nonce="abc123">')).toBe(styles)
      // No <style> left un-nonced — one is enough to lose the diagram.
      expect(svg).not.toContain('<style>')
    },
  )

  it.each(fixtureEntries)(
    '%s: emits no nonce attribute by default',
    (_name, { src, options }) => {
      const svg = renderMermaidSVG(src, options)
      expect(svg).not.toContain('nonce=')
      expect(count(svg, '<style>')).toBe(count(svg, '<style'))
    },
  )

  it('reaches the second <style> (edge @keyframes) on an animated flowchart', () => {
    const { src, options } = FIXTURES['flowchart-animated']!
    const svg = renderMermaidSVG(src, { ...options, nonce: 'abc123' })
    expect(svg).toContain('@keyframes zm-edge-dash')
    expect(count(svg, '<style')).toBe(2)
    expect(count(svg, '<style nonce="abc123">')).toBe(2)
  })

  it('reaches the second <style> (chart rules) on an xychart', () => {
    const { src } = FIXTURES['xychart']!
    const svg = renderMermaidSVG(src, { nonce: 'abc123' })
    expect(svg).toContain('.xychart-grid')
    expect(count(svg, '<style')).toBe(2)
    expect(count(svg, '<style nonce="abc123">')).toBe(2)
  })

  it('attribute-escapes the nonce in rendered output', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', {
      nonce: 'x"><script>alert(1)</script>',
    })
    expect(svg).toContain(
      '<style nonce="x&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">',
    )
    expect(svg).not.toContain('<script>')
  })

  it('treats an empty nonce as unset', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', { nonce: '' })
    expect(svg).not.toContain('nonce=')
    expect(svg).toBe(renderMermaidSVG('graph TD\n  A --> B'))
  })
})

// ============================================================================
// renderMermaidSVG – styleAttribute across every diagram type
// ============================================================================

describe('renderMermaidSVG – styleAttribute: false', () => {
  it.each(fixtureEntries)(
    '%s: removes the root style attribute and nothing else',
    (_name, { src, options }) => {
      const withAttr = renderMermaidSVG(src, {
        ...options,
        embedSource: true,
        title: 'Named diagram',
      })
      const without = renderMermaidSVG(src, {
        ...options,
        embedSource: true,
        title: 'Named diagram',
        styleAttribute: false,
      })

      expect(rootStyleAttr(withAttr)).toBe(
        '--bg:#FFFFFF;--fg:#27272A;background:var(--bg)',
      )
      expect(rootStyleAttr(without)).toBeUndefined()

      const tag = rootTag(without)
      expect(tag).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(tag).toMatch(/viewBox="0 0 \d+(\.\d+)? \d+(\.\d+)?"/)
      expect(tag).toMatch(/width="\d+(\.\d+)?" height="\d+(\.\d+)?"/)
      expect(tag).toContain('role="img"')
      expect(tag).toMatch(/aria-labelledby="zm-title-\d+"/)
      expect(tag).toContain('data-src="')

      // Everything after the root tag is unchanged — the option touches
      // only the opening tag. (The title id counter differs per render, so
      // normalise it before comparing.)
      const body = (s: string) =>
        s.slice(s.indexOf('>') + 1).replace(/zm-title-\d+/g, 'zm-title-N')
      expect(body(without)).toBe(body(withAttr))
    },
  )

  it('xychart keeps data-xychart-colors on the root tag', () => {
    const { src } = FIXTURES['xychart']!
    const tag = rootTag(renderMermaidSVG(src, { styleAttribute: false }))
    expect(tag).toMatch(/data-xychart-colors="\d+"/)
    expect(tag).not.toContain(' style=')
  })

  it('leaves a per-node font-family style attribute alone (only the root is affected)', () => {
    const src = 'graph TD\n  A --> B\n  style A font-family:Georgia'
    const svg = renderMermaidSVG(src, { styleAttribute: false })
    expect(rootStyleAttr(svg)).toBeUndefined()
    expect(svg).toContain('style="font-family: Georgia;"')
  })

  it('still emits the <style> block — only the attribute goes', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', {
      styleAttribute: false,
    })
    expect(svg).toContain('<style>')
    expect(svg).toContain('--_text:')
  })

  it('composes with nonce: nonced <style>, no root style attribute', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', {
      nonce: 'abc123',
      styleAttribute: false,
    })
    expect(rootStyleAttr(svg)).toBeUndefined()
    expect(count(svg, '<style nonce="abc123">')).toBe(count(svg, '<style'))
  })
})

// ============================================================================
// themeCssVariables — the host-side replacement for the attribute
// ============================================================================

describe('themeCssVariables', () => {
  const OPTION_SETS: Array<[string, RenderOptions]> = [
    ['defaults', {}],
    ['transparent', { transparent: true }],
    ['two colours', { bg: '#1a1b26', fg: '#a9b1d6' }],
    [
      'fully enriched',
      {
        bg: '#111',
        fg: '#eee',
        line: '#222',
        accent: '#333',
        muted: '#444',
        surface: '#555',
        border: '#666',
      },
    ],
    ['tokyo-night theme', { ...THEMES['tokyo-night'] }],
    [
      'CSS variable references',
      { bg: 'var(--background)', fg: 'var(--foreground)', transparent: true },
    ],
  ]

  it.each(OPTION_SETS)(
    '%s: returns exactly the declarations the root style attribute carries',
    (_name, options) => {
      const svg = renderMermaidSVG('graph TD\n  A --> B', options)
      const attr = rootStyleAttr(svg)
      expect(attr).toBeDefined()
      const helper = themeCssVariables(options)
      expect(helper).toBe(attr)
      expect(parseDeclarations(helper)).toEqual(parseDeclarations(attr ?? ''))
    },
  )

  it('matches across every diagram type for the same options', () => {
    const options: RenderOptions = { ...THEMES['tokyo-night'] }
    const expected = themeCssVariables(options)
    for (const [, { src, options: extra }] of fixtureEntries) {
      const svg = renderMermaidSVG(src, { ...extra, ...options })
      expect(rootStyleAttr(svg)).toBe(expected)
    }
  })

  it('always includes --bg and --fg, defaulting them like the renderer does', () => {
    const decl = parseDeclarations(themeCssVariables())
    expect(decl.get('--bg')).toBe('#FFFFFF')
    expect(decl.get('--fg')).toBe('#27272A')
    expect(decl.get('background')).toBe('var(--bg)')
  })

  it('is usable inside a host rule block', () => {
    const css = `.diagram svg { ${themeCssVariables({ bg: '#000', fg: '#fff' })} }`
    expect(css).toBe(
      '.diagram svg { --bg:#000;--fg:#fff;background:var(--bg) }',
    )
  })
})

// ============================================================================
// Defaults unchanged
// ============================================================================

describe('default output is unchanged when neither option is set', () => {
  it.each(fixtureEntries)(
    '%s: omitting both options equals passing their defaults explicitly',
    (_name, { src, options }) => {
      const implicit = renderMermaidSVG(src, options)
      const explicit = renderMermaidSVG(src, {
        ...options,
        nonce: undefined,
        styleAttribute: true,
      })
      // Title ids are per-process counters, but these fixtures set none.
      expect(explicit).toBe(implicit)
    },
  )

  it.each(fixtureEntries)(
    '%s: root tag and <style> opener keep their pre-#216 shape',
    (_name, { src, options }) => {
      const svg = renderMermaidSVG(src, options)
      const tag = rootTag(svg)
      // xychart splices `data-xychart-colors` in front of xmlns, so check
      // for the attribute run rather than a fixed prefix.
      expect(tag).toContain('xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ')
      expect(
        tag.endsWith(
          ' style="--bg:#FFFFFF;--fg:#27272A;background:var(--bg)">',
        ),
      ).toBe(true)
      expect(tag).not.toContain('nonce')
      // The theme block immediately follows the root tag, un-nonced.
      expect(svg.slice(tag.length)).toMatch(/^\n<style>\n/)
    },
  )
})
