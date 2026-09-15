// @vitest-environment jsdom
/**
 * Unit tests for scripts/audit-responsive.ts's pure/DOM-only pieces: argv
 * parsing, the overflow-flagging rule (including its element-description
 * output — `describeElement` is nested inside `findOverflowingElements`
 * rather than exported separately, see that function's header comment, so
 * it's exercised here only through `findOverflowingElements`'s `selector`
 * field), and report formatting. `findOverflowingElements` is exercised
 * under jsdom rather than a real browser — it only touches ambient
 * `document`/`window` globals, which is exactly what lets the same
 * function also run unmodified inside Playwright's `page.evaluate()` — but
 * jsdom does no real layout, so `scrollWidth`/`clientWidth` are stubbed
 * per-element via `Object.defineProperty` rather than relying on measured
 * layout.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BASE_URL,
  DEFAULT_HEIGHT,
  DEFAULT_PAGES,
  DEFAULT_THEME_PAGES,
  DEFAULT_THEME_WIDTHS,
  DEFAULT_THEMES,
  DEFAULT_TOLERANCE_PX,
  DEFAULT_WIDTHS,
  findOverflowingElements,
  formatReport,
  parseArgs,
  type PageWidthResult,
} from '../scripts/audit-responsive.ts'

/** Stubs `scrollWidth`/`clientWidth` on `el`, since jsdom never lays out real values. */
function setOverflowMetrics(
  el: Element,
  metrics: { scrollWidth: number; clientWidth: number },
): void {
  Object.defineProperty(el, 'scrollWidth', {
    value: metrics.scrollWidth,
    configurable: true,
  })
  Object.defineProperty(el, 'clientWidth', {
    value: metrics.clientWidth,
    configurable: true,
  })
}

describe('parseArgs', () => {
  it('returns defaults when given no flags', () => {
    expect(parseArgs([])).toEqual({
      baseUrl: DEFAULT_BASE_URL,
      pages: DEFAULT_PAGES,
      widths: DEFAULT_WIDTHS,
      height: DEFAULT_HEIGHT,
      tolerancePx: DEFAULT_TOLERANCE_PX,
      screenshotDir: null,
      outPath: null,
      exitZero: false,
      themes: DEFAULT_THEMES,
      themePages: DEFAULT_THEME_PAGES,
      themeWidths: DEFAULT_THEME_WIDTHS,
      skipThemeCheck: false,
    })
  })

  it('parses every flag when given', () => {
    const options = parseArgs([
      '--base-url=http://localhost:3462',
      '--pages=/,/editor',
      '--widths=320,1024',
      '--height=800',
      '--tolerance=2',
      '--screenshot-dir=/tmp/shots',
      '--out=/tmp/report.json',
      '--exit-zero',
      '--themes=nord,one-dark',
      '--theme-pages=/,/diagrams',
      '--theme-widths=320,414',
      '--skip-theme-check',
    ])

    expect(options).toEqual({
      baseUrl: 'http://localhost:3462',
      pages: ['/', '/editor'],
      widths: [320, 1024],
      height: 800,
      tolerancePx: 2,
      screenshotDir: '/tmp/shots',
      outPath: '/tmp/report.json',
      exitZero: true,
      themes: ['nord', 'one-dark'],
      themePages: ['/', '/diagrams'],
      themeWidths: [320, 414],
      skipThemeCheck: true,
    })
  })

  it('drops non-finite/non-positive widths rather than passing them through', () => {
    const options = parseArgs(['--widths=375,notanumber,-10,0,768'])
    expect(options.widths).toEqual([375, 768])
  })

  it('trims whitespace and drops empty entries from --pages', () => {
    const options = parseArgs(['--pages= / , /editor ,,'])
    expect(options.pages).toEqual(['/', '/editor'])
  })

  it('trims whitespace and drops empty entries from --themes', () => {
    const options = parseArgs(['--themes= dracula , github-light ,,'])
    expect(options.themes).toEqual(['dracula', 'github-light'])
  })

  it('drops non-finite/non-positive widths from --theme-widths', () => {
    const options = parseArgs(['--theme-widths=375,notanumber,-10,0,480'])
    expect(options.themeWidths).toEqual([375, 480])
  })
})

describe('findOverflowingElements', () => {
  it('flags an element whose scrollWidth exceeds clientWidth with no scrollable ancestor', () => {
    document.body.innerHTML = '<div id="culprit">too wide</div>'
    const el = document.getElementById('culprit')!
    setOverflowMetrics(el, { scrollWidth: 500, clientWidth: 300 })

    const findings = findOverflowingElements()

    expect(findings).toEqual([
      {
        selector: '#culprit',
        tag: 'div',
        scrollWidth: 500,
        clientWidth: 300,
        overflowPx: 200,
      },
    ])
  })

  it('does not flag an element that is itself a working horizontal-scroll container', () => {
    // The false-positive lesson from zombie-mermaid#1032: a code panel with
    // overflow-x: auto legitimately has scrollWidth > clientWidth on itself.
    document.body.innerHTML = '<pre id="code-panel">a very long line</pre>'
    const el = document.getElementById('code-panel')!
    el.style.overflowX = 'auto'
    setOverflowMetrics(el, { scrollWidth: 900, clientWidth: 400 })

    expect(findOverflowingElements()).toEqual([])
  })

  it('does not flag an element whose ancestor already handles the overflow', () => {
    document.body.innerHTML =
      '<div id="scroller"><span id="content">wide content</span></div>'
    const scroller = document.getElementById('scroller')!
    const content = document.getElementById('content')!
    scroller.style.overflowX = 'scroll'
    setOverflowMetrics(content, { scrollWidth: 900, clientWidth: 400 })
    // The scroller itself isn't overflowing relative to its own box.
    setOverflowMetrics(scroller, { scrollWidth: 400, clientWidth: 400 })

    expect(findOverflowingElements()).toEqual([])
  })

  it('does not flag overflow within the configured tolerance', () => {
    document.body.innerHTML = '<div id="close-enough"></div>'
    const el = document.getElementById('close-enough')!
    setOverflowMetrics(el, { scrollWidth: 301, clientWidth: 300 })

    expect(findOverflowingElements(1)).toEqual([])
    expect(findOverflowingElements(0)).toHaveLength(1)
  })

  it('does not flag a visually-hidden (sr-only) element clipped to a near-zero, out-of-flow box', () => {
    // The false-positive lesson from zombie-mermaid#1055: `demo/styles.css`'s
    // `.visually-hidden` (and the equivalent inline style in
    // `demo/components/slot-number.tsx`) intentionally clips an element's
    // rendered box to 1x1px via `position: absolute` + `overflow: hidden` +
    // `clip: rect(0, 0, 0, 0)`, while `scrollWidth` still reflects its full
    // (never-rendered) text content — by design, the same as any sr-only
    // utility class. That mismatch can never be visible, so it must not be
    // flagged.
    document.body.innerHTML = '<span id="sr-only-value">334</span>'
    const el = document.getElementById('sr-only-value')!
    el.style.position = 'absolute'
    setOverflowMetrics(el, { scrollWidth: 67, clientWidth: 1 })
    Object.defineProperty(el, 'clientHeight', { value: 1, configurable: true })

    expect(findOverflowingElements()).toEqual([])
  })

  it('still flags an out-of-flow element whose own box is not clipped to near-zero', () => {
    // Guards against over-broadening the #1055 exception to every
    // `position: absolute` element — only a near-zero *box* (both
    // dimensions) is exempt, since that's the trait that guarantees nothing
    // renders. A normally-sized absolutely-positioned element (e.g. a
    // mispositioned tooltip or panel) with real overflow is still a bug.
    document.body.innerHTML = '<div id="mispositioned-panel"></div>'
    const el = document.getElementById('mispositioned-panel')!
    el.style.position = 'absolute'
    setOverflowMetrics(el, { scrollWidth: 500, clientWidth: 300 })
    Object.defineProperty(el, 'clientHeight', { value: 40, configurable: true })

    expect(findOverflowingElements()).toHaveLength(1)
  })

  it('does not flag overflow absorbed by a decorative full-bleed overlay ancestor (#1057)', () => {
    // The false-positive lesson from zombie-mermaid#1057:
    // demo/components/nav-css.ts's `.mobile-watermark` box (`position:
    // absolute; inset: 0; overflow: hidden; pointer-events: none`) wraps a
    // rotated, off-edge decorative mark so it -- not the outer nav panel --
    // absorbs the mark's pre-clip scrollWidth, with zero rendered
    // difference. jsdom doesn't expand the `inset` shorthand into its
    // top/right/bottom/left longhands the way a real browser's
    // getComputedStyle does (verified directly against jsdom), so the
    // longhands are set individually here to simulate what Chromium
    // actually reports for `inset: 0`.
    document.body.innerHTML =
      '<div id="overlay"><span id="mark">rotated mark</span></div>'
    const overlay = document.getElementById('overlay')!
    const mark = document.getElementById('mark')!
    overlay.style.position = 'absolute'
    overlay.style.top = '0px'
    overlay.style.right = '0px'
    overlay.style.bottom = '0px'
    overlay.style.left = '0px'
    overlay.style.overflowX = 'hidden'
    overlay.style.pointerEvents = 'none'
    setOverflowMetrics(mark, { scrollWidth: 434, clientWidth: 375 })
    // The overlay's own box isn't overflowing relative to itself.
    setOverflowMetrics(overlay, { scrollWidth: 375, clientWidth: 375 })

    expect(findOverflowingElements()).toEqual([])
  })

  it('still flags overflow within a plain overflow:hidden ancestor missing the full decorative-overlay signal', () => {
    // Guards against over-broadening the #1057 exception to every
    // `overflow: hidden` ancestor: a container that's actually cutting off
    // real, meaningful content (no `pointer-events: none`, not a full-bleed
    // `inset: 0` overlay) must still be flagged -- that's exactly the
    // class of bug this audit exists to catch, and a naive "treat hidden
    // like auto/scroll" fix would have silently suppressed it.
    document.body.innerHTML =
      '<div id="clipped-content"><span id="text">important text</span></div>'
    const clipper = document.getElementById('clipped-content')!
    const text = document.getElementById('text')!
    clipper.style.overflowX = 'hidden'
    setOverflowMetrics(text, { scrollWidth: 500, clientWidth: 300 })
    setOverflowMetrics(clipper, { scrollWidth: 300, clientWidth: 300 })

    expect(findOverflowingElements()).toHaveLength(1)
  })

  it('still flags overflow within an inset:0 overflow:hidden ancestor that is not pointer-events:none', () => {
    // Same #1057 guard from the interactive-content angle: a full-bleed
    // absolutely-positioned overlay that *can* receive pointer input is not
    // presumed decorative, so it's still flagged.
    document.body.innerHTML =
      '<div id="overlay"><span id="content">clickable content</span></div>'
    const overlay = document.getElementById('overlay')!
    const content = document.getElementById('content')!
    overlay.style.position = 'absolute'
    overlay.style.top = '0px'
    overlay.style.right = '0px'
    overlay.style.bottom = '0px'
    overlay.style.left = '0px'
    overlay.style.overflowX = 'hidden'
    setOverflowMetrics(content, { scrollWidth: 500, clientWidth: 300 })
    setOverflowMetrics(overlay, { scrollWidth: 300, clientWidth: 300 })

    expect(findOverflowingElements()).toHaveLength(1)
  })

  it('handles an SVG element (SVGAnimatedString className) without throwing', () => {
    document.body.innerHTML =
      '<svg id="diagram"><rect class="node-shape" /></svg>'
    const rect = document.querySelector('rect')!
    setOverflowMetrics(rect, { scrollWidth: 500, clientWidth: 100 })

    const findings = findOverflowingElements()

    expect(findings).toHaveLength(1)
    expect(findings[0]!.selector).not.toContain('[object')
  })
})

describe('findOverflowingElements selector output', () => {
  it('prefers an id', () => {
    document.body.innerHTML = '<div id="foo" class="bar"></div>'
    setOverflowMetrics(document.getElementById('foo')!, {
      scrollWidth: 500,
      clientWidth: 300,
    })
    expect(findOverflowingElements()[0]!.selector).toBe('#foo')
  })

  it('falls back to tag.class when there is no id', () => {
    document.body.innerHTML = '<div class="a b"></div>'
    setOverflowMetrics(document.querySelector('div')!, {
      scrollWidth: 500,
      clientWidth: 300,
    })
    expect(findOverflowingElements()[0]!.selector).toBe('div.a.b')
  })

  it('falls back to a nth-of-type path when there is no id or class', () => {
    document.body.innerHTML = '<section><span></span><span></span></section>'
    const secondSpan = document.querySelectorAll('span')[1]!
    setOverflowMetrics(secondSpan, { scrollWidth: 500, clientWidth: 300 })
    expect(findOverflowingElements()[0]!.selector).toBe(
      'section > span:nth-of-type(2)',
    )
  })
})

describe('formatReport', () => {
  it('reports OK with zero findings', () => {
    const results: PageWidthResult[] = [{ page: '/', width: 375, findings: [] }]
    const report = formatReport(results)
    expect(report).toContain('ok')
    expect(report).toContain('OK: no unhandled horizontal overflow found.')
  })

  it('reports FAIL with a total count across combinations', () => {
    const results: PageWidthResult[] = [
      {
        page: '/editor',
        width: 375,
        findings: [
          {
            selector: '.wide-panel',
            tag: 'div',
            scrollWidth: 500,
            clientWidth: 300,
            overflowPx: 200,
          },
        ],
      },
      { page: '/', width: 375, findings: [] },
    ]
    const report = formatReport(results)
    expect(report).toContain('1 finding(s)')
    expect(report).toContain('.wide-panel')
    expect(report).toContain(
      'FAIL: 1 unhandled overflow finding(s) across 2 page/width combination(s).',
    )
  })

  it('labels a theme spot-check result with the active theme', () => {
    const results: PageWidthResult[] = [
      { page: '/', width: 414, findings: [], theme: 'dracula' },
    ]
    const report = formatReport(results)
    expect(report).toContain('(theme: dracula)')
  })
})
