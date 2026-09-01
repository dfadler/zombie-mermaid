// ============================================================================
// zombie-mermaid/mcp — MCP server entry point
//
// Exposes the library's SVG/ASCII rendering as Model Context Protocol
// tools. Import `createMcpServer()` to embed the server in your own
// process and connect it to any MCP Transport, or run `zombie-mermaid mcp`
// from the CLI for a ready-to-use stdio server (see src/cli/mcp.ts).
//
// Usage:
//   import { createMcpServer } from 'zombie-mermaid/mcp'
//   import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
//
//   const server = createMcpServer()
//   await server.connect(new StdioServerTransport())
// ============================================================================

export { createMcpServer } from './server.ts'
