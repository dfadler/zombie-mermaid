/**
 * Global Vitest setup:
 *
 * 1. Registers `@testing-library/jest-dom`'s matchers
 *    (`toBeInTheDocument()`, `toHaveAttribute()`, etc.) onto Vitest's
 *    `expect`.
 * 2. Unmounts every React Testing Library `render()` after each test
 *    (`@testing-library/react`'s `cleanup()`) — RTL normally registers this
 *    itself automatically via a global `afterEach`, but this repo's
 *    `test.globals` stays `false` (see vitest.config.ts: tests import
 *    `describe`/`it`/`expect`/etc. explicitly rather than relying on
 *    ambient globals), so nothing would otherwise call it and a DOM
 *    rendered by one test would leak into the next — see
 *    __tests__/dom/rtl-example.test.ts's second test, which fails with
 *    "Found multiple elements" without this.
 * 3. Stubs a no-op `ResizeObserver` when the jsdom environment doesn't
 *    provide one (jsdom has never implemented it) — components that
 *    observe an element's own size to track scroll-fade visibility
 *    (`fork-fixes-app.tsx`'s `AsciiWell`, `diagram-detail-app.tsx`'s
 *    `DetailOutputPanel`) throw `ReferenceError: ResizeObserver is not
 *    defined` the moment their effect runs in a hydration test, even when
 *    the test never asserts anything about sizing. A real `ResizeObserver`
 *    would need a real layout engine to fire callbacks meaningfully anyway
 *    (jsdom does no layout), so a stub that never calls back is enough to
 *    let those effects mount without crashing.
 *
 * Wired in via `vitest.config.ts`'s `test.setupFiles`, which runs this once
 * per test *file* (Vitest's default `pool`), not once globally — but both
 * side effects here (extending `expect`, registering an `afterEach`) are
 * idempotent/per-file-scoped, so that's fine.
 *
 * Safe to load for every test file, including the plain-Node ones that never
 * touch a DOM (see vitest.config.ts's environment comment): the jest-dom
 * matchers only *activate* when a test asserts against a real DOM node,
 * `cleanup()` is a no-op when nothing was rendered, and the `ResizeObserver`
 * stub only installs when `window`/`ResizeObserver` don't already exist.
 */
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined' && typeof ResizeObserver === 'undefined') {
  class NoopResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = NoopResizeObserver
}

afterEach(() => {
  cleanup()
})
