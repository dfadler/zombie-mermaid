// ============================================================================
// zombie-mermaid MCP server — `describe_diagram` tool
//
// Parse only: no layout, no drawing. Returns the parsed model's nodes, edges
// and subgraphs as JSON for agent linting and diffing (#1881). Flowcharts and
// state diagrams only (the one parser that yields a node/edge graph). The
// schema is unversioned and may change; see docs/mcp-tools.md.
// ============================================================================

import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { detectDiagramType, type MermaidSubgraph } from '@zombie-mermaid/core'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { renderErrorResult } from './parse-diagnostics.ts'

export const describeDiagramInputShape = {
  diagram: z
    .string()
    .describe('Flowchart or state diagram source to parse (not rendered).'),
}

interface SubgraphOut {
  id: string
  label: string
  nodeIds: string[]
  children: SubgraphOut[]
}

const subgraphSchema: z.ZodType<SubgraphOut> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    nodeIds: z.array(z.string()),
    children: z.array(subgraphSchema),
  }),
)

export const describeDiagramOutputShape = {
  diagramType: z.string(),
  direction: z.string(),
  nodes: z.array(
    z.object({ id: z.string(), label: z.string(), shape: z.string() }),
  ),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
      style: z.string(),
      hasArrowStart: z.boolean(),
      hasArrowEnd: z.boolean(),
    }),
  ),
  subgraphs: z.array(subgraphSchema),
}

const subgraph = (s: MermaidSubgraph): SubgraphOut => ({
  id: s.id,
  label: s.label,
  nodeIds: s.nodeIds,
  children: s.children.map(subgraph),
})

export function describeDiagramHandler(input: {
  diagram: string
}): CallToolResult {
  try {
    const diagramType = detectDiagramType(input.diagram)
    if (diagramType !== 'flowchart') {
      throw new Error(
        `only flowchart and state diagrams are supported, got "${diagramType}"`,
      )
    }
    const g = parseMermaid(input.diagram)
    const result = {
      diagramType,
      direction: g.direction,
      nodes: [...g.nodes.values()].map(({ id, label, shape }) => ({
        id,
        label,
        shape,
      })),
      edges: g.edges.map((e) => ({
        source: e.source,
        target: e.target,
        ...(e.label !== undefined && { label: e.label }),
        style: e.style,
        hasArrowStart: e.hasArrowStart,
        hasArrowEnd: e.hasArrowEnd,
      })),
      subgraphs: g.subgraphs.map(subgraph),
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    }
  } catch (err) {
    return renderErrorResult('describe_diagram', err, input.diagram)
  }
}
