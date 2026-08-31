import type {
  MermaidGraph,
  MermaidNode,
  MermaidSubgraph,
  Direction,
  NodeShape,
  EdgeStyle,
} from './types.ts'
import { normalizeBrTags } from './multiline-utils.ts'
import { splitStatements } from './statements.ts'

import {
  matchExpandedBlock,
  parseExpandedMeta,
  resolveShapeName,
} from './expanded-shapes.ts'
import type { ExpandedNodeMeta } from './expanded-shapes.ts'
import { extractInitConfig } from './init-directive.ts'
import type { NodeInteraction } from './types.ts'
/** Remove a single layer of matching wrapping quotes (`"…"` or `'…'`). */
function stripWrappingQuotes(s: string): string {
  const t = s.trim()
  if (
    t.length >= 2 &&
    ((t[0] === '"' && t[t.length - 1] === '"') ||
      (t[0] === "'" && t[t.length - 1] === "'"))
  ) {
    return t.slice(1, -1)
  }
  return t
}

// ============================================================================
// Mermaid parser — flowcharts and state diagrams
//
// Supports:
//   Flowcharts: graph TD / flowchart LR
//   State diagrams: stateDiagram-v2
//
// Line-by-line regex approach — the grammar is regular enough
// that we don't need a grammar generator or full parser combinator.
// ============================================================================

// Exported for direct unit testing (see src/__tests__/parser.test.ts) —
// not otherwise part of this module's public parsing API.
export function isDirection(value: string): value is Direction {
  return (
    value === 'TD' ||
    value === 'TB' ||
    value === 'LR' ||
    value === 'BT' ||
    value === 'RL'
  )
}

/**
 * Normalize a regex-captured direction token to a `Direction`.
 *
 * Accepts `string | undefined` because every call site passes a regex
 * capture group value (`match[1]`, typed as possibly-`undefined` under
 * `noUncheckedIndexedAccess`) straight through. Each call site's regex
 * guards the capture with the same `(TD|TB|LR|BT|RL)` alternation
 * (case-insensitively), so the group always participates in the match in
 * practice — but that's a regex-structure guarantee the type checker can't
 * see across the call site. Validating `undefined` here, instead of
 * asserting non-null at each call site, turns a hypothetical violation into
 * a clear, descriptive error rather than a raw `undefined` crash.
 */
export function toDirection(raw: string | undefined): Direction {
  const upper = raw?.toUpperCase()
  if (upper === undefined || !isDirection(upper)) {
    throw new Error(`Invalid direction: "${raw}"`)
  }
  return upper
}

/**
 * Parse Mermaid text into a logical graph structure.
 * Auto-detects diagram type (flowchart or state diagram).
 * Throws on invalid/unsupported input.
 */
export function parseMermaid(text: string): MermaidGraph {
  /*
   * Init directives must be read from the raw lines: `%%{init: ...}%%` begins
   * with `%%`, so splitStatements — which treats `%%` as a comment and
   * truncates the line there — would otherwise discard it along with real
   * comments before it could be seen.
   */
  const initConfig = extractInitConfig(text.split('\n').map((l) => l.trim()))

  const lines = splitStatements(text)

  if (lines.length === 0) {
    throw new Error('Empty mermaid diagram')
  }

  // Detect diagram type from header
  const header = lines[0]!

  // State diagram: "stateDiagram-v2" or "stateDiagram"
  const graph = /^stateDiagram(-v2)?\s*$/i.test(header)
    ? parseStateDiagram(lines)
    : parseFlowchart(lines)

  graph.initConfig = initConfig
  return graph
}

// ============================================================================
// Flowchart parser
// ============================================================================

function parseFlowchart(lines: string[]): MermaidGraph {
  // parseFlowchart is only ever invoked by parseMermaid, which has already
  // verified `lines` is non-empty — but that invariant isn't visible to the
  // type checker across the function boundary, so validate it here instead
  // of asserting past it.
  const header = lines[0]
  if (header === undefined) {
    /* v8 ignore next */
    throw new Error('parseFlowchart called with no lines')
  }

  const headerMatch = header.match(
    /^(?:graph|flowchart)\s+(TD|TB|LR|BT|RL)\s*$/i,
  )
  if (!headerMatch) {
    throw new Error(
      `Invalid mermaid header: "${header}". Expected "graph TD", "flowchart LR", "stateDiagram-v2", etc.`,
    )
  }

  const direction = toDirection(headerMatch[1])

  const graph: MermaidGraph = {
    direction,
    nodes: new Map(),
    edges: [],
    subgraphs: [],
    classDefs: new Map(),
    classAssignments: new Map(),
    nodeStyles: new Map(),
    linkStyles: new Map(),
    interactions: new Map(),
  }

  // Subgraph stack for nested subgraphs.
  const subgraphStack: MermaidSubgraph[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // --- classDef: `classDef name prop:val,prop:val` ---
    const classDefMatch = line.match(/^classDef\s+(\w+)\s+(.+)$/)
    if (classDefMatch) {
      const name = classDefMatch[1]!
      const propsStr = classDefMatch[2]!
      const props = parseStyleProps(propsStr)
      graph.classDefs.set(name, props)
      continue
    }

    // --- class assignment: `class A,B className` ---
    // Allow an optional trailing semicolon (`class A,B foo;`) — Mermaid treats
    // it as valid/optional, and `classDef`/`style` already tolerate it via their
    // `(.+)$` capture. Without this, the semicolon form fails to match here and
    // falls through to node parsing, rendering a stray node labelled "class".
    const classAssignMatch = line.match(/^class\s+([\w,-]+)\s+(\w+)\s*;?\s*$/)
    if (classAssignMatch) {
      const nodeIds = classAssignMatch[1]!.split(',').map((s) => s.trim())
      const className = classAssignMatch[2]!
      for (const id of nodeIds) {
        graph.classAssignments.set(id, className)
      }
      continue
    }

    // --- style statement: `style A,B fill:#f00,stroke:#333` ---
    const styleMatch = line.match(/^style\s+([\w,-]+)\s+(.+)$/)
    if (styleMatch) {
      const nodeIds = styleMatch[1]!.split(',').map((s) => s.trim())
      const props = parseStyleProps(styleMatch[2]!)
      for (const id of nodeIds) {
        graph.nodeStyles.set(id, { ...graph.nodeStyles.get(id), ...props })
      }
      continue
    }

    // --- click interaction: `click A "url" "tooltip" _blank` / `click A call fn()` ---
    if (/^click\s+/i.test(line)) {
      applyClickStatement(line, graph)
      continue
    }

    // --- edge metadata: `e1@{ animate: true }` — shared with parseStateDiagram ---
    if (tryApplyEdgeMetaLine(line, graph)) {
      continue
    }

    // --- linkStyle: `linkStyle 0 stroke:#f00` or `linkStyle default stroke:#f00` ---
    const linkStyleMatch = line.match(/^linkStyle\s+(default|[\d,\s]+)\s+(.+)$/)
    if (linkStyleMatch) {
      const target = linkStyleMatch[1]!.trim()
      const props = parseStyleProps(linkStyleMatch[2]!)
      if (target === 'default') {
        graph.linkStyles.set('default', {
          ...graph.linkStyles.get('default'),
          ...props,
        })
      } else {
        const indices = target.split(',').map((s) => parseInt(s.trim(), 10))
        for (const idx of indices) {
          if (!isNaN(idx)) {
            graph.linkStyles.set(idx, {
              ...graph.linkStyles.get(idx),
              ...props,
            })
          }
        }
      }
      continue
    }

    // --- direction override inside subgraph: `direction LR` ---
    const dirMatch = line.match(/^direction\s+(TD|TB|LR|BT|RL)\s*$/i)
    if (dirMatch && subgraphStack.length > 0) {
      subgraphStack[subgraphStack.length - 1]!.direction = toDirection(
        dirMatch[1],
      )
      continue
    }

    // --- subgraph start: `subgraph Label` or `subgraph id [Label]` ---
    const subgraphMatch = line.match(/^subgraph\s+(.+)$/)
    if (subgraphMatch) {
      const rest = subgraphMatch[1]!.trim()
      // Check for `subgraph id [Label]` / `subgraph id ["Label"]` form. The id
      // may contain non-ASCII chars (e.g. CJK), so match any run of non-space,
      // non-`[` chars rather than ASCII [\w-]; strip optional quotes wrapping
      // the title.
      const bracketMatch = rest.match(/^([^\s[]+)\s*\[(.+)\]$/)
      let id: string
      let label: string
      if (bracketMatch) {
        id = bracketMatch[1]!
        label = normalizeBrTags(stripWrappingQuotes(bracketMatch[2]!))
      } else {
        // `subgraph Label` (optionally quoted): the label doubles as the id,
        // slugified — but preserve unicode letters/numbers so a CJK-only title
        // doesn't collapse to an empty id (which broke nested layout).
        label = normalizeBrTags(stripWrappingQuotes(rest))
        id = label.replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_-]/gu, '')
      }
      const sg: MermaidSubgraph = { id, label, nodeIds: [], children: [] }
      subgraphStack.push(sg)
      continue
    }

    // --- subgraph end ---
    if (line === 'end') {
      const completed = subgraphStack.pop()
      if (completed) {
        if (subgraphStack.length > 0) {
          subgraphStack[subgraphStack.length - 1]!.children.push(completed)
        } else {
          graph.subgraphs.push(completed)
        }
      }
      continue
    }

    // --- Edge/node definitions ---
    parseEdgeLine(line, graph, subgraphStack)
  }

  return graph
}

// ============================================================================
// State diagram parser
//
// Supported syntax:
//   stateDiagram-v2
//   s1 : Description
//   state "Description" as s1
//   s1 --> s2 : label
//   [*] --> s1            (start pseudostate)
//   s1 --> [*]            (end pseudostate)
//   state CompositeState {
//     inner1 --> inner2
//   }
// ============================================================================

function parseStateDiagram(lines: string[]): MermaidGraph {
  const graph: MermaidGraph = {
    direction: 'TD',
    nodes: new Map(),
    edges: [],
    subgraphs: [],
    classDefs: new Map(),
    classAssignments: new Map(),
    nodeStyles: new Map(),
    linkStyles: new Map(),
    interactions: new Map(),
  }

  // Track composite state nesting (like subgraphs)
  const compositeStack: MermaidSubgraph[] = []
  // Track all composite state IDs to avoid creating duplicate nodes
  const compositeStateIds = new Set<string>()
  // Counter for unique [*] pseudostate IDs
  let startCount = 0
  let endCount = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // --- direction override ---
    const dirMatch = line.match(/^direction\s+(TD|TB|LR|BT|RL)\s*$/i)
    if (dirMatch) {
      if (compositeStack.length > 0) {
        compositeStack[compositeStack.length - 1]!.direction = toDirection(
          dirMatch[1],
        )
      } else {
        graph.direction = toDirection(dirMatch[1])
      }
      continue
    }

    // --- linkStyle: `linkStyle 0 stroke:#f00` or `linkStyle default stroke:#f00` ---
    const linkStyleMatch = line.match(/^linkStyle\s+(default|[\d,\s]+)\s+(.+)$/)
    if (linkStyleMatch) {
      const target = linkStyleMatch[1]!.trim()
      const props = parseStyleProps(linkStyleMatch[2]!)
      if (target === 'default') {
        graph.linkStyles.set('default', {
          ...graph.linkStyles.get('default'),
          ...props,
        })
      } else {
        const indices = target.split(',').map((s) => parseInt(s.trim(), 10))
        for (const idx of indices) {
          if (!isNaN(idx)) {
            graph.linkStyles.set(idx, {
              ...graph.linkStyles.get(idx),
              ...props,
            })
          }
        }
      }
      continue
    }

    // --- edge metadata: `e1@{ animate: true }` — shared with parseFlowchart ---
    if (tryApplyEdgeMetaLine(line, graph)) {
      continue
    }

    // --- composite state start: `state CompositeState {` ---
    const compositeMatch = line.match(
      /^state\s+(?:"([^"]+)"\s+as\s+)?([\w\p{L}]+)\s*\{$/u,
    )
    if (compositeMatch) {
      const label = compositeMatch[1] ?? compositeMatch[2]!
      const id = compositeMatch[2]!
      const sg: MermaidSubgraph = { id, label, nodeIds: [], children: [] }
      compositeStack.push(sg)
      // Track this ID to avoid creating a duplicate node for the composite state
      compositeStateIds.add(id)
      // Remove any existing node that was created when parsing transitions before
      // this composite state definition (e.g., "A --> Processing" before "state Processing {")
      graph.nodes.delete(id)
      continue
    }

    // --- composite state end ---
    if (line === '}') {
      const completed = compositeStack.pop()
      if (completed) {
        if (compositeStack.length > 0) {
          compositeStack[compositeStack.length - 1]!.children.push(completed)
        } else {
          graph.subgraphs.push(completed)
        }
      }
      continue
    }

    // --- state alias: `state "Description" as s1` (without brace) ---
    const stateAliasMatch = line.match(
      /^state\s+"([^"]+)"\s+as\s+([\w\p{L}]+)\s*$/u,
    )
    if (stateAliasMatch) {
      const label = normalizeBrTags(stateAliasMatch[1]!)
      const id = stateAliasMatch[2]!
      registerStateNode(graph, compositeStack, { id, label, shape: 'rounded' })
      continue
    }

    /*
     * --- transition: `s1 --> s2`, `s1 --> s2 : label`, `[*] --> s1`, or
     * with an edge id (Mermaid v11.10.0+): `s1 e1@--> s2` ---
     *
     * State-diagram transitions only ever use `-->` (unlike flowchart's
     * many arrow variants), so the edge id — same `id@` prefix syntax as
     * flowchart's `A e1@--> B` — is captured inline in this one regex
     * rather than needing flowchart's separate pre-arrow scan.
     */
    const transitionMatch = line.match(
      /^(\[\*\]|[\w\p{L}-]+)\s*(?:([\w-]+)@)?-->\s*(\[\*\]|[\w\p{L}-]+)(?:\s*:\s*(.+))?$/u,
    )
    if (transitionMatch) {
      let sourceId = transitionMatch[1]!
      const edgeId = transitionMatch[2]
      let targetId = transitionMatch[3]!
      const rawTransitionLabel = transitionMatch[4]?.trim()
      const edgeLabel = rawTransitionLabel
        ? normalizeBrTags(rawTransitionLabel)
        : undefined

      // Handle [*] pseudostates — each occurrence gets a unique ID
      if (sourceId === '[*]') {
        startCount++
        sourceId = `_start${startCount > 1 ? startCount : ''}`
        registerStateNode(graph, compositeStack, {
          id: sourceId,
          label: '',
          shape: 'state-start',
        })
      } else if (!compositeStateIds.has(sourceId)) {
        // Only create a node if this isn't a composite state
        ensureStateNode(graph, compositeStack, sourceId)
      }

      if (targetId === '[*]') {
        endCount++
        targetId = `_end${endCount > 1 ? endCount : ''}`
        registerStateNode(graph, compositeStack, {
          id: targetId,
          label: '',
          shape: 'state-end',
        })
      } else if (!compositeStateIds.has(targetId)) {
        // Only create a node if this isn't a composite state
        ensureStateNode(graph, compositeStack, targetId)
      }

      graph.edges.push({
        source: sourceId,
        target: targetId,
        label: edgeLabel,
        style: 'solid',
        hasArrowStart: false,
        hasArrowEnd: true,
        ...(edgeId !== undefined ? { id: edgeId } : {}),
      })
      continue
    }

    // --- state description: `s1 : Description` ---
    const stateDescMatch = line.match(/^([\w\p{L}-]+)\s*:\s*(.+)$/u)
    if (stateDescMatch) {
      const id = stateDescMatch[1]!
      const label = normalizeBrTags(stateDescMatch[2]!.trim())
      registerStateNode(graph, compositeStack, { id, label, shape: 'rounded' })
      continue
    }
  }

  return graph
}

/** Register a state node and track in composite state if applicable */
function registerStateNode(
  graph: MermaidGraph,
  compositeStack: MermaidSubgraph[],
  node: MermaidNode,
): void {
  const isNew = !graph.nodes.has(node.id)
  if (isNew) {
    graph.nodes.set(node.id, node)
  }
  if (compositeStack.length > 0) {
    const current = compositeStack[compositeStack.length - 1]!
    if (!current.nodeIds.includes(node.id)) {
      current.nodeIds.push(node.id)
    }
  }
}

/** Ensure a state node exists with default rounded shape */
function ensureStateNode(
  graph: MermaidGraph,
  compositeStack: MermaidSubgraph[],
  id: string,
): void {
  if (!graph.nodes.has(id)) {
    registerStateNode(graph, compositeStack, {
      id,
      label: id,
      shape: 'rounded',
    })
  } else {
    // Track in composite if applicable
    if (compositeStack.length > 0) {
      const current = compositeStack[compositeStack.length - 1]!
      if (!current.nodeIds.includes(id)) {
        current.nodeIds.push(id)
      }
    }
  }
}

// ============================================================================
// Shared utilities
// ============================================================================

/** Parse "fill:#f00,stroke:#333" style property strings into a Record */
function parseStyleProps(propsStr: string): Record<string, string> {
  // Strip trailing semicolons — Mermaid tolerates them (e.g. `stroke:#f00;`)
  const cleaned = propsStr.replace(/;\s*$/, '')
  const props: Record<string, string> = {}
  for (const pair of cleaned.split(',')) {
    const colonIdx = pair.indexOf(':')
    if (colonIdx > 0) {
      const key = pair.slice(0, colonIdx).trim()
      const val = pair.slice(colonIdx + 1).trim()
      if (key && val) {
        props[key] = val
      }
    }
  }
  return props
}

// ============================================================================
// Flowchart edge line parser
//
// Handles chained edges like: A[Label] --> B(Label) -.-> C{Label}
// Also handles & parallel links: A & B --> C & D
// ============================================================================

/**
 * Arrow regex — matches all arrow operators with optional labels.
 *
 * Supported operators:
 *   -->  ---       solid arrow / solid line
 *   -.-> -.-       dotted arrow / dotted line
 *   ==>  ===       thick arrow / thick line
 *   <--> <-.-> <==>  bidirectional variants
 *   --o  --x       circle-end / cross-end arrow (see issue #65)
 *   o--  x--       circle-start / cross-start arrow
 *   o--o x--x      circle/cross at both ends
 *
 * The doubled `o--o`/`x--x` forms must be tried before the single-sided
 * `o--`/`x--` forms — regex alternation picks the first alternative that
 * matches, not the longest, so `o--` listed first would consume just the
 * start marker and strand the trailing `o` as a bogus token. Capturing the
 * markers as their own groups (rather than baking them into an alternation
 * of whole tokens) sidesteps that ordering problem entirely.
 *
 * The body is a variable-length run: Mermaid uses extra characters as a
 * layout-rank hint (`A ---- B` pushes B one rank further than `A --> B`).
 * A fixed alternation of `-->|---|==>` mis-tokenized anything longer,
 * stranding the surplus characters and corrupting the following token.
 * The run length is parsed so the edge survives; the rank hint it encodes
 * is not yet modelled by the layout engine.
 *
 * `~~~` is Mermaid's invisible link: it participates in layout but draws
 * nothing.
 *
 * Optional label: -->|label text|
 */
const ARROW_REGEX = /^(<|o|x)?(-{2,}|={2,}|-\.+-|~{3,})(>|o|x)?(?:\|([^|]*)\|)?/

/**
 * Link bodies that are only a link when a start or end marker accompanies
 * them.
 *
 * A bare `--` (or `==`) opens Mermaid's text-embedded label syntax —
 * `A -- Yes --> B` — which TEXT_ARROW_REGEX handles. Treating it as an
 * unmarked open link here would consume the opener and strand the label.
 * Mermaid itself requires three characters for an unmarked open link
 * (`A --- B`), so this only rejects what Mermaid also rejects.
 */
const AMBIGUOUS_UNMARKED_BODIES = new Set(['--', '=='])

/**
 * Map a raw start/end marker character (`<`, `>`, `o`, `x`, or undefined) to
 * the distinct terminator shape it draws, if any.
 *
 * `<`/`>` are plain arrowheads — already handled by `hasArrowStart`/
 * `hasArrowEnd` — so they map to `undefined` here, same as no marker at all.
 * Only `o`/`x` need their own shape (circle/cross) recorded, so the ASCII
 * renderer can draw something other than the default arrowhead glyph — see
 * issue #330.
 */
function markerKind(marker: string | undefined): 'circle' | 'cross' | undefined {
  if (marker === 'o') return 'circle'
  if (marker === 'x') return 'cross'
  return undefined
}

/**
 * Text-embedded label regex — matches "-- label -->", "-. label .->", "== label ==>" syntax.
 * Tried as fallback when ARROW_REGEX doesn't match.
 *
 * The closing operator is a variable-length run, matching ARROW_REGEX. While
 * it was a fixed alternation, `A -- label ----> B` consumed only `---` from
 * `---->`, leaving `-> B`, which forms no node group — so the edge and its
 * target node were both dropped silently. Exactly the failure mode the
 * variable-length work exists to remove.
 *
 * Based on PR #36 by @liuxiaopai-ai (https://github.com/lukilabs/beautiful-mermaid/pull/36)
 */
const TEXT_ARROW_REGEX =
  /^(<|o|x)?(--|-\.|==)\s+(.+?)\s+(-{2,}[>ox]|={2,}[>ox]|\.+-[>ox]|-{3,}|={3,}|-\.+-)/

/**
 * Node shape patterns — ordered from most specific delimiters to least.
 * Multi-char delimiters must be tried before single-char to avoid false matches.
 *
 * The label-content group for each shape is quote-aware: it matches either a
 * complete `"..."` quoted span (any character, including this shape's own
 * closing delimiter chars, is fine inside quotes) or a single character that
 * isn't the start of the closing delimiter. This stops the scanner from
 * treating a `]`/`)`/`}` etc. *inside* a quoted label as the node's real
 * closing bracket (see issue #61) — without this, `A["test [] brackets"]`
 * would stop at the first `]`, which lives inside the quoted string.
 */
/**
 * A node shape pattern.
 *
 * `shape` is usually a fixed `NodeShape`. For the slash-bracket family it is
 * a function instead, because those four shapes are distinguished by which
 * delimiter *closes* them — which the regex has to capture rather than
 * hard-code. See SLASH_BRACKET note below.
 */
interface NodePattern {
  regex: RegExp
  shape: NodeShape | ((closingDelimiter: string) => NodeShape)
}

const NODE_PATTERNS: NodePattern[] = [
  // Triple delimiters (must be first)
  {
    regex: /^([\w-]+)\(\(\(((?:"[^"]*"|(?!\)\)\)).)+)\)\)\)/,
    shape: 'doublecircle',
  }, // A(((text)))

  // Double delimiters with mixed brackets
  { regex: /^([\w-]+)\(\[((?:"[^"]*"|(?!\]\)).)+)\]\)/, shape: 'stadium' }, // A([text])
  { regex: /^([\w-]+)\(\(((?:"[^"]*"|(?!\)\)).)+)\)\)/, shape: 'circle' }, // A((text))
  { regex: /^([\w-]+)\[\[((?:"[^"]*"|(?!\]\]).)+)\]\]/, shape: 'subroutine' }, // A[[text]]
  { regex: /^([\w-]+)\[\(((?:"[^"]*"|(?!\)\]).)+)\)\]/, shape: 'cylinder' }, // A[(text)]

  /*
   * SLASH_BRACKET family — must come before plain [text].
   *
   * Four shapes share a `[` + slash opener and differ only in which
   * delimiter closes them:
   *
   *   A[/text\]  trapezoid          A[/text/]  parallelogram
   *   A[\text/]  trapezoid-alt      A[\text\]  parallelogram-alt
   *
   * They CANNOT be four separate patterns each negated against its own
   * closing pair. A pattern for `[/…\]` whose content merely excludes `\]`
   * will happily run past a `/]` to reach a `\]` later on the same line, so
   *
   *     A[/parallelogram/] --> B[\alt\]
   *
   * matched as a single trapezoid whose label was the entire statement —
   * silently swallowing the edge and the second node. Ordering the patterns
   * differently only moves which input breaks.
   *
   * Instead, one pattern per opener stops at whichever slash-close comes
   * first and captures it, and the captured delimiter selects the shape.
   */
  {
    regex: /^([\w-]+)\[\/((?:"[^"]*"|(?![\\/]\]).)+)([\\/])\]/,
    shape: (close) => (close === '\\' ? 'trapezoid' : 'parallelogram'),
  }, // A[/text\] or A[/text/]
  {
    regex: /^([\w-]+)\[\\((?:"[^"]*"|(?![\\/]\]).)+)([\\/])\]/,
    shape: (close) => (close === '/' ? 'trapezoid-alt' : 'parallelogram-alt'),
  }, // A[\text/] or A[\text\]

  // Asymmetric flag shape
  { regex: /^([\w-]+)>((?:"[^"]*"|(?!\]).)+)\]/, shape: 'asymmetric' }, // A>text]

  // Double curly braces (hexagon) — must come before single {text}
  { regex: /^([\w-]+)\{\{((?:"[^"]*"|(?!\}\}).)+)\}\}/, shape: 'hexagon' }, // A{{text}}

  // Single-char delimiters (last — most common, least specific)
  { regex: /^([\w-]+)\[((?:"[^"]*"|(?!\]).)+)\]/, shape: 'rectangle' }, // A[text]
  { regex: /^([\w-]+)\(((?:"[^"]*"|(?!\)).)+)\)/, shape: 'rounded' }, // A(text)
  { regex: /^([\w-]+)\{((?:"[^"]*"|(?!\}).)+)\}/, shape: 'diamond' }, // A{text}
]

/**
 * Regex for a bare node reference (just an ID, no shape brackets).
 *
 * Only allows a hyphen when it's sandwiched between word characters
 * (`foo-bar`, `step-1-b`), never a bare/trailing/doubled hyphen. This keeps
 * legitimately hyphenated ids intact while stopping the id from swallowing
 * the leading dashes of an immediately-following arrow when there's no
 * whitespace before it — e.g. `A-->B` (see issue #61): the naive `[\w-]+`
 * greedily consumed `A--`, leaving a bogus node and no edge. Arrow tokens
 * always start with `-`/`=`/`<` followed by another non-word character
 * (`-`, `.`, `=`, `>`), which this pattern never matches into, so it now
 * stops cleanly at `A` and lets the arrow regex take over.
 */
const BARE_NODE_REGEX = /^([\w]+(?:-[\w]+)*)/

/**
 * Node id immediately followed by the expanded-syntax opener: `A@{`.
 *
 * Only the id is captured — the block itself needs depth- and quote-aware
 * scanning (a label may contain `}`), which a regex would do badly, so
 * `matchExpandedBlock` takes over from here.
 */
const EXPANDED_NODE_ID_REGEX = /^([\w-]+)(?=@\{)/

/**
 * Resolve the geometry for an `A@{ ... }` node.
 *
 * An `icon:` or `img:` node has no `shape:` of its own — its outline comes
 * from `form:` instead (Mermaid defaults to a square). An unrecognized shape
 * name falls back to a rectangle rather than throwing: Mermaid adds shape
 * names regularly, and rendering a plain box beats failing the whole diagram
 * over one unknown name.
 */
function expandedNodeShape(meta: ExpandedNodeMeta): NodeShape {
  if (meta.shape) {
    return resolveShapeName(meta.shape) ?? 'rectangle'
  }

  if (meta.icon !== undefined || meta.img !== undefined) {
    switch (meta.form?.toLowerCase()) {
      case 'circle':
        return 'circle'
      case 'rounded':
        return 'rounded'
      default:
        return 'rectangle'
    }
  }

  return 'rectangle'
}

/**
 * Resolve the display label for an `A@{ ... }` node.
 *
 * Falls back to the node id when no `label:` is given, matching how the
 * bracket syntax treats a bare `A`. For an icon or image node with no label,
 * the icon/image reference itself is shown: this renderer draws neither
 * FontAwesome glyphs nor remote images, so showing the reference is more
 * useful than an empty box, and it keeps the node identifiable.
 */
function expandedNodeLabel(id: string, meta: ExpandedNodeMeta): string {
  if (meta.label !== undefined && meta.label.length > 0) return meta.label
  if (meta.icon) return meta.icon
  if (meta.img) return meta.img
  return id
}

/**
 * Apply a `click` statement to the graph.
 *
 * Mermaid's forms:
 *   click A "https://example.com"
 *   click A "https://example.com" "Tooltip"
 *   click A "https://example.com" _blank
 *   click A href "https://example.com" "Tooltip" _blank
 *   click A call myCallback()
 *   click A callback "Tooltip"
 *
 * A callback is recorded but never invoked — this renderer emits static SVG
 * and does not execute script supplied by a diagram. An href, by contrast, is
 * genuinely actionable: the node is wrapped in an SVG <a>, which works in any
 * browser without script.
 */
function applyClickStatement(line: string, graph: MermaidGraph): void {
  const match = line.match(/^click\s+([\w-]+)\s+(.*)$/i)
  if (!match) return

  const nodeId = match[1]!
  let rest = match[2]!.trim()

  const interaction: NodeInteraction = { ...graph.interactions.get(nodeId) }

  // `call fn()` / `callback fn()` — a script binding.
  const callMatch = rest.match(/^(?:call|callback)\s+(.+?)\s*$/i)
  if (callMatch) {
    // A trailing quoted tooltip may follow the callback expression.
    const withTooltip = callMatch[1]!.match(/^(.*?\))\s+"([^"]*)"\s*$/)
    if (withTooltip) {
      interaction.callback = withTooltip[1]!.trim()
      interaction.tooltip = withTooltip[2]
    } else {
      interaction.callback = callMatch[1]!.trim()
    }
    graph.interactions.set(nodeId, interaction)
    return
  }

  // Optional explicit `href` keyword.
  rest = rest.replace(/^href\s+/i, '')

  // Remaining tokens: "url" ["tooltip"] [_target]
  const quoted = [...rest.matchAll(/"([^"]*)"/g)].map((m) => m[1]!)
  if (quoted.length > 0) interaction.href = quoted[0]
  if (quoted.length > 1) interaction.tooltip = quoted[1]

  const targetMatch = rest.match(/(_blank|_self|_parent|_top)\s*$/i)
  if (targetMatch) interaction.target = targetMatch[1]!.toLowerCase()

  if (interaction.href !== undefined || interaction.tooltip !== undefined) {
    graph.interactions.set(nodeId, interaction)
  }
}

/**
 * Id immediately followed by the expanded-syntax opener on a standalone
 * metadata line: `e1@{ ... }`.
 *
 * Shared by both parsers (`tryApplyEdgeMetaLine`) since the syntax and its
 * "must already be a known edge id" disambiguation rule are identical for
 * flowcharts and state diagrams — only how edge ids get declared differs
 * (`A e1@--> B` vs. `A e1@--> B` with a simpler arrow set).
 */
const EDGE_META_ID_REGEX = /^([\w-]+)(?=@\{)/

/**
 * Try to parse and apply a standalone `e1@{ animate: true }` edge-metadata
 * line.
 *
 * Told apart from a node's `A@{ shape: ... }` by whether the id was already
 * declared as an edge id (`A e1@--> B`) — checked before node parsing so an
 * edge id is never registered as a stray node. Shared between
 * `parseFlowchart` and `parseStateDiagram`; returns `true` if the line was
 * consumed as edge metadata (caller should `continue` its loop).
 */
function tryApplyEdgeMetaLine(line: string, graph: MermaidGraph): boolean {
  const edgeMetaMatch = line.match(EDGE_META_ID_REGEX)
  if (!edgeMetaMatch || !graph.edges.some((e) => e.id === edgeMetaMatch[1])) {
    return false
  }
  const block = matchExpandedBlock(line.slice(edgeMetaMatch[1]!.length))
  if (!block) return false
  applyEdgeMeta(graph, edgeMetaMatch[1]!, parseExpandedMeta(block.body))
  return true
}

/**
 * Apply an `e1@{ ... }` metadata block to the edge with that id.
 *
 * Only `animate` is acted on; Mermaid's other edge keys (`animation`,
 * `curve`) are recorded as no-ops rather than errors, matching how an
 * unknown node shape degrades.
 */
function applyEdgeMeta(
  graph: MermaidGraph,
  edgeId: string,
  meta: Record<string, string | undefined>,
): void {
  for (const edge of graph.edges) {
    if (edge.id !== edgeId) continue
    if (meta.animate !== undefined) {
      edge.animate = meta.animate.toLowerCase() !== 'false'
    }
    // Mermaid's `animation: fast|slow` is a speed hint on top of animate.
    if (meta.animation !== undefined) edge.animate = true
  }
}

/** Regex for ::: class shorthand suffix — matches :::className immediately after a node */
const CLASS_SHORTHAND_REGEX = /^:::([\w][\w-]*)/

/**
 * Regex for ::: class shorthand appearing BEFORE the shape brackets,
 * e.g. A:::external[Label]. Captures the bare id and the class name so
 * the shorthand can be stripped out before shape-pattern matching runs.
 */
const PRE_CLASS_SHORTHAND_REGEX = /^([\w-]+):::([\w][\w-]*)/

/**
 * Parse a line that contains node definitions and edges.
 * Handles chaining: A --> B --> C produces edges A→B and B→C.
 * Handles parallel links: A & B --> C & D produces 4 edges.
 */
function parseEdgeLine(
  line: string,
  graph: MermaidGraph,
  subgraphStack: MermaidSubgraph[],
): void {
  let remaining = line.trim()

  // Parse the first node group (possibly with & separators)
  const firstGroup = consumeNodeGroup(remaining, graph, subgraphStack)
  if (!firstGroup || firstGroup.ids.length === 0) return

  remaining = firstGroup.remaining.trim()
  let prevGroupIds = firstGroup.ids

  // Parse arrow + node-group pairs until the line is exhausted
  while (remaining.length > 0) {
    let hasArrowStart: boolean
    let style: EdgeStyle
    let hasArrowEnd: boolean
    let edgeLabel: string | undefined
    let startMarkerKind: 'circle' | 'cross' | undefined
    let endMarkerKind: 'circle' | 'cross' | undefined

    /*
     * Optional edge id prefix: `A e1@--> B` (Mermaid v11.10.0+). Consumed
     * before the arrow so ARROW_REGEX still sees the link token at position
     * zero. `@` is not otherwise valid ahead of a link, so this cannot
     * shadow existing syntax.
     */
    let edgeId: string | undefined
    const edgeIdMatch = remaining.match(/^([\w-]+)@(?=[-=<~ox])/)
    if (edgeIdMatch) {
      edgeId = edgeIdMatch[1]
      remaining = remaining.slice(edgeIdMatch[0].length)
    }

    const arrowMatch = remaining.match(ARROW_REGEX)
    const arrowBody = arrowMatch?.[2]
    const startMarker = arrowMatch?.[1]
    const endMarker = arrowMatch?.[3]

    if (
      arrowMatch &&
      arrowBody !== undefined &&
      // An unmarked `--`/`==` is the text-label opener, not a link.
      !(
        startMarker === undefined &&
        endMarker === undefined &&
        AMBIGUOUS_UNMARKED_BODIES.has(arrowBody)
      )
    ) {
      // `o`/`x` mark a circle/cross terminator (alongside `<` for a reversed
      // arrow) — `markerKind` records which, so the ASCII renderer can draw
      // a distinct glyph instead of the default arrowhead (see issue #330,
      // a follow-up to issue #65 which first stopped these from being
      // dropped entirely).
      hasArrowStart = startMarker !== undefined
      startMarkerKind = markerKind(startMarker)
      const rawEdgeLabel = arrowMatch[4]?.trim()
      edgeLabel = rawEdgeLabel ? normalizeBrTags(rawEdgeLabel) : undefined
      remaining = remaining.slice(arrowMatch[0].length).trim()
      style = arrowStyleFromBody(arrowBody)
      hasArrowEnd = endMarker !== undefined
      endMarkerKind = markerKind(endMarker)
    } else {
      // Fallback: text-embedded label syntax (-- Yes -->, -. Maybe .->, == Sure ==>)
      const textMatch = remaining.match(TEXT_ARROW_REGEX)
      if (!textMatch) break
      hasArrowStart = Boolean(textMatch[1])
      startMarkerKind = markerKind(textMatch[1])
      const rawLabel = textMatch[3]!.trim()
      edgeLabel = rawLabel ? normalizeBrTags(rawLabel) : undefined
      const openOp = textMatch[2]!
      const closeOp = textMatch[4]!
      remaining = remaining.slice(textMatch[0].length).trim()
      style = textArrowStyleFromOps(openOp, closeOp)
      hasArrowEnd = closeOp.endsWith('>')
      // closeOp is a variable-length run (e.g. "---o", "==x", "-.-.->"); only
      // its final character can be a circle/cross marker.
      endMarkerKind = markerKind(closeOp.slice(-1))
    }

    // Parse the next node group
    const nextGroup = consumeNodeGroup(remaining, graph, subgraphStack)
    if (!nextGroup || nextGroup.ids.length === 0) break

    remaining = nextGroup.remaining.trim()

    // Emit Cartesian product of edges: every source × every target
    for (const sourceId of prevGroupIds) {
      for (const targetId of nextGroup.ids) {
        graph.edges.push({
          source: sourceId,
          target: targetId,
          label: edgeLabel,
          style,
          hasArrowStart,
          hasArrowEnd,
          ...(startMarkerKind !== undefined
            ? { startMarker: startMarkerKind }
            : {}),
          ...(endMarkerKind !== undefined ? { endMarker: endMarkerKind } : {}),
          ...(edgeId !== undefined ? { id: edgeId } : {}),
        })
      }
    }

    prevGroupIds = nextGroup.ids
  }
}

interface ConsumedNodeGroup {
  ids: string[]
  remaining: string
}

/**
 * Consume one or more nodes separated by `&`.
 * E.g. "A & B & C --> ..." returns ids: ['A', 'B', 'C']
 */
function consumeNodeGroup(
  text: string,
  graph: MermaidGraph,
  subgraphStack: MermaidSubgraph[],
): ConsumedNodeGroup | null {
  const first = consumeNode(text, graph, subgraphStack)
  if (!first) return null

  const ids = [first.id]
  let remaining = first.remaining.trim()

  // Check for & separators
  while (remaining.startsWith('&')) {
    remaining = remaining.slice(1).trim()
    const next = consumeNode(remaining, graph, subgraphStack)
    if (!next) break
    ids.push(next.id)
    remaining = next.remaining.trim()
  }

  return { ids, remaining }
}

interface ConsumedNode {
  id: string
  remaining: string
}

/**
 * Try to consume a node definition from the start of `text`.
 * If the node has a shape+label (e.g. A[Text]), it's registered in the graph.
 * If it's a bare reference (e.g. A), we look it up or create a default.
 * Also handles ::: class shorthand suffix.
 */
function consumeNode(
  text: string,
  graph: MermaidGraph,
  subgraphStack: MermaidSubgraph[],
): ConsumedNode | null {
  let id: string | null = null
  let remaining: string = text

  // Check for ::: class shorthand appearing BEFORE the shape brackets
  // (e.g. A:::external[Label]). Strip it out so shape-pattern matching
  // below still sees the id directly adjacent to its brackets.
  let preClassName: string | undefined
  const preClassMatch = remaining.match(PRE_CLASS_SHORTHAND_REGEX)
  if (preClassMatch) {
    preClassName = preClassMatch[2]!
    remaining = preClassMatch[1]! + remaining.slice(preClassMatch[0].length)
  }

  /*
   * Expanded syntax: `A@{ shape: doc, label: "Report" }` (Mermaid v11.3.0+).
   *
   * Tried before the bracket patterns because the id is followed by `@{`,
   * which none of them match — without this the id would fall through to
   * BARE_NODE_REGEX and the whole metadata block would be stranded as
   * unparsed text.
   */
  const expandedIdMatch = remaining.match(EXPANDED_NODE_ID_REGEX)
  if (expandedIdMatch) {
    const expandedId = expandedIdMatch[1]!
    const block = matchExpandedBlock(remaining.slice(expandedId.length))
    if (block) {
      const meta = parseExpandedMeta(block.body)
      registerNode(graph, subgraphStack, {
        id: expandedId,
        label: normalizeBrTags(expandedNodeLabel(expandedId, meta)),
        shape: expandedNodeShape(meta),
      })
      id = expandedId
      remaining = remaining.slice(expandedId.length + block.length)
    }
  }

  // Try each node pattern (shape-qualified)
  if (id === null) {
    for (const { regex, shape } of NODE_PATTERNS) {
      const match = remaining.match(regex)
      if (match) {
        id = match[1]!
        const label = normalizeBrTags(match[2]!)
        // The slash-bracket family resolves its shape from the closing
        // delimiter it captured in group 3; every other pattern has a fixed
        // shape. See the SLASH_BRACKET note in NODE_PATTERNS.
        const resolvedShape =
          typeof shape === 'function' ? shape(match[3] ?? '') : shape
        registerNode(graph, subgraphStack, { id, label, shape: resolvedShape })
        remaining = remaining.slice(match[0].length)
        break
      }
    }
  }

  // Bare node reference — only register if node doesn't exist yet.
  // If it already exists, do NOT track it in the current subgraph;
  // nodes belong to the subgraph where they're first defined.
  if (id === null) {
    const bareMatch = remaining.match(BARE_NODE_REGEX)
    if (bareMatch) {
      id = bareMatch[1]!
      if (!graph.nodes.has(id)) {
        registerNode(graph, subgraphStack, {
          id,
          label: id,
          shape: 'rectangle',
        })
      }
      remaining = remaining.slice(bareMatch[0].length)
    }
  }

  if (id === null) return null

  if (preClassName) {
    graph.classAssignments.set(id, preClassName)
  }

  // Check for ::: class shorthand suffix immediately after the node
  const classMatch = remaining.match(CLASS_SHORTHAND_REGEX)
  if (classMatch) {
    graph.classAssignments.set(id, classMatch[1]!)
    remaining = remaining.slice(classMatch[0].length)
  }

  return { id, remaining }
}

/** Register a node in the graph and track it in the current subgraph */
function registerNode(
  graph: MermaidGraph,
  subgraphStack: MermaidSubgraph[],
  node: MermaidNode,
): void {
  const isNew = !graph.nodes.has(node.id)
  if (isNew) {
    graph.nodes.set(node.id, node)
  }
  trackInSubgraph(subgraphStack, node.id)
}

/** Add node ID to the innermost subgraph if we're inside one */
function trackInSubgraph(
  subgraphStack: MermaidSubgraph[],
  nodeId: string,
): void {
  if (subgraphStack.length > 0) {
    const current = subgraphStack[subgraphStack.length - 1]!
    if (!current.nodeIds.includes(nodeId)) {
      current.nodeIds.push(nodeId)
    }
  }
}

/**
 * Map a link body to its edge style, ignoring direction and run length.
 *
 * The body is the run between the optional start/end markers: `--`, `----`,
 * `==`, `-.-`, `-..-`, `~~~`, etc. Classification is by the characters used,
 * not the length, so every run length of a given style behaves identically.
 */
function arrowStyleFromBody(body: string): EdgeStyle {
  if (body.startsWith('~')) return 'invisible'
  if (body.includes('.')) return 'dotted'
  if (body.startsWith('=')) return 'thick'
  return 'solid'
}

/** Map text-embedded arrow open/close operators to edge style */
function textArrowStyleFromOps(openOp: string, closeOp: string): EdgeStyle {
  // Classify by the characters used, not by exact token, so every run length
  // of a given style resolves identically — the same rule arrowStyleFromBody
  // applies to the plain arrow forms.
  if (openOp.includes('.') || closeOp.includes('.')) return 'dotted'
  if (openOp.startsWith('=') || closeOp.startsWith('=')) return 'thick'
  return 'solid'
}
