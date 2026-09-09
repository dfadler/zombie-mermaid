// @vitest-environment jsdom
/**
 * Worked example of this repo's React Testing Library pattern — added by
 * zombie-mermaid#798 as the #797 hydration epic's testing infra, so every
 * later sub-issue that hydrates a component (#800's Nav copy button,
 * #801's ThemeBar, the editor rewrite, etc.) has one concrete template to
 * follow instead of each inventing its own render/query/interact
 * conventions independently.
 *
 * The pattern, in order:
 *  1. `render()` a component into a real (jsdom) DOM.
 *  2. Query it the way a user would — `screen.getByRole(...)`, not a raw
 *     `querySelector`/CSS-class lookup — so the test breaks if the element
 *     stops being accessible, not just if a class name changes.
 *  3. `userEvent.click(...)` (or another `userEvent` interaction) to drive
 *     it, then assert the resulting state — the thing `renderToStaticMarkup`
 *     string-diffing (this repo's other demo component tests) fundamentally
 *     cannot express, since nothing in that output is ever alive.
 *
 * `Counter` below is a throwaway, test-local component — not exported from
 * `demo/components/` — because nothing under `demo/components/` has any
 * client-side state yet as of this issue; every later hydration sub-issue
 * replaces this file's example with tests against its own real component,
 * following the same three-step shape.
 *
 * The `// @vitest-environment jsdom` docblock above is what actually opts
 * this file into a live DOM — see `vitest.config.ts`'s comment for why
 * that's a per-file docblock rather than a directory glob. This file lives
 * under `__tests__/dom/` purely as a discoverability convention for future
 * jsdom-dependent tests, not because the directory itself does anything.
 */
import { createElement, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

function Counter() {
  const [count, setCount] = useState(0)
  return createElement(
    'button',
    { type: 'button', onClick: () => setCount((c) => c + 1) },
    `Clicked ${count} times`,
  )
}

describe('React Testing Library pattern (example)', () => {
  it('renders, queries by role, and reacts to a click', async () => {
    const user = userEvent.setup()
    render(createElement(Counter))

    const button = screen.getByRole('button', { name: 'Clicked 0 times' })
    // jest-dom matcher, registered globally via vitest.setup.ts.
    expect(button).toBeInTheDocument()

    await user.click(button)

    expect(
      screen.getByRole('button', { name: 'Clicked 1 times' }),
    ).toBeInTheDocument()
  })

  it('supports repeated interaction, not just a single click', async () => {
    const user = userEvent.setup()
    render(createElement(Counter))

    const button = screen.getByRole('button')
    await user.click(button)
    await user.click(button)
    await user.click(button)

    expect(button).toHaveTextContent('Clicked 3 times')
  })
})
