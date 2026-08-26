/**
 * Tests for the browser entry point.
 *
 * `src/browser.ts` runs in a plain `<script>` context where `window` is
 * ambient, but our test environment is Node, so we stub a fake `window`
 * before importing the module and reset the module registry so the
 * top-level assignment actually re-runs.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { MermaidBrowserGlobal } from '../browser.ts'

describe('browser entry point', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('attaches the mermaid API surface to window.__mermaid', async () => {
    const fakeWindow: { __mermaid?: MermaidBrowserGlobal } = {}
    vi.stubGlobal('window', fakeWindow)

    await import('../browser.ts')

    const api = fakeWindow.__mermaid
    expect(api).toBeDefined()
    if (!api) throw new Error('window.__mermaid was not set')
    expect(api.renderMermaidSVGAsync).toBeTypeOf('function')
    expect(api.renderMermaidASCII).toBeTypeOf('function')
    expect(api.diagramColorsToAsciiTheme).toBeTypeOf('function')
    expect(api.getSeriesColor).toBeTypeOf('function')
    expect(api.THEMES).toBeTypeOf('object')
    expect(typeof api.CHART_ACCENT_FALLBACK).not.toBe('undefined')
  })
})
