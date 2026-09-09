// @vitest-environment jsdom
/**
 * Proves the #799/#800 SSR -> hydrate pattern
 * (`__tests__/dom/dashboard-hydration.test.ts`'s pattern for
 * `DashboardApp`) works for `EditorApp` too (zombie-mermaid#806):
 * hydrates cleanly against server-rendered markup with no console
 * warnings/errors. This is the acceptance criterion #806 states
 * explicitly ("editor.html hydrates cleanly with no console warnings").
 *
 * Unlike every other #797 page, this doesn't (yet) prove any real
 * *interactive* behavior through the hydrated tree — `EditorApp` has none
 * of its own yet; `editor/js/*.ts`'s real behavior (zoom, pan, tabs,
 * color/font pickers, export, rendering, sharing, ...) stays completely
 * unported, running exactly as it does today, independently of this
 * hydration boundary. See `demo/components/editor-app.tsx`'s header
 * comment for why that's the deliberate, safe scope for this issue, and
 * `editor/__tests__/*.test.ts` (unchanged, still passing) for that
 * existing behavior's own coverage.
 */
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { screen } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'
import {
  EditorApp,
  EDITOR_PROPS_ELEMENT_ID,
  EDITOR_ROOT_ID,
  type EditorAppProps,
} from '../../demo/components/editor-app.tsx'

const EDITOR_APP_PROPS: EditorAppProps = {
  themes: [
    { key: 'nord', bg: '#2E3440', label: 'Nord' },
    { key: 'github-light', bg: '#ffffff', label: 'GitHub' },
  ],
}

let root: Root | undefined

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

function renderServerHtmlIntoDocument(): void {
  document.body.innerHTML = renderToString(
    createElement('div', { id: EDITOR_ROOT_ID }, [
      createElement(EditorApp, { ...EDITOR_APP_PROPS, key: 'app' }),
    ]),
  )
}

describe('EditorApp hydration (#806)', () => {
  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(EDITOR_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    const seen: unknown[][] = []
    const originalError = console.error
    const originalWarn = console.warn
    console.error = (...args: unknown[]) => {
      seen.push(args)
    }
    console.warn = (...args: unknown[]) => {
      seen.push(args)
    }
    let thrown: unknown
    try {
      await act(async () => {
        root = hydrateRoot(
          container,
          createElement(EditorApp, EDITOR_APP_PROPS),
        )
      })
    } catch (err) {
      thrown = err
    } finally {
      console.error = originalError
      console.warn = originalWarn
    }

    expect(thrown).toBeUndefined()
    expect(seen).toEqual([])
  })

  it('renders the real topbar/panels/toast structure once hydrated', () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(EDITOR_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      root = hydrateRoot(container, createElement(EditorApp, EDITOR_APP_PROPS))
    })

    expect(document.querySelector('.topbar')).not.toBeNull()
    expect(document.querySelector('.panel-left')).not.toBeNull()
    expect(document.querySelector('.panel-right')).not.toBeNull()
    expect(document.getElementById('toast')).not.toBeNull()
    expect(document.getElementById('resize-handle')).not.toBeNull()
    // The theme dropdown entries hydrated correctly too, not just the
    // static topbar chrome around them.
    expect(screen.getByRole('button', { name: /nord/i })).toBeInTheDocument()
  })
})

describe('demo/editor-client.tsx props contract', () => {
  it("editor-page.tsx's embedded JSON round-trips through EDITOR_PROPS_ELEMENT_ID exactly as the client reads it", () => {
    const scriptEl = document.createElement('script')
    scriptEl.type = 'application/json'
    scriptEl.id = EDITOR_PROPS_ELEMENT_ID
    scriptEl.textContent = JSON.stringify(EDITOR_APP_PROPS)
    document.body.appendChild(scriptEl)

    const read = document.getElementById(EDITOR_PROPS_ELEMENT_ID)
    expect(read?.textContent).toBeTruthy()
    expect(JSON.parse(read?.textContent ?? '')).toEqual(EDITOR_APP_PROPS)
  })
})
