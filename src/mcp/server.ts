// ============================================================================
// zombie-mermaid MCP server
//
// Wires the library's existing SVG/ASCII rendering functions, plus a
// mechanical sequence-diagram semantic check, up as Model Context Protocol
// tools. No rendering or checking logic lives here — see src/mcp/tools/*.ts
// for the thin per-tool adapters, src/index.ts / src/ascii/index.ts for the
// actual renderers, and src/sequence/activation-check.ts for the check.
// ============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPackageVersion } from '../package-info.ts'
import { renderSvgInputShape, renderSvgHandler } from './tools/render-svg.ts'
import {
  renderAsciiInputShape,
  renderAsciiHandler,
} from './tools/render-ascii.ts'
import {
  checkSequenceActivationsInputShape,
  checkSequenceActivationsHandler,
} from './tools/check-sequence-activations.ts'

/**
 * Build a zombie-mermaid MCP server exposing `render_mermaid_svg`,
 * `render_mermaid_ascii`, and `check_mermaid_sequence_activations` tools.
 *
 * Not connected to any transport — callers wire it up. See
 * src/cli/mcp.ts for the stdio entry point used by `zombie-mermaid mcp`,
 * or connect it to the MCP SDK's `InMemoryTransport` to embed/test it
 * in-process without spawning anything.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'zombie-mermaid',
    version: getPackageVersion(),
  })

  server.registerTool(
    'render_mermaid_svg',
    {
      title: 'Render Mermaid diagram to SVG',
      description:
        'Render Mermaid diagram source to a self-contained SVG string. ' +
        'Supports flowcharts, state diagrams, sequence diagrams, class ' +
        'diagrams, ER diagrams, and XY charts.',
      inputSchema: renderSvgInputShape,
      annotations: {
        title: 'Render Mermaid diagram to SVG',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    renderSvgHandler,
  )

  server.registerTool(
    'render_mermaid_ascii',
    {
      title: 'Render Mermaid diagram to ASCII/Unicode art',
      description:
        'Render Mermaid diagram source to a plain-text ASCII or Unicode ' +
        'box-drawing diagram, suitable for a terminal or a chat/agent ' +
        'context. Supports flowcharts, state diagrams, sequence diagrams, ' +
        'class diagrams, and ER diagrams.',
      inputSchema: renderAsciiInputShape,
      annotations: {
        title: 'Render Mermaid diagram to ASCII/Unicode art',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    renderAsciiHandler,
  )

  server.registerTool(
    'check_mermaid_sequence_activations',
    {
      title: 'Check Mermaid sequence diagram activation balance',
      description:
        'Check a Mermaid sequence diagram for activation/deactivation ' +
        'imbalance: every "activate X" (or "+" arrow shorthand) must be ' +
        'closed by a matching "deactivate X" ("-" shorthand). Returns a ' +
        'JSON report ({ ok, issues }) rather than rendering anything. ' +
        'Mechanical and deterministic — no LLM judgment involved. Only ' +
        'sequence diagrams are supported.',
      inputSchema: checkSequenceActivationsInputShape,
      annotations: {
        title: 'Check Mermaid sequence diagram activation balance',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    checkSequenceActivationsHandler,
  )

  return server
}
