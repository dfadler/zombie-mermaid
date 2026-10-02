/**
 * Extra instructions a caller can give the layout pipeline for one run, for
 * things a `MermaidGraph` has no way to say. Used by the compound layout
 * (`compound-flat.ts`), which adds invisible helper nodes and edges to the
 * graph and has to size, order and weight them.
 */
export interface LayoutHints {
  /** Node widths in px, used instead of the size worked out from the label. */
  fixedWidths?: ReadonlyMap<string, number>
  /**
   * Indices of edges that only shape the layout and are never drawn. They are
   * not straightened, so they can't drag the nodes they join into line.
   */
  looseEdges?: ReadonlySet<number>
  /**
   * Indices of real edges to leave out of the layout. The caller draws them
   * itself, so ELK doesn't route them round the helper nodes.
   */
  detachedEdges?: ReadonlySet<number>
  /**
   * The order a back-edge search starts from, when it must differ from the
   * graph's node order (which is also the order ELK is given the nodes in).
   */
  walkOrder?: readonly string[]
  /** Keep every layer's nodes in the order the graph lists them. */
  forceNodeOrder?: boolean
}
