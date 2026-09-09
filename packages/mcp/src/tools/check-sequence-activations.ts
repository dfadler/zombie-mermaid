// ============================================================================
// zombie-mermaid MCP server — `check_mermaid_sequence_activations` tool
//
// A mechanical, deterministic semantic check that complements the existing
// render tools: every "activate X" (or "+" arrow shorthand) in a Mermaid
// sequence diagram must be closed by a matching "deactivate X" ("-"
// shorthand) before the diagram ends. No LLM judge involved — see
// packages/mermaid-parser/src/sequence/activation-check.ts for the actual
// check, which reuses the same activation-stack bookkeeping
// packages/svg-renderer/src/sequence/layout.ts already runs to *draw*
// activation bars.
//
// Why this tool, and why it isn't duplicating agentic-mermaid's `verify`
// tool (github.com/adewale/agentic-mermaid): that tool's own docs describe
// it as reporting "structural, geometric, and lint warnings" — dangling
// edges, label overflow, duplicate/unreachable nodes — a general
// graph-structure check with no sequence-diagram-specific handling. Neither
// it nor ordinary Mermaid syntax validators check activation/deactivation
// balance, which research behind issue #536 found is where LLM-generated
// sequence diagrams actually go wrong most often (not basic syntax).
// ============================================================================

import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { detectDiagramType, splitStatements } from '@zombie-mermaid/core'
import {
  parseSequenceDiagram,
  checkActivationBalance,
} from '@zombie-mermaid/mermaid-parser'

export const checkSequenceActivationsInputShape = {
  diagram: z
    .string()
    .min(1, 'diagram must not be empty')
    .describe(
      'Mermaid sequence diagram source text, e.g. "sequenceDiagram\\n  ' +
        'A->>+B: hi\\n  B-->>-A: bye". Must start with "sequenceDiagram" ' +
        '— this tool does not check other diagram types.',
    ),
}

export interface CheckSequenceActivationsToolArgs {
  diagram: string
}

/**
 * MCP tool handler for `check_mermaid_sequence_activations`. Parses the
 * given source as a Mermaid sequence diagram and reports every
 * activation/deactivation imbalance as a structured JSON result (`ok` plus
 * an `issues` array) — this tool never renders anything.
 *
 * Returns an MCP tool error (`isError: true`, not a thrown exception) both
 * for invalid Mermaid syntax and for a non-sequence diagram, since this
 * check only makes sense for `sequenceDiagram` source.
 */
export function checkSequenceActivationsHandler(
  input: CheckSequenceActivationsToolArgs,
): CallToolResult {
  try {
    const diagramType = detectDiagramType(input.diagram)
    if (diagramType !== 'sequence') {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text:
              'This tool only checks sequence diagrams (source must start ' +
              `with "sequenceDiagram"); detected diagram type: "${diagramType}".`,
          },
        ],
      }
    }
    const lines = splitStatements(input.diagram)
    const diagram = parseSequenceDiagram(lines)
    const result = checkActivationBalance(diagram)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to check diagram activations: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    }
  }
}
