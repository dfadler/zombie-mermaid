// ============================================================================
// zombie-mermaid — shared diagram-type detection
//
// Both the SVG renderer (src/index.ts) and the ASCII renderer
// (src/ascii/index.ts) need to classify Mermaid source text before
// dispatching to the right parse/layout/render pipeline. This module is the
// single source of truth for that classification so the two backends can
// never drift out of sync with each other again.
// ============================================================================

import { splitStatements } from './statements.ts'

/** The diagram types this library can detect and route to a renderer. */
export type DiagramType = 'flowchart' | 'sequence' | 'class' | 'er' | 'xychart'

/**
 * Detect the diagram type from the mermaid source text.
 * Returns the type keyword used for routing to the correct pipeline.
 *
 * The header keyword is the first *statement*, not the first line: Mermaid
 * allows `;` as a statement separator, so `flowchart TD;A-->B` has its header
 * and first edge on one line. Uses the same splitter every parser uses, so
 * routing and parsing can never disagree about where the header ends.
 */
export function detectDiagramType(text: string): DiagramType {
  const firstLine = splitStatements(text)[0]?.toLowerCase() ?? ''

  if (/^xychart(?:-beta)?(?:\s|$)/.test(firstLine)) return 'xychart'
  if (/^sequencediagram\s*$/.test(firstLine)) return 'sequence'
  if (/^classdiagram\s*$/.test(firstLine)) return 'class'
  if (/^erdiagram\s*$/.test(firstLine)) return 'er'

  // Default: flowchart/state (handled by parseMermaid internally)
  return 'flowchart'
}
