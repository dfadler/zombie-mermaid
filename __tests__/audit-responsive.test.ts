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
})
