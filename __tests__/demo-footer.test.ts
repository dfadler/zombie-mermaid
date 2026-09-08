/**
 * Guards demo/components/footer.tsx against the design canvas it was
 * extracted from (#594, part of #591, part of the #590 redesign).
 *
 * Same contract as demo-design-tokens.test.ts and demo-primitives.test.ts:
 * the canvas — the `.dc.html` artboards published at the URL in #590's body —
 * is the source of truth and lives outside the repo, so nothing mechanical
 * can re-derive it. What this file can do is pin it. Every CANVAS_* constant
 * below is a transcription of what the sixteen "Diagram-Native Showcase"
 * artboards actually declare, and their footer section is byte-identical
 * across all sixteen, so a later edit that drifts a value, rewrites a link
 * label, or drops a breakpoint fails here rather than silently shipping
 * off-design markup. Update these expectations only alongside a canvas
 * change.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_FORK_NOTE,
  FOOTER_TAGLINE,
  FOOTER_WORDMARK,
  Footer,
  FooterMark,
  FooterStyle,
  footerCss,
  type FooterColumn,
} from '../demo/components/footer.tsx'

/** Renders a component to static HTML, the way the site's generators do. */
function render(
  component: Parameters<typeof createElement>[0],
  props: Record<string, unknown> = {},
): string {
  return renderToStaticMarkup(createElement(component, props))
}

/* -----------------------------------------------------------------
 * What the canvas declares
 * ----------------------------------------------------------------- */

/**
 * The footer's four columns exactly as the artboards spell them: a brand
 * block, then Product / Resources / Project. "MIT Licensed" is the one entry
 * the canvas renders as a `<span>` rather than an `<a>`.
 */
const CANVAS_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Diagrams', href: '#diagrams' },
      { label: 'Editor', href: '#editor' },
      { label: 'Fork fixes', href: '#fixes' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '#blog' },
      { label: 'GitHub', href: '#github' },
      { label: 'npm package', href: '#npm' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'MIT Licensed' },
      { label: 'dfadler/zombie-mermaid', href: '#github' },
    ],
  },
] satisfies FooterColumn[]

/** The brand block's two strings, verbatim. */
const CANVAS_BRAND = {
  wordmark: 'zombie-mermaid',
  tagline:
    'An open source library for rendering Mermaid diagrams, designed for the age of AI.',
}

/** The bottom bar's two lines, verbatim. */
const CANVAS_BOTTOM = {
  copyright: '© 2026 zombie-mermaid contributors. MIT licensed.',
  forkNote: 'Actively maintained fork of beautiful-mermaid.',
}

/**
 * The three responsive declarations from the artboards' shared
 * `<helmet><style>` preamble, plus the `.section-px` gutter rules the footer
 * wrapper depends on. Whitespace-normalised so the comparison is against the
 * declarations rather than the indentation.
 */
const CANVAS_RESPONSIVE = {
  900: [
    '.section-px { padding-left: 32px !important; padding-right: 32px !important; }',
    '.footer-grid { grid-template-columns: 1fr 1fr !important; }',
  ],
  600: [
    '.section-px { padding-left: 20px !important; padding-right: 20px !important; }',
    '.footer-grid { grid-template-columns: 1fr !important; }',
    '.footer-bottom-row { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }',
  ],
}

/** The footer's inline layout declarations, as the canvas writes them. */
const CANVAS_INLINE = [
  // Outer section.
  'padding:64px 80px 48px 80px',
  'border-top:1px solid var(--border)',
  'background:var(--bg-soft)',
  // Grid.
  'max-width:1280px',
  'grid-template-columns:2fr 1fr 1fr 1fr',
  'gap:48px',
  // Bottom row.
  'margin:40px auto 0 auto',
  'padding-top:24px',
  'justify-content:space-between',
]

/** Collapses a CSS block to one space-separated line, for comparison. */
function normalise(css: string): string {
  return css.replace(/\s+/g, ' ').trim()
}

/* -----------------------------------------------------------------
 * Content
 * ----------------------------------------------------------------- */

describe('footer content', () => {
  it('carries the canvas wordmark and tagline verbatim', () => {
    expect(FOOTER_WORDMARK).toBe(CANVAS_BRAND.wordmark)
    expect(FOOTER_TAGLINE).toBe(CANVAS_BRAND.tagline)
  })

  it('carries the canvas bottom-bar lines verbatim', () => {
    expect(FOOTER_COPYRIGHT).toBe(CANVAS_BOTTOM.copyright)
    expect(FOOTER_FORK_NOTE).toBe(CANVAS_BOTTOM.forkNote)
  })

  it('carries the three canvas columns, in order, with the canvas hrefs', () => {
    expect(FOOTER_COLUMNS).toEqual(CANVAS_COLUMNS)
  })

  it('leaves exactly the one canvas entry without an href', () => {
    const hrefless = FOOTER_COLUMNS.flatMap((column) =>
      column.links.filter((link) => link.href === undefined),
    )
    expect(hrefless).toEqual([{ label: 'MIT Licensed' }])
  })
})

/* -----------------------------------------------------------------
 * CSS
 * ----------------------------------------------------------------- */

describe('footerCss', () => {
  const css = normalise(footerCss())

  it('reproduces every canvas declaration at the 900px breakpoint', () => {
    for (const rule of CANVAS_RESPONSIVE[900]) {
      expect(css).toContain(rule)
    }
  })

  it('reproduces every canvas declaration at the 600px breakpoint', () => {
    for (const rule of CANVAS_RESPONSIVE[600]) {
      expect(css).toContain(rule)
    }
  })

  it('breaks at exactly the two canvas widths', () => {
    expect(footerCss().match(/@media/g)).toHaveLength(2)
    expect(css).toContain('@media (max-width: 900px)')
    expect(css).toContain('@media (max-width: 600px)')
  })

  it('collapses 4 columns to 2 before collapsing to 1', () => {
    const two = css.indexOf('grid-template-columns: 1fr 1fr !important')
    const one = css.indexOf('grid-template-columns: 1fr !important')
    expect(two).toBeGreaterThan(-1)
    expect(one).toBeGreaterThan(two)
  })

  it('stacks the bottom row only at the narrowest breakpoint', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 600px)'))
    const tablet = css.slice(
      css.indexOf('@media (max-width: 900px)'),
      css.indexOf('@media (max-width: 600px)'),
    )
    expect(mobile).toContain('.footer-bottom-row')
    expect(tablet).not.toContain('.footer-bottom-row')
  })

  it('wraps in a style element', () => {
    const html = render(FooterStyle)
    expect(html.startsWith('<style>')).toBe(true)
    expect(html).toContain('.footer-grid')
  })
})

/* -----------------------------------------------------------------
 * Mark
 * ----------------------------------------------------------------- */

describe('FooterMark', () => {
  it('draws the canvas mark at 22px by default', () => {
    const html = render(FooterMark)
    expect(html).toContain('width="22"')
    expect(html).toContain('height="22"')
    expect(html).toContain('viewBox="0 0 24 24"')
  })

  it('strokes the three shapes in the canvas accents', () => {
    const html = render(FooterMark)
    expect(html).toContain('stroke="var(--cyan)"')
    expect(html).toContain('stroke="var(--violet)"')
    expect(html).toContain('stroke="var(--pink)"')
    expect(html.match(/stroke-width="1.6"/g)).toHaveLength(3)
    expect(html).toContain(
      'd="M6.5 11 V16 a2 2 0 0 0 2 2 h7 a2 2 0 0 0 2-2 v-5"',
    )
  })

  it('resizes without redrawing, the way the nav uses it at 30px', () => {
    const html = render(FooterMark, { size: 30 })
    expect(html).toContain('width="30"')
    expect(html).toContain('viewBox="0 0 24 24"')
  })

  it('hides the mark from assistive tech, since the wordmark names it', () => {
    expect(render(FooterMark)).toContain('aria-hidden="true"')
  })
})

/* -----------------------------------------------------------------
 * Footer
 * ----------------------------------------------------------------- */

describe('Footer', () => {
  const html = render(Footer)

  it('renders a contentinfo landmark carrying the canvas gutter class', () => {
    expect(html.startsWith('<footer class="section-px"')).toBe(true)
    expect(html.endsWith('</footer>')).toBe(true)
  })

  it('renders the two hooks footerCss targets', () => {
    expect(html).toContain('class="footer-grid"')
    expect(html).toContain('class="footer-bottom-row"')
  })

  it('reproduces the canvas inline layout declarations', () => {
    for (const declaration of CANVAS_INLINE) {
      expect(html).toContain(declaration)
    }
  })

  it('renders the brand block, tagline measure included', () => {
    expect(html).toContain('>zombie-mermaid</span>')
    expect(html).toContain(CANVAS_BRAND.tagline)
    expect(html).toContain('max-width:320px')
    expect(html).toContain('line-height:1.6')
  })

  it('renders every canvas link with its canvas href', () => {
    for (const column of CANVAS_COLUMNS) {
      expect(html).toContain(`>${column.title}</p>`)
      for (const link of column.links) {
        if (link.href === undefined) continue
        expect(html).toContain(`href="${link.href}"`)
        expect(html).toContain(`>${link.label}</a>`)
      }
    }
  })

  it('renders the licence entry as text rather than a link', () => {
    expect(html).toContain('>MIT Licensed</span>')
    expect(html).not.toContain('>MIT Licensed</a>')
  })

  it('tracks the column headings at 0.08em, not the eyebrow 0.14em', () => {
    expect(html).toContain('letter-spacing:0.08em')
    expect(html).not.toContain('letter-spacing:0.14em')
  })

  it('renders both bottom-bar lines', () => {
    expect(html).toContain(CANVAS_BOTTOM.copyright)
    expect(html).toContain(CANVAS_BOTTOM.forkNote)
  })

  it('widens the grid to match a different number of columns', () => {
    const two = render(Footer, { columns: CANVAS_COLUMNS.slice(0, 2) })
    expect(two).toContain('grid-template-columns:2fr 1fr 1fr')
    expect(two).not.toContain('grid-template-columns:2fr 1fr 1fr 1fr')
    expect(two).not.toContain('>Project</p>')
  })

  it('lets a page override the canvas placeholder hrefs', () => {
    const real = render(Footer, {
      columns: [
        {
          title: 'Resources',
          links: [
            {
              label: 'GitHub',
              href: 'https://github.com/dfadler/zombie-mermaid',
            },
          ],
        },
      ],
    })
    expect(real).toContain('href="https://github.com/dfadler/zombie-mermaid"')
    expect(real).not.toContain('href="#github"')
  })

  it('lets a page override the brand and bottom-bar copy', () => {
    const custom = render(Footer, {
      wordmark: 'zm',
      tagline: 'Tagline.',
      copyright: '© 2027.',
      forkNote: 'Fork note.',
    })
    expect(custom).toContain('>zm</span>')
    expect(custom).toContain('Tagline.')
    expect(custom).toContain('© 2027.')
    expect(custom).toContain('Fork note.')
    expect(custom).not.toContain(CANVAS_BRAND.tagline)
  })

  it('appends a page class and merges a page style override', () => {
    const custom = render(Footer, {
      className: 'home-footer',
      style: { background: 'var(--bg)' },
    })
    expect(custom).toContain('class="section-px home-footer"')
    expect(custom).toContain('background:var(--bg)')
    expect(custom).not.toContain('background:var(--bg-soft)')
  })
})
