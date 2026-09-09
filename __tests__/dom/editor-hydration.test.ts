// @vitest-environment jsdom
/**
 * Proves the #806 editor-hydration shell actually works, mirroring the
 * pattern `__tests__/dom/dashboard-hydration.test.ts`/
 * `__tests__/dom/nav-hydration.test.ts` established:
 *
 * 1. `<EditorApp>` hydrates cleanly against server-rendered markup — no
 *    console warning/error, the same "renderToString into a real DOM node,
 *    then hydrateRoot() against it, assert no console noise" proof #799
 *    established (see dashboard-hydration.test.ts's own header comment).
 * 2. The new state/DOM-ref core actually works: {@link editorReducer}
 *    updates state correctly for each action, {@link collectEditorRefs}
 *    resolves every element `editor/js/elements.ts` used to cache, and
 *    {@link useEditorState}/{@link useEditorDispatch}/{@link useEditorRefs}
 *    all throw immediately (rather than silently returning a wrong
 *    default) when called outside an `<EditorApp>` ancestor.
 * 3. `<EditorApp>` and `<NavIsland>` hydrate side by side without
 *    interfering with each other — the same double-hydration concern
 *    `dashboard-hydration.test.ts` has its own dedicated regression test
 *    for, relevant here because `demo/editor-client.tsx` hydrates both
 *    from one bundle.
 */
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'
import {
  EDITOR_PROPS_ELEMENT_ID,
  EDITOR_ROOT_ID,
  EditorApp,
  INITIAL_EDITOR_STATE,
  collectEditorRefs,
  editorReducer,
  useEditorDispatch,
  useEditorRefs,
  useEditorState,
  type EditorAppProps,
} from '../../demo/components/editor-app.tsx'
import {
  NAV_PROPS_ELEMENT_ID,
  NAV_ROOT_ID,
  Nav,
} from '../../demo/components/nav.tsx'

const PROPS: EditorAppProps = {
  themes: [
    { key: 'nord', bg: '#2E3440', label: 'Nord' },
    { key: 'github-light', bg: '#ffffff', label: 'GitHub' },
  ],
}

describe('editorReducer (#806)', () => {
  it('updates theme on SET_THEME, leaving zoom/config untouched', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_THEME',
      theme: 'nord',
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, theme: 'nord' })
  })

  it('updates zoom on SET_ZOOM, leaving theme/config untouched', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_ZOOM',
      zoom: 2.5,
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, zoom: 2.5 })
  })

  it('updates config on SET_CONFIG, leaving theme/zoom untouched', () => {
    const config = { bg: '#000000', font: 'Inter' }
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_CONFIG',
      config,
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, config })
  })

  it('never mutates the input state object', () => {
    const before = { ...INITIAL_EDITOR_STATE }
    editorReducer(INITIAL_EDITOR_STATE, { type: 'SET_ZOOM', zoom: 3 })
    expect(INITIAL_EDITOR_STATE).toEqual(before)
  })
})

describe('useEditorState/useEditorDispatch/useEditorRefs (#806)', () => {
  it('throw immediately when called with no <EditorApp> ancestor', () => {
    function BareState() {
      useEditorState()
      return null
    }
    function BareDispatch() {
      useEditorDispatch()
      return null
    }
    function BareRefs() {
      useEditorRefs()
      return null
    }

    // React logs the thrown error to console.error even when the test
    // itself catches it via a render-time try/catch below — suppress that
    // expected noise so it doesn't obscure a real failure elsewhere.
    const originalError = console.error
    console.error = () => {}
    try {
      expect(() => render(createElement(BareState))).toThrow(
        'useEditorState: no EditorApp ancestor found',
      )
      expect(() => render(createElement(BareDispatch))).toThrow(
        'useEditorDispatch: no EditorApp ancestor found',
      )
      expect(() => render(createElement(BareRefs))).toThrow(
        'useEditorRefs: no EditorApp ancestor found',
      )
    } finally {
      console.error = originalError
    }
  })
})

describe('collectEditorRefs (#806)', () => {
  it('resolves every element editor/js/elements.ts used to cache, after <EditorApp> mounts', () => {
    render(createElement(EditorApp, PROPS))
    const refs = collectEditorRefs()

    expect(refs.editor).toBeInstanceOf(HTMLTextAreaElement)
    expect(refs.editor.id).toBe('code-editor')
    expect(refs.lineNumbers.id).toBe('line-numbers')
    expect(refs.previewInner.id).toBe('preview-inner')
    expect(refs.previewBody.id).toBe('preview-body')
    expect(refs.statusText.id).toBe('status-text')
    expect(refs.statusDot.id).toBe('status-dot')
    expect(refs.cursorPos.id).toBe('cursor-pos')
    expect(refs.renderTime.id).toBe('render-time')
    expect(refs.zoomLabel.id).toBe('zoom-label')
    expect(refs.spinner.id).toBe('render-spinner')
    expect(refs.toast.id).toBe('toast')
    expect(refs.themeMenu.id).toBe('theme-dropdown-menu')
    expect(refs.panelLeft.id).toBe('panel-left')
    expect(refs.resizeHandle.id).toBe('resize-handle')
    expect(refs.editorView.id).toBe('editor-view')
    expect(refs.configView.id).toBe('config-view')
  })

  it('throws a diagnosable error when a required element is missing', () => {
    document.body.innerHTML = ''
    expect(() => collectEditorRefs()).toThrow('missing #code-editor element')
  })
})

describe('<EditorApp> hydration (#806)', () => {
  let editorRoot: Root | undefined
  let navRoot: Root | undefined

  afterEach(() => {
    // See dashboard-hydration.test.ts's identical afterEach comment:
    // hydrateRoot() schedules its hydration pass at idle priority, so an
    // unmount outside act() can interrupt a still-pending pass and throw
    // unrelated test noise.
    if (editorRoot) act(() => editorRoot?.unmount())
    if (navRoot) act(() => navRoot?.unmount())
    editorRoot = undefined
    navRoot = undefined
    document.body.innerHTML = ''
  })

  /**
   * Mirrors what `demo/components/editor-app-island.tsx`'s
   * `EditorAppIsland` actually renders server-side: a plain
   * `id={EDITOR_ROOT_ID}` wrapper holding `<EditorApp>`'s `renderToString`
   * output, plus the JSON props script tag — see that component's doc
   * comment for why `renderToString` (hydration-boundary comments) rather
   * than `renderToStaticMarkup`.
   */
  function renderServerHtmlIntoDocument(props: EditorAppProps): void {
    document.body.innerHTML = `
      <div id="${EDITOR_ROOT_ID}">${renderToString(createElement(EditorApp, props))}</div>
      <script type="application/json" id="${EDITOR_PROPS_ELEMENT_ID}">${JSON.stringify(props)}</script>
      <div id="${NAV_ROOT_ID}">${renderToString(createElement(Nav))}</div>
      <script type="application/json" id="${NAV_PROPS_ELEMENT_ID}">${JSON.stringify({})}</script>
    `
  }

  function captureConsoleNoise(): {
    seen: unknown[][]
    restore: () => void
  } {
    const seen: unknown[][] = []
    const originalError = console.error
    const originalWarn = console.warn
    console.error = (...args: unknown[]) => {
      seen.push(args)
    }
    console.warn = (...args: unknown[]) => {
      seen.push(args)
    }
    return {
      seen,
      restore: () => {
        console.error = originalError
        console.warn = originalWarn
      },
    }
  }

  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument(PROPS)
    const container = document.getElementById(EDITOR_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    const { seen, restore } = captureConsoleNoise()
    // `onRecoverableError` is React's own supported hook for exactly this:
    // a hydration mismatch doesn't always throw synchronously or log via
    // console.error/warn within the same `act()` call (React 19 can
    // schedule the client-side recovery re-render, and its resulting
    // error, as later work) -- console-spying alone missed a deliberately
    // introduced mismatch while writing this test (recorded as an
    // "Uncaught Exception" outside this test's own try/catch instead of
    // failing an assertion here). `onRecoverableError` is called
    // synchronously by React itself whenever hydration actually recovers
    // from a mismatch, regardless of timing, so asserting on it is the
    // reliable check; the console capture stays as a secondary signal.
    const recoverableErrors: unknown[] = []
    let thrown: unknown
    try {
      await act(async () => {
        editorRoot = hydrateRoot(container, createElement(EditorApp, PROPS), {
          onRecoverableError: (error) => {
            recoverableErrors.push(error)
          },
        })
      })
    } catch (err) {
      thrown = err
    } finally {
      restore()
    }

    expect(thrown).toBeUndefined()
    expect(recoverableErrors).toEqual([])
    expect(seen).toEqual([])
  })

  it('hydrates <EditorApp> and <NavIsland> side by side with no cross-interference', async () => {
    renderServerHtmlIntoDocument(PROPS)
    const editorContainer = document.getElementById(EDITOR_ROOT_ID)
    const navContainer = document.getElementById(NAV_ROOT_ID)
    if (!editorContainer || !navContainer) {
      throw new Error('test setup: root container missing')
    }

    const { seen, restore } = captureConsoleNoise()
    // See the previous test's comment on why `onRecoverableError` (not just
    // console-spying) is the reliable way to detect a real mismatch.
    const recoverableErrors: unknown[] = []
    try {
      await act(async () => {
        editorRoot = hydrateRoot(
          editorContainer,
          createElement(EditorApp, PROPS),
          { onRecoverableError: (error) => recoverableErrors.push(error) },
        )
        navRoot = hydrateRoot(navContainer, createElement(Nav), {
          onRecoverableError: (error) => recoverableErrors.push(error),
        })
      })
    } finally {
      restore()
    }

    expect(recoverableErrors).toEqual([])
    expect(seen).toEqual([])
    // Each root's own content stays within its own container -- neither
    // hydrateRoot() call clobbered or duplicated the other's DOM.
    expect(editorContainer.querySelector('.topbar')).not.toBeNull()
    expect(navContainer.querySelector('.topbar')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Copy install command' }),
    ).toBeInTheDocument()
  })
})
