// ============================================================================
// End-to-end coverage for src/mcp/server.ts: connects a real MCP Client to
// createMcpServer()'s McpServer over the SDK's InMemoryTransport (no
// process spawn, no stdio) and drives it through the actual protocol —
// listTools/callTool — rather than calling the tool handlers directly, so
// registration (names, schemas, annotations) is exercised too, not just
// the handler logic already covered by the per-tool unit tests.
// ============================================================================

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpServer } from '../server.ts'

// Source runs have no built dist/render-worker.js, so render in-thread here;
// the real worker is covered by mcp-render-worker.test.ts and the packed smoke test.
vi.mock('../tools/render-worker-client.ts', async () => {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const { registerElk, renderMermaidSVG } =
    await import('@zombie-mermaid/svg-renderer')
  const { renderMermaidASCII } = await import('@zombie-mermaid/ascii-renderer')
  registerElk(ELK)
  return {
    renderInWorker: async (req: {
      kind: 'svg' | 'ascii'
      diagram: string
      options: object
    }) =>
      req.kind === 'svg'
        ? renderMermaidSVG(req.diagram, req.options)
        : renderMermaidASCII(req.diagram, req.options),
  }
})

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
  it('advertises all registered tools', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'check_mermaid_sequence_activations',
      'describe_diagram',
      'fix_mermaid_sequence_activations',
      'list_diagram_types',
      'list_themes',
      'render_mermaid_ascii',
      'render_mermaid_svg',
      'validate_mermaid',
    ])
  })

  it('marks every tool read-only and non-destructive except render_mermaid_svg', async () => {
    const { tools } = await client.listTools()
    for (const tool of tools) {
      if (tool.name === 'render_mermaid_svg') {
        // outputPath can write (and overwrite) a .svg file.
        expect(tool.annotations?.readOnlyHint).toBe(false)
        expect(tool.annotations?.destructiveHint).toBe(true)
        continue
      }
      expect(tool.annotations?.readOnlyHint).toBe(true)
      expect(tool.annotations?.destructiveHint).toBe(false)
    }
  })

  it('lists themes and diagram types via real tool calls', async () => {
    for (const [name, key] of [
      ['list_themes', 'themes'],
      ['list_diagram_types', 'diagramTypes'],
    ] as const) {
      const result = await client.callTool({ name, arguments: {} })
      expect(result.isError).toBeFalsy()
      const content = result.content
      if (
        !Array.isArray(content) ||
        content[0]?.type !== 'text' ||
        typeof content[0].text !== 'string'
      ) {
        throw new Error('Expected text content')
      }
      const parsed = JSON.parse(content[0].text) as Record<string, unknown>
      expect(Array.isArray(parsed[key])).toBe(true)
    }
  })

  it('rejects a non-hex bg via input schema validation', async () => {
    const result = await client.callTool({
      name: 'render_mermaid_svg',
      arguments: { diagram: 'graph LR\n  A --> B', bg: 'red' },
    })
    expect(result.isError).toBe(true)
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

  it('render_mermaid_ascii advertises and honours profile: markdown (#2011)', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === 'render_mermaid_ascii')
    expect(tool?.inputSchema.properties).toHaveProperty('profile')

    const run = async (args: Record<string, unknown>) => {
      const r = await client.callTool({
        name: 'render_mermaid_ascii',
        arguments: { diagram: 'graph LR\n  A --> B', ...args },
      })
      expect(r.isError).toBeFalsy()
      const c = r.content
      if (!Array.isArray(c) || c[0]?.type !== 'text') throw new Error('text')
      return c[0].text as string
    }
    expect(await run({})).toMatch(/[^\x00-\x7f]/)
    expect(await run({ profile: 'markdown' })).not.toMatch(/[^\x00-\x7f]/)
    expect(await run({ profile: 'markdown', useAscii: false })).toMatch(
      /[^\x00-\x7f]/,
    )

    const bad = await client.callTool({
      name: 'render_mermaid_ascii',
      arguments: { diagram: 'graph LR\n  A --> B', profile: 'nope' },
    })
    expect(bad.isError).toBe(true)
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

  it('checks sequence diagram activation balance via a real tool call', async () => {
    const result = await client.callTool({
      name: 'check_mermaid_sequence_activations',
      arguments: {
        diagram: 'sequenceDiagram\n  activate A\n  A->>B: hello',
      },
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
    const report = JSON.parse(content[0].text) as {
      ok: boolean
      issues: unknown[]
    }
    expect(report.ok).toBe(false)
    expect(report.issues).toEqual([
      expect.objectContaining({ code: 'DANGLING_ACTIVATION', actorId: 'A' }),
    ])
  })

  it('fixes a dangling activation via a real tool call', async () => {
    const result = await client.callTool({
      name: 'fix_mermaid_sequence_activations',
      arguments: {
        diagram: 'sequenceDiagram\n  activate A\n  A->>B: hello',
      },
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
    const report = JSON.parse(content[0].text) as {
      ok: boolean
      fixedDiagram: string
      fixesApplied: string[]
      remainingIssues: unknown[]
    }
    expect(report.ok).toBe(true)
    expect(report.fixedDiagram).toContain('deactivate A')
    expect(report.fixesApplied).toHaveLength(1)
    expect(report.remainingIssues).toEqual([])
  })

  // MCP 2025-06-18 tools spec: a tool with an outputSchema returns
  // structuredContent conforming to it, plus the JSON as a text block.
  // https://modelcontextprotocol.io/specification/2025-06-18/server/tools#output-schema
  it.each([
    ['list_themes', {}],
    ['list_diagram_types', {}],
    ['validate_mermaid', { diagram: 'flowchart TD\nA-->B' }],
    ['validate_mermaid', { diagram: 'flowchart TD\nA-->' }],
    [
      'check_mermaid_sequence_activations',
      { diagram: 'sequenceDiagram\nactivate A' },
    ],
    [
      'fix_mermaid_sequence_activations',
      { diagram: 'sequenceDiagram\nactivate A' },
    ],
  ])(
    '%s returns structuredContent matching its text block',
    async (name, args) => {
      const { tools } = await client.listTools()
      expect(tools.find((t) => t.name === name)?.outputSchema).toBeDefined()
      const res = await client.callTool({ name, arguments: args })
      const first = (res.content as { type: string; text: string }[])[0]
      expect(res.structuredContent).toEqual(JSON.parse(first!.text))
    },
  )
})
