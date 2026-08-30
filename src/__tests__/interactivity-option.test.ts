/**
 * Tests for `RenderOptions.interactivity` (#216, #231): the render-target-
 * scoped replacement for the xychart-only `interactive` boolean, wired into
 * flowchart edge animation (`e1@{ animate: true }`), `click`-based links/
 * tooltips, and xychart hover tooltips. See
 * docs/decisions/no-script-interactivity.md for the tier model this maps
 * to, and `interactivity`'s TSDoc in src/types.ts for the exact per-level
 * behavior.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

const ANIMATED_FLOWCHART = 'flowchart TD\n  A e1@--> B\n  e1@{ animate: true }'

const FLOWCHART_WITH_LINK =
  'flowchart TD\n  A --> B\n  click A "https://example.com" "Tip"'

const BAR_CHART = `xychart-beta
  x-axis [Jan, Feb, Mar, Apr]
  y-axis "Revenue" 0 --> 100
  bar [30, 60, 45, 80]`

// ============================================================================
// Default behavior is unchanged for callers who touch neither option
// ============================================================================

describe('interactivity — default (unset) behavior', () => {
  it('flowchart: an animated edge does NOT animate (motion needs `full`)', () => {
    const svg = renderMermaidSVG(ANIMATED_FLOWCHART)
    expect(svg).not.toContain('edge-animated')
    expect(svg).not.toContain('@keyframes zm-edge-dash')
  })

  it('flowchart: click-based links and tooltips still render', () => {
    const svg = renderMermaidSVG(FLOWCHART_WITH_LINK)
    expect(svg).toContain('<a href="https://example.com">')
    expect(svg).toContain('<title>Tip</title>')
  })

  it('xychart: hover tooltips stay off', () => {
    const svg = renderMermaidSVG(BAR_CHART)
    expect(svg).not.toContain('xychart-bar-group')
    expect(svg).not.toContain('.xychart-tip {')
  })
})

// ============================================================================
// interactivity: 'none'
// ============================================================================

describe("interactivity: 'none'", () => {
  it('strips flowchart edge animation', () => {
    const svg = renderMermaidSVG(ANIMATED_FLOWCHART, { interactivity: 'none' })
    expect(svg).not.toContain('edge-animated')
    expect(svg).not.toContain('@keyframes zm-edge-dash')
    expect(svg).not.toContain('stroke-dasharray="8 6"')
  })

  it('leaves the edge itself intact (id, data attrs, geometry)', () => {
    const svg = renderMermaidSVG(ANIMATED_FLOWCHART, { interactivity: 'none' })
    expect(svg).toContain('data-id="e1"')
    expect(svg).toContain('class="edge"')
  })

  it('strips click-based links and tooltips', () => {
    const svg = renderMermaidSVG(FLOWCHART_WITH_LINK, {
      interactivity: 'none',
    })
    expect(svg).not.toContain('<a href=')
    expect(svg).not.toContain('<title>Tip</title>')
  })

  it('keeps xychart tooltips off', () => {
    const svg = renderMermaidSVG(BAR_CHART, { interactivity: 'none' })
    expect(svg).not.toContain('xychart-bar-group')
  })
})

// ============================================================================
// interactivity: 'static' (explicit — should match the default)
// ============================================================================

describe("interactivity: 'static'", () => {
  it('flowchart: an animated edge does NOT animate', () => {
    const svg = renderMermaidSVG(ANIMATED_FLOWCHART, {
      interactivity: 'static',
    })
    expect(svg).not.toContain('edge-animated')
    expect(svg).not.toContain('@keyframes zm-edge-dash')
  })

  it('flowchart: click-based links and tooltips still render', () => {
    const svg = renderMermaidSVG(FLOWCHART_WITH_LINK, {
      interactivity: 'static',
    })
    expect(svg).toContain('<a href="https://example.com">')
    expect(svg).toContain('<title>Tip</title>')
  })

  it('xychart: hover tooltips stay off', () => {
    const svg = renderMermaidSVG(BAR_CHART, { interactivity: 'static' })
    expect(svg).not.toContain('xychart-bar-group')
  })
})

// ============================================================================
// interactivity: 'full'
// ============================================================================

describe("interactivity: 'full'", () => {
  it('flowchart: an animated edge animates', () => {
    const svg = renderMermaidSVG(ANIMATED_FLOWCHART, { interactivity: 'full' })
    expect(svg).toContain('class="edge edge-animated"')
    expect(svg).toContain('@keyframes zm-edge-dash')
  })

  it('flowchart: click-based links and tooltips still render', () => {
    const svg = renderMermaidSVG(FLOWCHART_WITH_LINK, { interactivity: 'full' })
    expect(svg).toContain('<a href="https://example.com">')
    expect(svg).toContain('<title>Tip</title>')
  })

  it('xychart: enables hover tooltip groups and hover CSS', () => {
    const svg = renderMermaidSVG(BAR_CHART, { interactivity: 'full' })
    expect(svg).toContain('xychart-bar-group')
    expect(svg).toContain('.xychart-tip {')
    expect(svg).toContain(':hover .xychart-tip')
  })
})

// ============================================================================
// Deprecated `interactive` boolean — still works, maps correctly
// ============================================================================

describe('deprecated `interactive` boolean', () => {
  it('interactive: true enables xychart tooltips (unchanged from before)', () => {
    const svg = renderMermaidSVG(BAR_CHART, { interactive: true })
    expect(svg).toContain('xychart-bar-group')
    expect(svg).toContain('.xychart-tip {')
  })

  it('interactive: false keeps xychart tooltips off (unchanged from before)', () => {
    const svg = renderMermaidSVG(BAR_CHART, { interactive: false })
    expect(svg).not.toContain('xychart-bar-group')
  })

  it('does not affect flowchart edge animation (still gated to interactivity: full)', () => {
    const svg = renderMermaidSVG(ANIMATED_FLOWCHART, { interactive: true })
    expect(svg).not.toContain('edge-animated')
  })

  it('`interactivity`, when set, takes precedence over `interactive`', () => {
    // interactivity: 'none' wins even though the deprecated boolean asks
    // for tooltips — 'full' is the only level that turns them on.
    const svgNone = renderMermaidSVG(BAR_CHART, {
      interactive: true,
      interactivity: 'none',
    })
    expect(svgNone).not.toContain('xychart-bar-group')

    const svgStatic = renderMermaidSVG(BAR_CHART, {
      interactive: true,
      interactivity: 'static',
    })
    expect(svgStatic).not.toContain('xychart-bar-group')

    const svgFull = renderMermaidSVG(BAR_CHART, {
      interactive: false,
      interactivity: 'full',
    })
    expect(svgFull).toContain('xychart-bar-group')
  })
})
