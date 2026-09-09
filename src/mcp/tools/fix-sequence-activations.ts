// ============================================================================
// zombie-mermaid MCP server — `fix_mermaid_sequence_activations` tool
//
// The "optionally proposes a fix" half of issue #539, complementing
// `check_mermaid_sequence_activations` (which only reports issues). Reuses
// packages/mermaid-parser/src/sequence/activation-fix.ts, which — see that
// file's header — only auto-fixes DANGLING_ACTIVATION (a mechanically safe,
// unambiguous append); UNMATCHED_DEACTIVATION comes back as a remaining
// issue for a human (or a future LLM-based layer) to resolve rather than
// risk an incorrect text edit.
// ============================================================================

import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { detectDiagramType } from '@zombie-mermaid/core'
import { fixActivationBalance } from '@zombie-mermaid/mermaid-parser'

export const fixSequenceActivationsInputShape = {
  diagram: z
    .string()
    .min(1, 'diagram must not be empty')
    .describe(
      'Mermaid sequence diagram source text, e.g. "sequenceDiagram\\n  ' +
        'activate A\\n  A->>B: hi". Must start with "sequenceDiagram" — ' +
        'this tool does not check other diagram types.',
    ),
}

export interface FixSequenceActivationsToolArgs {
  diagram: string
}

/**
 * MCP tool handler for `fix_mermaid_sequence_activations`. Parses the given
 * source as a Mermaid sequence diagram, checks activation/deactivation
 * balance, and returns a structured JSON result: `ok`, the (possibly
 * unchanged) `fixedDiagram`, `fixesApplied` (human-readable descriptions),
 * and any `remainingIssues` that couldn't be auto-fixed.
 *
 * Returns an MCP tool error (`isError: true`, not a thrown exception) both
 * for invalid Mermaid syntax and for a non-sequence diagram, matching
 * `check-sequence-activations.ts`'s error handling.
 */
export function fixSequenceActivationsHandler(
  input: FixSequenceActivationsToolArgs,
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
              'This tool only fixes sequence diagrams (source must start ' +
              `with "sequenceDiagram"); detected diagram type: "${diagramType}".`,
          },
        ],
      }
    }
    const result = fixActivationBalance(input.diagram)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to fix diagram activations: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    }
  }
}
