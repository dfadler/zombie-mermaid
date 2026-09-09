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
 *
 * Wired in via `vitest.config.ts`'s `test.setupFiles`, which runs this once
 * per test *file* (Vitest's default `pool`), not once globally — but both
 * side effects here (extending `expect`, registering an `afterEach`) are
 * idempotent/per-file-scoped, so that's fine.
 *
 * Safe to load for every test file, including the plain-Node ones that never
 * touch a DOM (see vitest.config.ts's environment comment): the jest-dom
 * matchers only *activate* when a test asserts against a real DOM node, and
 * `cleanup()` is a no-op when nothing was rendered.
 */
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})
