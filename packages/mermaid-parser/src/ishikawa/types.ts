// ============================================================================
// Ishikawa types
//
// The parsed model of a Mermaid `ishikawa` / `ishikawa-beta` diagram: a tree
// whose root is the effect (the fish's head), its children the categories
// (the big bones) and their descendants the causes (the small bones).
// ============================================================================

/** One bone: a category or a cause, with the causes under it. */
export interface IshikawaNode {
  text: string
  children: IshikawaNode[]
}

/** A parsed Mermaid ishikawa diagram; `root` is absent when no line follows the header. */
export interface Ishikawa {
  root?: IshikawaNode
  /** `ishikawa.diagramPadding` from `%%{init}%%` or front matter; the layout's default is 20. */
  diagramPadding?: number
  /** `look: handDrawn` from `%%{init}%%` or front matter, with `handDrawnSeed` (0 when unset). */
  handDrawn?: { seed: number }
}
