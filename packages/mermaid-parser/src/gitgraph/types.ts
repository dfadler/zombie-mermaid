// ============================================================================
// GitGraph types
//
// The parsed model of a Mermaid `gitGraph` (what Mermaid's `gitGraphAst.ts`
// keeps in its database), plus the positioned model the SVG renderer draws
// (`PositionedGitGraph`, produced by `layoutGitGraph` in
// `@zombie-mermaid/svg-renderer`). The ASCII renderer works from the parsed
// `GitGraph` directly.
// ============================================================================

/** Mermaid's `commitType` names; `MERGE` and `CHERRY_PICK` are only produced by `merge` and `cherry-pick`. */
export type GitCommitType =
  | 'NORMAL'
  | 'REVERSE'
  | 'HIGHLIGHT'
  | 'MERGE'
  | 'CHERRY_PICK'

export type GitGraphDirection = 'LR' | 'TB' | 'BT'

/** One commit, in the order it was written (`seq`). */
export interface GitCommit {
  /** The `id:` given, or `<seq>-<7 hex>` (Mermaid's hex is random, this one is derived from the commit). */
  id: string
  /** `msg:` of a commit; the generated text of a merge or cherry-pick. */
  message: string
  seq: number
  type: GitCommitType
  /** The `type:` written on a merge (it changes the symbol, not the kind). */
  customType?: GitCommitType
  /** A merge that was given an `id:`; only those get a label. */
  customId?: boolean
  tags: string[]
  /** Ids of the parent commits: the branch head, then the merged or picked commit. */
  parents: string[]
  branch: string
}

/** The `gitGraph` keys of `%%{init}%%` / front matter config, resolved against Mermaid's defaults. */
export interface GitGraphConfig {
  mainBranchName: string
  mainBranchOrder: number
  showCommitLabel: boolean
  showBranches: boolean
  rotateCommitLabel: boolean
  parallelCommits: boolean
}

/** Mermaid's defaults for {@link GitGraphConfig} (`defaultConfig.gitGraph`, 12.3.0). */
export const GIT_GRAPH_DEFAULTS: GitGraphConfig = {
  mainBranchName: 'main',
  mainBranchOrder: 0,
  showCommitLabel: true,
  showBranches: true,
  rotateCommitLabel: true,
  parallelCommits: false,
}

/** A parsed Mermaid gitGraph. */
export interface GitGraph {
  /** `gitGraph LR:` (the default), `TB:` or `BT:`. */
  direction: GitGraphDirection
  /** `title …`; the last one wins. */
  title?: string
  /** Branch names in drawing order (by `order:`, ties in creation order); the main branch is first unless ordered after. */
  branches: string[]
  /** Commits in source order. */
  commits: GitCommit[]
  config: GitGraphConfig
}

// ---------------------------------------------------------------------------
// Positioned model
// ---------------------------------------------------------------------------

/** A primitive of a commit symbol, label or tag, in Mermaid's draw order. */
export type PositionedGitShape =
  | {
      kind: 'circle'
      cx: number
      cy: number
      r: number
      cls: string
      /** `fill` attribute (the white dots of a cherry-pick). */
      fill?: string
    }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; cls: string }
  | { kind: 'path'; d: string; cls: string }
  | {
      kind: 'line'
      x1: number
      y1: number
      x2: number
      y2: number
      cls: string
      /** `stroke` attribute (the white strokes of a cherry-pick). */
      stroke?: string
    }

export interface PositionedGitBranch {
  name: string
  /** Mermaid's `branchN` / `labelN` colour index (0..7). */
  colorIndex: number
  line: { x1: number; y1: number; x2: number; y2: number }
  /** Label background rect with its translate. */
  bkg: {
    x: number
    y: number
    w: number
    h: number
    /** `translate(tx, ty)`, LR only. */
    tx?: number
    ty?: number
  }
  /** Where the label text block sits (translate of the `label` group). */
  label: { x: number; y: number }
}

export interface PositionedGitArrow {
  d: string
  colorIndex: number
}

export interface PositionedGitCommitLabel {
  text: string
  /** `translate(x, y) rotate(a, cx, cy)` of the wrapping group, when rotated. */
  groupTransform?: string
  /** `rotate(...)` on the rect and text (TB/BT only). */
  rotate?: string
  rect: { x: number; y: number; w: number; h: number }
  textPos: { x: number; y: number }
}

export interface PositionedGitTag {
  text: string
  /** Polygon points, ready for the `points` attribute. */
  points: string
  hole: { cx: number; cy: number }
  textPos: { x: number; y: number }
  /** Shared transform of polygon, hole and text for TB/BT (they differ in translate only). */
  polygonTransform?: string
  holeTransform?: string
  textTransform?: string
}

export interface PositionedGitCommit {
  id: string
  shapes: PositionedGitShape[]
  label?: PositionedGitCommitLabel
  tags: PositionedGitTag[]
}

/** A gitGraph ready to draw; coordinates are in Mermaid's user space and the viewBox is the origin. */
export interface PositionedGitGraph {
  direction: GitGraphDirection
  /** viewBox (`x y width height`). */
  viewBox: { x: number; y: number; width: number; height: number }
  branches: PositionedGitBranch[]
  arrows: PositionedGitArrow[]
  commits: PositionedGitCommit[]
  /** The centred heading; `x` is the middle of the drawing. */
  title?: { text: string; x: number; y: number }
  showBranches: boolean
}
