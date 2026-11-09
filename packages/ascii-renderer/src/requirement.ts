// ============================================================================
// ASCII renderer — requirement diagram
//
// Mermaid has no text mode for requirement diagrams, so there is no reference
// output to match. This draws the same content as the SVG: every requirement
// and element is a box (`<<Type>>`, the name, then its `ID:` / `Text:` rows
// under a blank row where the SVG has a divider), and every relationship is a
// line with its `<<relationship>>` label — dotted with an arrowhead for all
// but `contains`, which is solid with a `o` at the container's end (the SVG's
// circle-plus).
//
// The parsed diagram is lowered to the flowchart model and rides the
// flowchart grid layout and drawing pipeline, as `architecture` does.
// ============================================================================

import { withDirectionOverride } from '@zombie-mermaid/core'
import type {
  MermaidEdge,
  MermaidGraph,
  MermaidNode,
} from '@zombie-mermaid/core'
import {
  parseRequirementDiagram,
  requirementBodyRows,
} from '@zombie-mermaid/mermaid-parser'
import type { RequirementDiagram } from '@zombie-mermaid/mermaid-parser'
import { renderGraphAscii } from './flowchart.ts'
import type { FlowchartAsciiExtras } from './flowchart.ts'
import { displayWidth } from './display-width.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'

/** The box text: type and name, then the body rows padded to one width so they stay left-aligned. */
function boxLabel(diagram: RequirementDiagram, id: string): string {
  const node = diagram.nodes.find((n) => n.id === id)!
  const rows = requirementBodyRows(node)
  const width = Math.max(0, ...rows.map((r) => displayWidth(r)))
  const body = rows.map((r) => r + ' '.repeat(width - displayWidth(r)))
  return [
    `<<${node.typeLabel}>>`,
    node.id,
    ...(body.length > 0 ? ['', ...body] : []),
  ].join('\n')
}

/** Lower a requirement diagram to the flowchart model. */
export function requirementToGraph(diagram: RequirementDiagram): MermaidGraph {
  const nodes = new Map<string, MermaidNode>(
    diagram.nodes.map((n) => [
      n.id,
      { id: n.id, label: boxLabel(diagram, n.id), shape: 'rectangle' },
    ]),
  )
  const edges: MermaidEdge[] = diagram.relationships.map((r) => {
    const contains = r.type === 'contains'
    return {
      source: r.src,
      target: r.dst,
      label: `<<${r.type}>>`,
      style: contains ? 'solid' : 'dotted',
      hasArrowStart: contains,
      hasArrowEnd: !contains,
      ...(contains && { startMarker: 'circle' as const }),
    }
  })
  return {
    direction: diagram.direction ?? 'TB',
    nodes,
    edges,
    subgraphs: [],
    classDefs: diagram.classDefs,
    classAssignments: diagram.classAssignments,
    nodeStyles: diagram.nodeStyles,
    linkStyles: new Map(),
    interactions: new Map(),
  }
}

/** Render a `requirementDiagram` to ASCII/Unicode text art. */
export function renderRequirementAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: FlowchartAsciiExtras = {},
): string {
  const graph = requirementToGraph(parseRequirementDiagram(text))
  return renderGraphAscii(
    withDirectionOverride(graph, extras.direction),
    config,
    colorMode,
    theme,
    extras,
  )
}
