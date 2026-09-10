// @vitest-environment jsdom
/**
 * #827 interaction-coverage audit: `editor/js/editor-helpers.ts` is the one
 * remaining legacy (non-React) editor module -- the code-editor textarea's
 * own `input`/`keydown`/`keyup`/`click`/`scroll` wiring, deliberately left
 * out of the #806-#810 React rewrite because it has no React state to drive
 * it (see that file's own header comment). Every other editor/js/*.ts
 * module was migrated to React and picked up real RTL interaction tests
 * along the way (`__tests__/dom/editor-viewport.test.ts`,
 * `editor-config.test.ts`, etc.) -- this one file was left with zero direct
 * test coverage anywhere: the old `editor/__tests__/support/harness.ts` +
 * `editor/__tests__/*.test.ts` that used to exercise it via `window.eval()`
 * were deleted wholesale once the modules they targeted moved to React
 * (`git log --oneline -- editor/__tests__/`), and nothing replaced the
 * coverage for the two keyboard paths (Tab-to-indent, Cmd/Ctrl+Enter
 * force-render) and the cursor/scroll-sync wiring that live only here.
 *
 * This is plain, non-React DOM code, so it's tested the plain way: build
 * the exact markup `elements.ts`'s `requireElement()` calls expect
 * (`#code-editor`/`#line-numbers`/`#cursor-pos`), stub the one bridge this
 * module reaches out through (`window.__editorRenderTrigger`, normally
 * registered by `demo/components/editor-rendering.ts`'s
 * `useEditorRendering` -- see `editor/js/global.d.ts`), then dynamically
 * `import()` the module so its top-level `addEventListener` registration
 * runs against that markup.
 *
 * `vi.resetModules()` + a fresh dynamic import per test (rather than one
 * shared import) matters here: `elements.ts` caches its DOM references at
 * *module* top level, so a second test reusing the first test's cached
 * module would silently keep operating on the first test's now-detached
 * DOM nodes instead of the fresh ones this test builds.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

function buildDom(): {
  editor: HTMLTextAreaElement
  lineNumbers: HTMLElement
  cursorPos: HTMLElement
} {
  document.body.innerHTML = `
    <div class="line-numbers" id="line-numbers"></div>
    <textarea class="code-editor" id="code-editor"></textarea>
    <span id="cursor-pos">Ln 1, Col 1</span>
  `
  return {
    editor: document.getElementById('code-editor') as HTMLTextAreaElement,
    lineNumbers: document.getElementById('line-numbers') as HTMLElement,
    cursorPos: document.getElementById('cursor-pos') as HTMLElement,
  }
}

/**
 * Fresh module graph + fresh DOM, then load the real module under test so
 * its top-level side effects (element lookups, `addEventListener` calls)
 * run against this test's own elements.
 */
async function loadEditorHelpers(): Promise<{
  editor: HTMLTextAreaElement
  lineNumbers: HTMLElement
  cursorPos: HTMLElement
  scheduleRender: ReturnType<typeof vi.fn>
}> {
  vi.resetModules()
  const dom = buildDom()
  const scheduleRender = vi.fn()
  window.__editorRenderTrigger = { scheduleRender }
  await import('../../editor/js/editor-helpers.ts')
  return { ...dom, scheduleRender }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('editor/js/editor-helpers.ts keyboard shortcuts (#827)', () => {
  it('Tab inserts two spaces at the cursor, moves the cursor past them, and schedules a debounced render', async () => {
    const { editor, scheduleRender } = await loadEditorHelpers()
    editor.value = 'ab'
    editor.selectionStart = editor.selectionEnd = 1

    const event = new window.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    editor.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(editor.value).toBe('a  b')
    expect(editor.selectionStart).toBe(3)
    expect(editor.selectionEnd).toBe(3)
    // No explicit delay -- the debounced path, not the force-render one.
    expect(scheduleRender).toHaveBeenCalledWith()
  })

  it('Ctrl+Enter forces an immediate render (delay 0) without inserting a newline', async () => {
    const { editor, scheduleRender } = await loadEditorHelpers()
    editor.value = 'graph TD'
    editor.selectionStart = editor.selectionEnd = editor.value.length

    const event = new window.KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    editor.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(editor.value).toBe('graph TD')
    expect(scheduleRender).toHaveBeenCalledWith(0)
  })

  it('Cmd (meta)+Enter also forces an immediate render', async () => {
    const { editor, scheduleRender } = await loadEditorHelpers()
    editor.value = 'graph TD'

    editor.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'Enter',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )

    expect(scheduleRender).toHaveBeenCalledWith(0)
  })

  it('a plain Enter (no modifier) is a no-op for this listener -- no preventDefault, no render trigger', async () => {
    const { editor, scheduleRender } = await loadEditorHelpers()

    const event = new window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    editor.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(scheduleRender).not.toHaveBeenCalled()
  })

  it('an unrelated key is a no-op -- no preventDefault, no render trigger, no value change', async () => {
    const { editor, scheduleRender } = await loadEditorHelpers()
    editor.value = 'graph TD'

    const event = new window.KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    })
    editor.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(editor.value).toBe('graph TD')
    expect(scheduleRender).not.toHaveBeenCalled()
  })
})

describe('editor/js/editor-helpers.ts input/cursor/scroll wiring (#827)', () => {
  it('updates the line-number gutter on input', async () => {
    const { editor, lineNumbers } = await loadEditorHelpers()
    editor.value = 'one\ntwo\nthree'

    editor.dispatchEvent(new window.Event('input', { bubbles: true }))

    expect(lineNumbers.textContent).toBe('1\n2\n3\n')
  })

  it('reports line/column position on keyup', async () => {
    const { editor, cursorPos } = await loadEditorHelpers()
    editor.value = 'line1\nline22'
    editor.selectionStart = editor.selectionEnd = editor.value.length

    editor.dispatchEvent(new window.Event('keyup', { bubbles: true }))

    expect(cursorPos.textContent).toBe('Ln 2, Col 7')
  })

  it('reports line/column position on click', async () => {
    const { editor, cursorPos } = await loadEditorHelpers()
    editor.value = 'abcdef'
    editor.selectionStart = editor.selectionEnd = 3

    editor.dispatchEvent(new window.Event('click', { bubbles: true }))

    expect(cursorPos.textContent).toBe('Ln 1, Col 4')
  })

  it('syncs the line-number gutter scroll position to the editor on scroll', async () => {
    const { editor, lineNumbers } = await loadEditorHelpers()
    Object.defineProperty(editor, 'scrollTop', {
      value: 42,
      configurable: true,
    })

    editor.dispatchEvent(new window.Event('scroll', { bubbles: true }))

    expect(lineNumbers.scrollTop).toBe(42)
  })
})
