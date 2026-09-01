// ============================================================================
// zombie-mermaid CLI — `mcp` subcommand
//
// Starts the zombie-mermaid MCP server (see src/mcp/server.ts) on stdio, so
// it can be configured directly as an MCP server command — e.g. in Claude
// Desktop/Claude Code's MCP server config:
//
//   { "command": "npx", "args": ["zombie-mermaid", "mcp"] }
//
// IMPORTANT: never write to stdout here. Once connected, stdout carries the
// MCP JSON-RPC stream — any stray console.log (here or anywhere else in the
// process while this is running) would corrupt the protocol. Startup
// confirmation goes to stderr instead.
// ============================================================================

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpServer } from '../mcp/index.ts'

/**
 * Execute the `mcp` command: start the MCP server on stdio and resolve once
 * connected. Returns the running server so callers (tests, mainly) can
 * close it; the CLI entry point just awaits this and lets the process stay
 * alive for as long as the transport is connected.
 */
export async function runMcp(
  log: (s: string) => void = (s) => console.error(s),
): Promise<McpServer> {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  log(
    'zombie-mermaid MCP server running on stdio (experimental — feedback welcome: https://github.com/dfadler/zombie-mermaid/issues)',
  )
  return server
}
