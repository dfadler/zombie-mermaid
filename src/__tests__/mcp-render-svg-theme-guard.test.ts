import { describe, it, expect, vi, afterEach } from 'vitest'

// ============================================================================
// Isolated from mcp-render-svg-tool.test.ts because this needs to mock
// ../theme.ts's THEMES down to an empty object at module-load time, to
// exercise render-svg.ts's toNonEmptyStringTuple() invariant guard — a
// defensive check that's otherwise unreachable in every other test, since
// production THEMES is always a populated const. Mocking THEMES for the
// whole file would break every other real-theme assertion there, so this
// gets its own file instead.
// ============================================================================

describe('render-svg.ts module load — theme registry invariant', () => {
  afterEach(() => {
    vi.doUnmock('../theme.ts')
    vi.resetModules()
  })

  it('throws at import time if no built-in themes are registered', async () => {
    vi.doMock('../theme.ts', () => ({ THEMES: {} }))
    vi.resetModules()

    await expect(import('../mcp/tools/render-svg.ts')).rejects.toThrow(
      'Expected at least one built-in theme to be registered',
    )
  })
})
