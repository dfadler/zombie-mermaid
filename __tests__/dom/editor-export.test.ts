// @vitest-environment jsdom
/**
 * Proves zombie-mermaid#809's export-dropdown React state actually works,
 * replacing `editor/__tests__/export.test.ts`'s old `createEditorEnv()` +
 * `window.eval` approach with this repo's React Testing Library pattern
 * (`__tests__/dom/rtl-example.test.ts`), the same migration
 * `__tests__/dom/editor-viewport.test.ts` did for #807.
 *
 * PNG rasterization (`exportPNG`/`copyImage`) relies on `<canvas>` 2D
 * context and `<img>` decode-on-load, neither of which jsdom implements
 * without the optional native `canvas` package -- the exact limitation the
 * old `export.test.ts` documented. This file covers the same deterministic
 * subset that file did (`exportSVG`, `copyURL`, and the shared "no diagram
 * rendered yet" guard `getSvgEl` gives all four export actions), plus the
 * dropdown/size-pill/keyboard-shortcut wiring #809 actually converted to
 * React, which the old file never covered at all.
 */
import { act, createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import {
  EditorApp,
  INITIAL_EDITOR_STATE,
  editorReducer,
  type EditorAppProps,
} from '../../demo/components/editor-app.tsx'

const PROPS: EditorAppProps = {
  themes: [{ key: 'nord', bg: '#2E3440', label: 'Nord' }],
}

beforeEach(() => {
  // editor-export.ts's copyURL() calls through window.__editorSharingState
  // (normally registered by the *legacy* editor/js/sharing.ts bundle,
  // which these RTL tests never load -- only <EditorApp> itself is
  // rendered) -- see that hook's own header comment for why the bridge
  // exists.
  window.__editorSharingState = { updateHash: vi.fn() }
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  window.URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  // @ts-expect-error -- deleting a property this file's own tests define.
  delete navigator.clipboard
})

function seedRenderedSvg(): void {
  const previewInner = document.getElementById('preview-inner')!
  previewInner.innerHTML =
    '<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"></svg>'
}

describe('editorReducer (#809 export actions)', () => {
  it('SET_EXPORT_SCALE updates exportScale only', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_EXPORT_SCALE',
      scale: 2,
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, exportScale: 2 })
  })

  it('SET_EXPORT_DROPDOWN_OPEN updates exportDropdownOpen only', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_EXPORT_DROPDOWN_OPEN',
      open: true,
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, exportDropdownOpen: true })
  })
})

describe('<EditorApp> export dropdown interaction (#809)', () => {
  it('opens on chevron click and closes on an outside click', () => {
    render(createElement(EditorApp, PROPS))
    const dropdown = document.getElementById('export-dropdown')!
    const chevron = document.getElementById('export-chevron-btn')!

    expect(dropdown).not.toHaveClass('open')
    fireEvent.click(chevron)
    expect(dropdown).toHaveClass('open')

    fireEvent.click(document.body)
    expect(dropdown).not.toHaveClass('open')
  })

  it('does not close when the click is inside #export-wrap', () => {
    render(createElement(EditorApp, PROPS))
    const dropdown = document.getElementById('export-dropdown')!
    fireEvent.click(document.getElementById('export-chevron-btn')!)
    expect(dropdown).toHaveClass('open')

    fireEvent.click(document.getElementById('export-wrap')!)
    expect(dropdown).toHaveClass('open')
  })

  it('switches the active size pill and updates exportScale', () => {
    render(createElement(EditorApp, PROPS))
    const pill1x = document.querySelector<HTMLElement>(
      '.size-pill[data-scale="1"]',
    )!
    const pill4x = document.querySelector<HTMLElement>(
      '.size-pill[data-scale="4"]',
    )!

    expect(pill4x).toHaveClass('active')
    expect(pill1x).not.toHaveClass('active')

    fireEvent.click(pill1x)

    expect(pill1x).toHaveClass('active')
    expect(pill4x).not.toHaveClass('active')
  })
})

describe('<EditorApp> export/copy actions (#809)', () => {
  it('downloads the rendered SVG with the right filename and mime type, and closes the dropdown', () => {
    render(createElement(EditorApp, PROPS))
    seedRenderedSvg()
    fireEvent.click(document.getElementById('export-chevron-btn')!)

    let created: HTMLAnchorElement | null = null
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') {
        created = el as HTMLAnchorElement
        el.click = () => {}
      }
      return el
    })

    fireEvent.click(document.getElementById('export-svg-btn')!)

    expect(created).not.toBeNull()
    expect(created!.download).toBe('diagram.svg')
    expect(created!.href).toBe('blob:mock-url')
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1)
    const blob = (window.URL.createObjectURL as Mock).mock.calls[0][0] as Blob
    expect(blob.type).toBe('image/svg+xml;charset=utf-8')
    expect(screen.getByText('SVG saved!')).toBeInTheDocument()
    expect(document.getElementById('export-dropdown')).not.toHaveClass('open')
  })

  it('shows a toast and does not attempt a download when nothing is rendered', () => {
    render(createElement(EditorApp, PROPS))
    // No seedRenderedSvg() -- #preview-inner keeps its default placeholder.

    fireEvent.click(document.getElementById('export-svg-btn')!)

    expect(screen.getByText('Render a diagram first.')).toBeInTheDocument()
    expect(window.URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('copies the current share URL to the clipboard via the sharing.ts bridge', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    render(createElement(EditorApp, PROPS))
    const textarea = document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    textarea.value = 'graph TD\n  A --> B'

    await act(async () => {
      fireEvent.click(document.getElementById('copy-link-btn')!)
      await Promise.resolve()
    })

    expect(window.__editorSharingState.updateHash).toHaveBeenCalledTimes(1)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      window.location.href,
    )
    expect(screen.getByText('URL copied to clipboard!')).toBeInTheDocument()
  })

  it('Cmd/Ctrl+Shift+S exports SVG, but not while focus is in the editor', () => {
    render(createElement(EditorApp, PROPS))
    seedRenderedSvg()
    const textarea = document.getElementById('code-editor')!
    // Avoids jsdom's "Not implemented: navigation to another Document"
    // console noise from a real anchor.click() -- same stub the "downloads
    // the rendered SVG" test above uses.
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = () => {}
      return el
    })

    fireEvent.keyDown(textarea, {
      key: 'S',
      shiftKey: true,
      metaKey: true,
      target: textarea,
    })
    expect(window.URL.createObjectURL).not.toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'S', shiftKey: true, metaKey: true })
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1)
  })
})
