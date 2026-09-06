// ============================================================================
// Covers src/cli/png.ts's "optional dependency not installed" error-wrapping
// path (issue #456, item 4). This can't be exercised by actually uninstalling
// @resvg/resvg-js (it's a real dependency of this dev environment/CI — see
// cli-render.test.ts's PNG describe block for the tests that use it for
// real), so the missing-module case is simulated by mocking the import to
// throw, the same way a skipped optional-dependency install or --no-optional
// would surface at the `await import('@resvg/resvg-js')` call site.
// ============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('@resvg/resvg-js', () => {
  throw new Error("Cannot find package '@resvg/resvg-js'")
})

describe('renderPng – missing optional dependency', () => {
  it('wraps the import failure in one clear, actionable error', async () => {
    const { renderPng } = await import('../cli/png.ts')

    let caught: unknown
    try {
      await renderPng('<svg></svg>')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    const message = (caught as Error).message
    expect(message).toContain(
      '--png requires the optional dependency "@resvg/resvg-js", which is not installed',
    )
    expect(message).toContain('pnpm add @resvg/resvg-js')
  })
})
