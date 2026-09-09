// ============================================================================
// ASCII renderer — drawing operations
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/draw.go + cmd/arrow.go.
// Contains the top-level draw orchestrator (drawGraph) that layers node,
// edge, bundle, and subgraph canvases together, plus the character-role
// tracking used for colored output.
//
// The individual drawing operations live in sibling modules, split out for
// navigability:
//   - draw-boxes.ts      node/box drawing, multi-section boxes
//   - draw-lines.ts      8-directional line drawing
//   - draw-arrows.ts     arrow paths, corners, arrowheads, labels
//   - draw-bundles.ts    bundled (fan-in/fan-out) edge drawing
//   - draw-subgraphs.ts  subgraph border + label drawing
// This file re-exports their public entry points so `./draw.ts` remains a
// stable import path for the rest of the ASCII renderer.
// ============================================================================

import type {
  Canvas,
  DrawingCoord,
  AsciiGraph,
  AsciiSubgraph,
  EdgeBundle,
} from './types.ts'
import { mergeCanvases, write } from './canvas.ts'
import type { RoleCanvas, CharRole } from './types.ts'
import { setRole } from './canvas.ts'
import { drawArrow } from './draw-arrows.ts'
import {
  drawBundledEdgeSegment,
  drawBundleSharedPath,
  drawBundleArrowhead,
  drawBundleArrowheadStart,
  drawBundledEdgeArrowhead,
  drawBundledEdgeArrowheadStart,
  drawJunctionCharacter,
} from './draw-bundles.ts'
import { drawSubgraphBox, drawSubgraphLabel } from './draw-subgraphs.ts'

export {
  drawNode,
  drawBox,
  drawMultiBox,
  measureMultiBox,
  classifyBoxChar,
} from './draw-boxes.ts'
export { drawLine } from './draw-lines.ts'
export { drawArrow, drawSubgraphBox, drawSubgraphLabel }

// ============================================================================
// Top-level draw orchestrator
// ============================================================================

/** Sort subgraphs by nesting depth (shallowest first) for correct layered rendering. */
function sortSubgraphsByDepth(subgraphs: AsciiSubgraph[]): AsciiSubgraph[] {
  function getDepth(sg: AsciiSubgraph): number {
    return sg.parent === null ? 0 : 1 + getDepth(sg.parent)
  }
  const sorted = [...subgraphs]
  sorted.sort((a, b) => getDepth(a) - getDepth(b))
  return sorted
}

// ============================================================================
// Role tracking helpers for colored output
// ============================================================================

/**
 * Fill roles for all non-space characters in a canvas region.
 * Used after drawing a layer to record what role those characters have.
 */
function fillRolesFromCanvas(
  roleCanvas: RoleCanvas,
  canvas: Canvas,
  offset: DrawingCoord,
  role: CharRole,
): void {
  for (let x = 0; x < canvas.length; x++) {
    for (let y = 0; y < (canvas[0]?.length ?? 0); y++) {
      const char = canvas[x]?.[y]
      if (char && char !== ' ') {
        const rx = x + offset.x
        const ry = y + offset.y
        // Use setRole which auto-expands the role canvas if needed
        if (rx >= 0 && ry >= 0) {
          setRole(roleCanvas, rx, ry, role)
        }
      }
    }
  }
}

/**
 * Fill roles for multiple canvases with the same role.
 */
function fillRolesFromCanvases(
  roleCanvas: RoleCanvas,
  canvases: Canvas[],
  offset: DrawingCoord,
  role: CharRole,
): void {
  for (const canvas of canvases) {
    fillRolesFromCanvas(roleCanvas, canvas, offset, role)
  }
}

/**
 * Special handling for node boxes: border chars get 'border' role, text gets 'text' role.
 * Detects text by checking if character is alphanumeric or common punctuation.
 */
function fillRolesForNodeBox(
  roleCanvas: RoleCanvas,
  canvas: Canvas,
  offset: DrawingCoord,
): void {
  const isBorderChar = (c: string) => /^[┌┐└┘├┤┬┴┼│─╭╮╰╯+\-|.':]$/.test(c)

  for (let x = 0; x < canvas.length; x++) {
    for (let y = 0; y < (canvas[0]?.length ?? 0); y++) {
      const char = canvas[x]?.[y]
      if (char && char !== ' ') {
        const rx = x + offset.x
        const ry = y + offset.y
        // Use setRole which auto-expands the role canvas if needed
        if (rx >= 0 && ry >= 0) {
          setRole(roleCanvas, rx, ry, isBorderChar(char) ? 'border' : 'text')
        }
      }
    }
  }
}

/**
 * Main draw function — renders the entire graph onto the canvas.
 * Drawing order matters for correct layering:
 * 1. Subgraph borders (bottom layer)
 * 2. Node boxes
 * 3. Edge paths (lines)
 * 4. Edge corners
 * 5. Arrowheads
 * 6. Box-start junctions
 * 7. Edge labels
 * 8. Subgraph labels (top layer)
 *
 * Also fills the roleCanvas with character roles for colored output.
 */
export function drawGraph(graph: AsciiGraph): Canvas {
  const useAscii = graph.config.useAscii
  const zero: DrawingCoord = { x: 0, y: 0 }

  // Draw subgraph borders
  const sortedSgs = sortSubgraphsByDepth(graph.subgraphs)
  for (const sg of sortedSgs) {
    const sgCanvas = drawSubgraphBox(sg, graph)
    const offset: DrawingCoord = { x: sg.minX, y: sg.minY }
    graph.canvas = mergeCanvases(graph.canvas, offset, useAscii, sgCanvas)
    // Subgraph borders get 'border' role
    fillRolesFromCanvas(graph.roleCanvas, sgCanvas, offset, 'border')
  }

  // Draw node boxes
  for (const node of graph.nodes) {
    if (!node.drawn && node.drawingCoord && node.drawing) {
      graph.canvas = mergeCanvases(
        graph.canvas,
        node.drawingCoord,
        useAscii,
        node.drawing,
      )
      // Node boxes: detect border vs text characters
      fillRolesForNodeBox(graph.roleCanvas, node.drawing, node.drawingCoord)
      node.drawn = true
    }
  }

  // Collect all edge drawing layers
  const lineCanvases: Canvas[] = []
  const cornerCanvases: Canvas[] = []
  const arrowHeadEndCanvases: Canvas[] = []
  const arrowHeadStartCanvases: Canvas[] = []
  const boxStartCanvases: Canvas[] = []
  const labelCanvases: Canvas[] = []
  const junctionCanvases: Canvas[] = []

  // Track which bundles have been processed (to draw shared paths only once)
  const processedBundles = new Set<EdgeBundle>()

  for (const edge of graph.edges) {
    // Handle bundled edges specially
    if (edge.bundle && edge.pathToJunction) {
      const bundle = edge.bundle

      // Draw this edge's individual path (source → junction for fan-in, junction → target for fan-out)
      const [pathC, boxStartC, , , cornersC, labelC] = drawBundledEdgeSegment(
        graph,
        edge,
        bundle,
      )
      lineCanvases.push(pathC)
      cornerCanvases.push(cornersC)
      boxStartCanvases.push(boxStartC)
      labelCanvases.push(labelC)

      // For fan-in bundles, draw a start arrowhead at each individual source
      if (bundle.type === 'fan-in' && edge.hasArrowStart) {
        const arrowHeadStartC = drawBundledEdgeArrowheadStart(graph, edge)
        arrowHeadStartCanvases.push(arrowHeadStartC)
      }

      // Draw the bundle's shared path and arrowhead only once
      if (!processedBundles.has(bundle)) {
        processedBundles.add(bundle)

        // Draw shared path (junction → target for fan-in, source → junction for fan-out)
        const [sharedPathC, sharedCornersC] = drawBundleSharedPath(
          graph,
          bundle,
        )
        lineCanvases.push(sharedPathC)
        cornerCanvases.push(sharedCornersC)

        // Draw arrowhead at target for fan-in (once for all edges in bundle)
        if (bundle.type === 'fan-in') {
          const arrowHeadC = drawBundleArrowhead(graph, bundle)
          arrowHeadEndCanvases.push(arrowHeadC)
        }

        // Draw start arrowhead at the shared source for fan-out (once for all
        // edges in the bundle — the trunk leaving the source is drawn once,
        // so it only gets a start arrowhead when every edge agrees on one).
        if (
          bundle.type === 'fan-out' &&
          bundle.edges.every((e) => e.hasArrowStart)
        ) {
          const arrowHeadStartC = drawBundleArrowheadStart(graph, bundle)
          arrowHeadStartCanvases.push(arrowHeadStartC)
        }

        // Draw junction character
        const junctionC = drawJunctionCharacter(graph, bundle)
        junctionCanvases.push(junctionC)
      }

      // For fan-out bundles, draw arrowhead at each target
      if (bundle.type === 'fan-out' && edge.hasArrowEnd) {
        const arrowHeadC = drawBundledEdgeArrowhead(graph, edge)
        arrowHeadEndCanvases.push(arrowHeadC)
      }
    } else {
      // Non-bundled edge: use standard drawing
      const [
        pathC,
        boxStartC,
        arrowHeadEndC,
        arrowHeadStartC,
        cornersC,
        labelC,
      ] = drawArrow(graph, edge)
      lineCanvases.push(pathC)
      cornerCanvases.push(cornersC)
      arrowHeadEndCanvases.push(arrowHeadEndC)
      arrowHeadStartCanvases.push(arrowHeadStartC)
      boxStartCanvases.push(boxStartC)
      labelCanvases.push(labelC)
    }
  }

  // Merge edge layers in order and track roles
  // Note: arrowHeadStart is merged AFTER boxStart so bidirectional arrows
  // properly overwrite the box connector at the source end
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...lineCanvases)
  fillRolesFromCanvases(graph.roleCanvas, lineCanvases, zero, 'line')

  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...cornerCanvases)
  fillRolesFromCanvases(graph.roleCanvas, cornerCanvases, zero, 'corner')

  graph.canvas = mergeCanvases(
    graph.canvas,
    zero,
    useAscii,
    ...junctionCanvases,
  )
  fillRolesFromCanvases(graph.roleCanvas, junctionCanvases, zero, 'junction')

  graph.canvas = mergeCanvases(
    graph.canvas,
    zero,
    useAscii,
    ...arrowHeadEndCanvases,
  )
  fillRolesFromCanvases(graph.roleCanvas, arrowHeadEndCanvases, zero, 'arrow')

  graph.canvas = mergeCanvases(
    graph.canvas,
    zero,
    useAscii,
    ...boxStartCanvases,
  )
  fillRolesFromCanvases(graph.roleCanvas, boxStartCanvases, zero, 'junction')

  graph.canvas = mergeCanvases(
    graph.canvas,
    zero,
    useAscii,
    ...arrowHeadStartCanvases,
  )
  fillRolesFromCanvases(graph.roleCanvas, arrowHeadStartCanvases, zero, 'arrow')

  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...labelCanvases)
  fillRolesFromCanvases(graph.roleCanvas, labelCanvases, zero, 'text')

  // Draw subgraph labels last (on top)
  for (const sg of graph.subgraphs) {
    if (sg.nodes.length === 0) continue
    const [labelCanvas, offset, footprint] = drawSubgraphLabel(sg, graph)
    graph.canvas = mergeCanvases(graph.canvas, offset, useAscii, labelCanvas)
    fillRolesFromCanvas(graph.roleCanvas, labelCanvas, offset, 'text')
    // mergeCanvases treats an overlay's space characters as transparent (so
    // sparse edge/arrow layers don't blank each other out) — but the title's
    // own footprint should win outright, including cells whose character is
    // a literal space (e.g. "US West Region"). Otherwise a connector line
    // already drawn at that cell shows through the label's internal space
    // (issue #447: rendered as "US West│Region"). Force those specific
    // cells, bypassing mergeCanvases's space-skip.
    for (const { x, y } of footprint) {
      const ch = labelCanvas[x]?.[y]
      if (ch === ' ') {
        write(graph.canvas, x + offset.x, y + offset.y, ch)
        setRole(graph.roleCanvas, x + offset.x, y + offset.y, 'text')
      }
    }
  }

  return graph.canvas
}
