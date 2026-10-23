// ============================================================================
// zombie-mermaid MCP server
//
// Wires the library's existing SVG/ASCII rendering functions, plus a
// mechanical sequence-diagram semantic check, up as Model Context Protocol
// tools. No rendering or checking logic lives here — see src/mcp/tools/*.ts
// for the thin per-tool adapters, src/index.ts / src/ascii/index.ts for the
// actual renderers, and packages/mermaid-parser/src/sequence/activation-check.ts
// for the check.
// ============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getPackageVersion } from '../../../src/package-info.ts'
import { renderSvgInputShape } from './tools/render-svg.ts'
import { renderAsciiInputShape } from './tools/render-ascii.ts'
import {
  renderSvgHandlerAsync,
  renderAsciiHandlerAsync,
} from './tools/render-async.ts'
import {
  checkSequenceActivationsInputShape,
  checkSequenceActivationsOutputShape,
  checkSequenceActivationsHandler,
} from './tools/check-sequence-activations.ts'
import {
  fixSequenceActivationsInputShape,
  fixSequenceActivationsOutputShape,
  fixSequenceActivationsHandler,
} from './tools/fix-sequence-activations.ts'

import {
  validateInputShape,
  validateOutputShape,
  validateHandler,
} from './tools/validate.ts'
import {
  listThemesHandler,
  listThemesOutputShape,
} from './tools/list-themes.ts'
import {
  listDiagramTypesHandler,
  listDiagramTypesOutputShape,
} from './tools/list-diagram-types.ts'

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
  // SVG/ASCII renders run in a worker (tools/render-worker.ts), which registers elkjs itself.
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
        'diagrams, ER diagrams, and XY charts. Optional bg/fg hex colors ' +
        'override the theme. Optional outputPath writes the SVG to a .svg ' +
        "file inside the server's working directory and returns " +
        '{ saved, size } instead of the SVG text.',
      inputSchema: renderSvgInputShape,
      annotations: {
        title: 'Render Mermaid diagram to SVG',
        // Only writes when the caller passes outputPath, but the hint must
        // describe the tool's worst case: it can overwrite an existing .svg.
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    renderSvgHandlerAsync,
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
    renderAsciiHandlerAsync,
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
      outputSchema: checkSequenceActivationsOutputShape,
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

  server.registerTool(
    'fix_mermaid_sequence_activations',
    {
      title: 'Fix Mermaid sequence diagram activation balance',
      description:
        'Check a Mermaid sequence diagram for activation/deactivation ' +
        'imbalance and, where mechanically safe, return a corrected ' +
        'version: a dangling "activate X" (or "+" shorthand) with no ' +
        'matching "deactivate X" gets one appended. An unmatched ' +
        '"deactivate X" with nothing open is reported but not auto-fixed ' +
        '(no safe, unambiguous edit exists without source-position ' +
        'tracking). Returns a JSON report ({ ok, fixedDiagram, ' +
        'fixesApplied, remainingIssues }) rather than rendering anything. ' +
        'Mechanical and deterministic — no LLM judgment involved. Only ' +
        'sequence diagrams are supported.',
      inputSchema: fixSequenceActivationsInputShape,
      outputSchema: fixSequenceActivationsOutputShape,
      annotations: {
        title: 'Fix Mermaid sequence diagram activation balance',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    fixSequenceActivationsHandler,
  )

  server.registerTool(
    'list_themes',
    {
      title: 'List built-in diagram themes',
      description:
        'List the names of the built-in themes accepted by the `theme` ' +
        'argument of render_mermaid_svg.',
      inputSchema: {},
      outputSchema: listThemesOutputShape,
      annotations: {
        title: 'List built-in diagram themes',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    listThemesHandler,
  )

  server.registerTool(
    'list_diagram_types',
    {
      title: 'List supported diagram types',
      description:
        'List the Mermaid diagram types this library detects and renders ' +
        '(flowchart also covers state diagrams).',
      inputSchema: {},
      outputSchema: listDiagramTypesOutputShape,
      annotations: {
        title: 'List supported diagram types',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    listDiagramTypesHandler,
  )

  server.registerTool(
    'validate_mermaid',
    {
      title: 'Validate Mermaid diagram syntax',
      description:
        'Parse Mermaid source without rendering it. Returns JSON ' +
        '{ valid, diagnostics }; each diagnostic has { line, sourceLine, ' +
        'message } when the parser names a line, else just { message }.',
      inputSchema: validateInputShape,
      outputSchema: validateOutputShape,
      annotations: {
        title: 'Validate Mermaid diagram syntax',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    validateHandler,
  )

  return server
}
