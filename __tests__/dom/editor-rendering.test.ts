// @vitest-environment jsdom
/**
 * Proves zombie-mermaid#810's render-pipeline React state actually works,
 * replacing `editor/__tests__/rendering.test.ts`'s old `createEditorEnv()`
 * + `window.eval` approach (`doRender`/`hexToRgb`/`buildOptions`/`state`/
 * `scheduleRender` no longer exist as legacy globals -- #810 moved them to
 * `demo/components/editor-rendering.ts`) with this repo's React Testing
 * Library pattern (`__tests__/dom/rtl-example.test.ts`,
 * `__tests__/dom/editor-viewport.test.ts`):
 *
 * 1. Pure-function unit tests for `hexToRgb`, `escHtml`, and `buildOptions`
 *    -- the same "small pure function, tested directly" coverage
 *    `rendering.test.ts`'s own `describe('hexToRgb', ...)` block and
 *    `config.test.ts`'s `buildOptions` coverage used to give the equivalent
 *    legacy functions.
 * 2. Real RTL interaction tests against a mounted `<EditorApp>`: type
 *    source and assert the renderer is called and the preview updates;
 *    change theme and assert the render options include it; a rejected
 *    render shows the error status; an empty source shows the placeholder.
 *
 * `window.__mermaid` is stubbed in `beforeEach` the same way
 * `editor/__tests__/support/harness.ts` (deleted by this issue) always
 * did -- every test here that expects a real render to happen needs it, and
 * {@link doRender}'s own defensive `!window.__mermaid` no-op (see that
 * function's comment) means a test that *doesn't* need one just gets one
 * anyway, harmlessly.
 */
import { act, createElement } from 'react'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EditorApp,
  type EditorAppProps,
} from '../../demo/components/editor-app.tsx'
import {
  buildOptions,
  escHtml,
  hexToRgb,
} from '../../demo/components/editor-rendering.ts'
import { decodeSource } from '../../demo/components/editor-sharing.ts'

const PROPS: EditorAppProps = {
  themes: [{ key: 'nord', bg: '#2E3440', label: 'Nord' }],
}

const THEMES = {
  nord: { bg: '#2E3440', fg: '#D8DEE9', accent: '#88C0D0' },
  dracula: { bg: '#282A36', fg: '#F8F8F2' },
}

function stubMermaid(
  renderImpl: (
    source: string,
    options: Record<string, unknown>,
  ) => Promise<string> = async () => '<svg data-mock-render="1"></svg>',
): ReturnType<typeof vi.fn> {
  const renderMermaidSVGAsync = vi.fn(renderImpl)
  window.__mermaid = { THEMES, renderMermaidSVGAsync }
  return renderMermaidSVGAsync
}

/** Waits for the debounced/scheduled render (setTimeout-based) to settle -- mirrors the deleted harness's identical helper. */
function flushRenderTimers(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20))
}

afterEach(() => {
  // @ts-expect-error -- deleting a property this file's own tests define.
  delete window.__mermaid
})

describe('hexToRgb (#810)', () => {
  it('parses 6-digit and 3-digit hex colors', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('returns null for invalid input', () => {
    expect(hexToRgb('')).toBeNull()
    expect(hexToRgb('not-a-color')).toBeNull()
    expect(hexToRgb(null)).toBeNull()
  })
})

describe('escHtml (#810)', () => {
  it('escapes HTML-significant characters', () => {
    expect(escHtml('<b>"a" & \'b\'</b>')).toBe(
      "&lt;b&gt;&quot;a&quot; &amp; 'b'&lt;/b&gt;",
    )
  })
})

describe('buildOptions (#810, moved from editor/js/rendering.ts’s buildOptions)', () => {
  it('merges the active theme with config overrides, config wins', () => {
    const opts = buildOptions(THEMES, {
      theme: 'nord',
      config: { bg: '#custom' },
    })
    expect(opts.bg).toBe('#custom')
    expect(opts.fg).toBe(THEMES.nord.fg)
  })

  it('returns an empty object with no theme and no config overrides', () => {
    expect(buildOptions(THEMES, { theme: '', config: {} })).toEqual({})
  })

  it('is a no-op when themes is undefined (renderer not loaded yet)', () => {
    expect(buildOptions(undefined, { theme: 'nord', config: {} })).toEqual({})
  })
})

describe('<EditorApp> render pipeline (#810)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('renders the default diagram on init with no theme options', async () => {
    const renderMermaidSVGAsync = stubMermaid()
    render(createElement(EditorApp, PROPS))
    await act(() => flushRenderTimers())

    expect(renderMermaidSVGAsync).toHaveBeenCalledTimes(1)
    const [source, opts] = renderMermaidSVGAsync.mock.calls[0]!
    expect(source).toContain('graph TD')
    expect(opts).toEqual({})
    expect(document.getElementById('preview-inner')!.innerHTML).toContain(
      'data-mock-render',
    )
    expect(document.getElementById('status-text')!.textContent).toBe('OK')
  })

  it('calls the renderer with the current editor source on typing', async () => {
    const renderMermaidSVGAsync = stubMermaid()
    render(createElement(EditorApp, PROPS))
    await act(() => flushRenderTimers())
    renderMermaidSVGAsync.mockClear()

    const textarea = document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    textarea.value = 'graph TD\n  A --> B'
    await act(async () => {
      window.__editorRenderTrigger.scheduleRender(0)
      await flushRenderTimers()
    })

    expect(renderMermaidSVGAsync).toHaveBeenCalledWith(
      'graph TD\n  A --> B',
      {},
    )
  })

  it('updates the URL hash after a successful render', async () => {
    const renderMermaidSVGAsync = stubMermaid()
    render(createElement(EditorApp, PROPS))
    await act(() => flushRenderTimers())
    renderMermaidSVGAsync.mockClear()

    const textarea = document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    textarea.value = 'graph TD\n  A --> B'
    await act(async () => {
      window.__editorRenderTrigger.scheduleRender(0)
      await flushRenderTimers()
    })

    expect(JSON.parse(decodeSource(window.location.hash.slice(1)))).toEqual({
      source: 'graph TD\n  A --> B',
    })
  })

  it('shows an error status and message when rendering throws', async () => {
    stubMermaid(async () => {
      throw new Error('boom')
    })
    render(createElement(EditorApp, PROPS))
    await act(() => flushRenderTimers())

    expect(document.getElementById('status-text')!.textContent).toBe('Error')
    expect(document.getElementById('preview-inner')!.innerHTML).toContain(
      'boom',
    )
  })

  it('shows the placeholder and resets status when the source is empty', async () => {
    const renderMermaidSVGAsync = stubMermaid()
    render(createElement(EditorApp, PROPS))
    await act(() => flushRenderTimers())

    const textarea = document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    textarea.value = '   '
    renderMermaidSVGAsync.mockClear()
    await act(async () => {
      window.__editorRenderTrigger.scheduleRender(0)
      await flushRenderTimers()
    })

    expect(document.getElementById('preview-inner')!.innerHTML).toContain(
      'Start typing to render your diagram',
    )
    expect(document.getElementById('status-text')!.textContent).toBe('Ready')
    expect(renderMermaidSVGAsync).not.toHaveBeenCalled()
  })

  it('re-renders and re-themes the page when the diagram theme changes', async () => {
    const renderMermaidSVGAsync = stubMermaid()
    render(createElement(EditorApp, PROPS))
    await act(() => flushRenderTimers())
    renderMermaidSVGAsync.mockClear()

    await act(async () => {
      document
        .getElementById('theme-dropdown-btn')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      const item = document.querySelector<HTMLElement>(
        '.theme-dropdown-item[data-theme="nord"]',
      )!
      item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushRenderTimers()
    })

    expect(renderMermaidSVGAsync).toHaveBeenCalled()
    const [, opts] = renderMermaidSVGAsync.mock.calls.at(-1)!
    expect(opts).toMatchObject({ bg: THEMES.nord.bg, fg: THEMES.nord.fg })
    expect(document.documentElement.style.getPropertyValue('--t-bg')).toBe(
      THEMES.nord.bg,
    )
  })
})
