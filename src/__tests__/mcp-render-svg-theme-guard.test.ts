import { describe, it, expect, vi, afterEach } from 'vitest'

// ============================================================================
// Isolated from mcp-render-svg-tool.test.ts because this needs to mock
// THEMES down to an empty object at module-load time, to exercise
// render-svg.ts's toNonEmptyStringTuple() invariant guard — a defensive
// check that's otherwise unreachable in every other test, since production
// THEMES is always a populated const. Mocking THEMES for the whole file
// would break every other real-theme assertion there, so this gets its own
// file instead.
//
// The mock target is the whole `@zombie-mermaid/core` package (it was
// `../theme.ts` before #625 moved that file into it), so it must be a
// *partial* mock: replacing the barrel wholesale would strip every other
// core export render-svg.ts's own import graph needs, and the import would
// fail on a missing `escapeXml` long before reaching the guard under test.
// ============================================================================

describe('render-svg.ts module load — theme registry invariant', () => {
  afterEach(() => {
    vi.doUnmock('@zombie-mermaid/core')
    vi.resetModules()
  })

  it('throws at import time if no built-in themes are registered', async () => {
    vi.doMock('@zombie-mermaid/core', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@zombie-mermaid/core')>()),
      THEMES: {},
    }))
    vi.resetModules()

    await expect(
      import('../../packages/mcp/src/tools/render-svg.ts'),
    ).rejects.toThrow('Expected at least one built-in theme to be registered')
  })
})
