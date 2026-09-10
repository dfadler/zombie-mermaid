// @vitest-environment jsdom
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
 *
 * Per docs/testing-conventions.md's "design-canvas fidelity checks" section
 * (#824, part of the #815/#817 RTL migration), the fidelity requirement
 * itself does not change here — only the query mechanism does. The footer
 * has no interactive elements (no state, no event handlers), so this stays a
 * pure query-style conversion: every assertion below now renders into a
 * real (jsdom) DOM via `@testing-library/react`'s `render()` and reads
 * literal values off real nodes — `getByRole('link', …)`/`getByText(…)`
 * plus direct `element.style`/`getAttribute` reads — instead of matching
 * strings/regexes against a `renderToStaticMarkup` HTML blob. The one
 * exception is `footerCss()` itself: it returns a plain CSS string with no
 * component to render, so its declarations are still asserted directly
 * against that string — there is no DOM for an RTL query to target.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
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

/** The brand block's two strings. Wordmark rebranded; tagline still verbatim. */
const CANVAS_BRAND = {
  wordmark: 'ZombieMermaid',
  tagline:
    'An open source library for rendering Mermaid diagrams, designed for the age of AI.',
}

/** The bottom bar's two lines. Copyright rebranded; fork note still verbatim. */
const CANVAS_BOTTOM = {
  copyright: '© 2026 ZombieMermaid contributors. MIT licensed.',
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

/**
 * The footer's inline layout declarations, as the canvas writes them —
 * longhand where a shorthand (`padding`, `margin`) would otherwise force the
 * comparison through jsdom's own CSSOM shorthand serialization (e.g. a
 * 4-value `padding` with equal left/right collapses to jsdom's canonical
 * 3-value form) rather than the literal per-side values below.
 */
const CANVAS_INLINE = {
  outer: {
    paddingTop: '64px',
    paddingRight: '80px',
    paddingBottom: '48px',
    paddingLeft: '80px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-soft)',
  },
  grid: {
    maxWidth: '1280px',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    gap: '48px',
  },
  bottomRow: {
    marginTop: '40px',
    marginRight: 'auto',
    marginBottom: '0px',
    marginLeft: 'auto',
    paddingTop: '24px',
    justifyContent: 'space-between',
  },
}

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

  // footerCss() returns a plain CSS string, not a component — there is no
  // rendered DOM for an RTL query to target, so these stay literal string
  // assertions against that returned string (see the file header comment).
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
    const { container } = render(createElement(FooterStyle))
    expect(container.children).toHaveLength(1)
    const style = container.firstElementChild
    expect(style?.tagName).toBe('STYLE')
    expect(style?.textContent).toContain('.footer-grid')
  })
})

/* -----------------------------------------------------------------
 * Mark
 * ----------------------------------------------------------------- */

describe('FooterMark', () => {
  // FooterMark is `aria-hidden`, which removes it from the accessibility
  // tree entirely — `getByRole` cannot reach it (confirmed below), so a
  // direct node query is the RTL-appropriate substitute here, not a regex
  // over serialized markup.
  it('draws the canvas mark at 22px by default', () => {
    const { container } = render(createElement(FooterMark))
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '22')
    expect(svg).toHaveAttribute('height', '22')
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
  })

  it('strokes the three shapes in the canvas accents', () => {
    const { container } = render(createElement(FooterMark))
    const [rectCyan, rectViolet] = container.querySelectorAll('rect')
    const path = container.querySelector('path')
    expect(rectCyan).toHaveAttribute('stroke', 'var(--cyan)')
    expect(rectViolet).toHaveAttribute('stroke', 'var(--violet)')
    expect(path).toHaveAttribute('stroke', 'var(--pink)')
    expect(container.querySelectorAll('[stroke-width="1.6"]')).toHaveLength(3)
    expect(path).toHaveAttribute(
      'd',
      'M6.5 11 V16 a2 2 0 0 0 2 2 h7 a2 2 0 0 0 2-2 v-5',
    )
  })

  it('resizes without redrawing, the way the nav uses it at 30px', () => {
    const { container } = render(createElement(FooterMark, { size: 30 }))
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '30')
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
  })

  it('hides the mark from assistive tech, since the wordmark names it', () => {
    const { container } = render(createElement(FooterMark))
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.queryByRole('img')).toBeNull()
  })
})

/* -----------------------------------------------------------------
 * Footer
 * ----------------------------------------------------------------- */

describe('Footer', () => {
  it('renders a contentinfo landmark carrying the canvas gutter class', () => {
    render(createElement(Footer))
    const footer = screen.getByRole('contentinfo')
    expect(footer.tagName).toBe('FOOTER')
    expect(footer.className).toBe('section-px')
  })

  it('renders the two hooks footerCss targets', () => {
    const { container } = render(createElement(Footer))
    expect(container.querySelector('.footer-grid')).not.toBeNull()
    expect(container.querySelector('.footer-bottom-row')).not.toBeNull()
  })

  it('reproduces the canvas inline layout declarations', () => {
    const { container } = render(createElement(Footer))
    const footer = screen.getByRole('contentinfo')
    const grid = container.querySelector('.footer-grid') as HTMLElement
    const bottomRow = container.querySelector(
      '.footer-bottom-row',
    ) as HTMLElement

    expect(footer.style.paddingTop).toBe(CANVAS_INLINE.outer.paddingTop)
    expect(footer.style.paddingRight).toBe(CANVAS_INLINE.outer.paddingRight)
    expect(footer.style.paddingBottom).toBe(CANVAS_INLINE.outer.paddingBottom)
    expect(footer.style.paddingLeft).toBe(CANVAS_INLINE.outer.paddingLeft)
    expect(footer.style.borderTop).toBe(CANVAS_INLINE.outer.borderTop)
    expect(footer.style.background).toBe(CANVAS_INLINE.outer.background)

    expect(grid.style.maxWidth).toBe(CANVAS_INLINE.grid.maxWidth)
    expect(grid.style.gridTemplateColumns).toBe(
      CANVAS_INLINE.grid.gridTemplateColumns,
    )
    expect(grid.style.gap).toBe(CANVAS_INLINE.grid.gap)

    expect(bottomRow.style.marginTop).toBe(CANVAS_INLINE.bottomRow.marginTop)
    expect(bottomRow.style.marginRight).toBe(
      CANVAS_INLINE.bottomRow.marginRight,
    )
    expect(bottomRow.style.marginBottom).toBe(
      CANVAS_INLINE.bottomRow.marginBottom,
    )
    expect(bottomRow.style.marginLeft).toBe(CANVAS_INLINE.bottomRow.marginLeft)
    expect(bottomRow.style.paddingTop).toBe(CANVAS_INLINE.bottomRow.paddingTop)
    expect(bottomRow.style.justifyContent).toBe(
      CANVAS_INLINE.bottomRow.justifyContent,
    )
  })

  it('renders the brand block, tagline measure included', () => {
    render(createElement(Footer))
    expect(screen.getByText(FOOTER_WORDMARK).tagName).toBe('SPAN')
    const tagline = screen.getByText(CANVAS_BRAND.tagline)
    expect(tagline.style.maxWidth).toBe('320px')
    expect(tagline.style.lineHeight).toBe('1.6')
  })

  it('renders every canvas link with its canvas href', () => {
    render(createElement(Footer))
    for (const column of CANVAS_COLUMNS) {
      expect(screen.getByText(column.title)).toBeInTheDocument()
      for (const link of column.links) {
        if (link.href === undefined) continue
        expect(screen.getByRole('link', { name: link.label })).toHaveAttribute(
          'href',
          link.href,
        )
      }
    }
  })

  it('renders the licence entry as text rather than a link', () => {
    render(createElement(Footer))
    expect(screen.getByText('MIT Licensed').tagName).toBe('SPAN')
    expect(screen.queryByRole('link', { name: 'MIT Licensed' })).toBeNull()
  })

  it('tracks the column headings at 0.08em, not the eyebrow 0.14em', () => {
    render(createElement(Footer))
    for (const column of CANVAS_COLUMNS) {
      const heading = screen.getByText(column.title)
      expect(heading.style.letterSpacing).toBe('0.08em')
      expect(heading.style.letterSpacing).not.toBe('0.14em')
    }
  })

  it('renders both bottom-bar lines', () => {
    render(createElement(Footer))
    expect(screen.getByText(CANVAS_BOTTOM.copyright)).toBeInTheDocument()
    expect(screen.getByText(CANVAS_BOTTOM.forkNote)).toBeInTheDocument()
  })

  it('widens the grid to match a different number of columns', () => {
    const { container } = render(
      createElement(Footer, { columns: CANVAS_COLUMNS.slice(0, 2) }),
    )
    const grid = container.querySelector('.footer-grid') as HTMLElement
    expect(grid.style.gridTemplateColumns).toBe('2fr 1fr 1fr')
    expect(screen.queryByText('Project')).toBeNull()
  })

  it('lets a page override the canvas placeholder hrefs', () => {
    render(
      createElement(Footer, {
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
      }),
    )
    const link = screen.getByRole('link', { name: 'GitHub' })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/dfadler/zombie-mermaid',
    )
    // The whole `columns` prop is replaced, not merged, so no stray
    // placeholder link from FOOTER_COLUMNS should also be present.
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('lets a page override the brand and bottom-bar copy', () => {
    render(
      createElement(Footer, {
        wordmark: 'zm',
        tagline: 'Tagline.',
        copyright: '© 2027.',
        forkNote: 'Fork note.',
      }),
    )
    expect(screen.getByText('zm')).toBeInTheDocument()
    expect(screen.getByText('Tagline.')).toBeInTheDocument()
    expect(screen.getByText('© 2027.')).toBeInTheDocument()
    expect(screen.getByText('Fork note.')).toBeInTheDocument()
    expect(screen.queryByText(CANVAS_BRAND.tagline)).toBeNull()
  })

  it('appends a page class and merges a page style override', () => {
    render(
      createElement(Footer, {
        className: 'home-footer',
        style: { background: 'var(--bg)' },
      }),
    )
    const footer = screen.getByRole('contentinfo')
    expect(footer.className).toBe('section-px home-footer')
    expect(footer.style.background).toBe('var(--bg)')
  })
})
