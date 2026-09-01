import { describe, it, expect, vi } from 'vitest'
import { runMcp } from '../cli/mcp.ts'

// ============================================================================
// runMcp() — real StdioServerTransport, bound to the real process
// stdin/stdout (the constructor's defaults; nothing here injects fakes).
// No messages are ever sent (no client connects), so process.stdout stays
// clean, and closing the server in every branch removes the stdin
// listeners it attached — otherwise they'd leak across the rest of the
// suite, which shares one process.stdin.
// ============================================================================

describe('runMcp', () => {
  it('connects the server to stdio and logs a startup line', async () => {
    const logs: string[] = []
    const server = await runMcp((s) => logs.push(s))
    try {
      expect(logs).toHaveLength(1)
      expect(logs[0]).toContain('zombie-mermaid MCP server running on stdio')
      expect(server.isConnected()).toBe(true)
    } finally {
      await server.close()
    }
  })

  it('defaults to logging via console.error, not console.log', async () => {
    // cli/mcp.ts's default logger writes to stderr specifically because
    // stdout is reserved for the JSON-RPC stream once connected — this
    // guards that default without re-testing the stdio wiring above.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const server = await runMcp()
    try {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('zombie-mermaid MCP server running on stdio'),
      )
      expect(logSpy).not.toHaveBeenCalled()
    } finally {
      await server.close()
      errorSpy.mockRestore()
      logSpy.mockRestore()
    }
  })
})
