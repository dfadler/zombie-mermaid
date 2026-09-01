// ============================================================================
// End-to-end coverage for src/mcp/server.ts: connects a real MCP Client to
// createMcpServer()'s McpServer over the SDK's InMemoryTransport (no
// process spawn, no stdio) and drives it through the actual protocol —
// listTools/callTool — rather than calling the tool handlers directly, so
// registration (names, schemas, annotations) is exercised too, not just
// the handler logic already covered by the per-tool unit tests.
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpServer } from '../mcp/server.ts'

let server: McpServer
let client: Client

beforeAll(async () => {
  server = createMcpServer()
  client = new Client({ name: 'test-client', version: '0.0.0' })

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ])
})

afterAll(async () => {
  await client.close()
  await server.close()
})

describe('createMcpServer', () => {
  it('advertises both render tools', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(['render_mermaid_ascii', 'render_mermaid_svg'])
  })

  it('marks both tools as read-only and non-destructive', async () => {
    const { tools } = await client.listTools()
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true)
      expect(tool.annotations?.destructiveHint).toBe(false)
    }
  })

  it('renders SVG via a real tool call', async () => {
    const result = await client.callTool({
      name: 'render_mermaid_svg',
      arguments: { diagram: 'graph LR\n  A --> B' },
    })
    expect(result.isError).toBeFalsy()
    const content = result.content
    if (
      !Array.isArray(content) ||
      content[0]?.type !== 'text' ||
      typeof content[0].text !== 'string'
    ) {
      throw new Error('Expected text content')
    }
    expect(content[0].text).toContain('<svg')
  })

  it('renders ASCII via a real tool call', async () => {
    const result = await client.callTool({
      name: 'render_mermaid_ascii',
      arguments: { diagram: 'graph LR\n  A --> B' },
    })
    expect(result.isError).toBeFalsy()
    const content = result.content
    if (
      !Array.isArray(content) ||
      content[0]?.type !== 'text' ||
      typeof content[0].text !== 'string'
    ) {
      throw new Error('Expected text content')
    }
    expect(content[0].text).toContain('A')
    expect(content[0].text).toContain('B')
  })

  it('rejects an out-of-range theme via input schema validation', async () => {
    const result = await client.callTool({
      name: 'render_mermaid_svg',
      arguments: {
        diagram: 'graph LR\n  A --> B',
        theme: 'not-a-real-theme',
      },
    })
    expect(result.isError).toBe(true)
  })

  it('rejects a missing required diagram argument', async () => {
    const result = await client.callTool({
      name: 'render_mermaid_ascii',
      arguments: {},
    })
    expect(result.isError).toBe(true)
  })
})
