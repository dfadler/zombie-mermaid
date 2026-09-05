// ============================================================================
// Sequence diagram types
//
// Models the parsed and positioned representations of a Mermaid sequence diagram.
// Sequence diagrams show actor interactions over time (vertical timeline).
// ============================================================================

/** Parsed sequence diagram — logical structure from mermaid text */
export interface SequenceDiagram {
  /** Ordered list of actors/participants */
  actors: Actor[]
  /** Messages between actors in chronological order */
  messages: Message[]
  /** Structural blocks (loop, alt, opt, par, critical) */
  blocks: Block[]
  /** Notes attached to actors */
  notes: Note[]
  /**
   * Standalone `activate X` / `deactivate X` statements, in source order.
   * The inline `+`/`-` arrow shorthand is *not* recorded here — it stays on
   * `Message.activate` / `Message.deactivate` — but both feed the same
   * activation stack at layout time (see layout.ts), so the two forms
   * render identically.
   */
  activations: ActivationEvent[]
}

/**
 * One standalone `activate X` (`kind: 'start'`) or `deactivate X`
 * (`kind: 'end'`) statement. Mermaid's own grammar expands the `+`/`-` arrow
 * shorthand into exactly these events — `A->>+B` is a message followed by an
 * `activeStart` for the recipient, `A-->>-B` a message followed by an
 * `activeEnd` for the sender — so this is the primitive and the shorthand is
 * sugar over it.
 */
export interface ActivationEvent {
  actorId: string
  kind: 'start' | 'end'
  /**
   * Index of the message this statement follows (-1 if it precedes every
   * message). The activation bar starts/ends at that message's row, which
   * is where the shorthand form's bar starts/ends too.
   */
  afterIndex: number
}

export interface Actor {
  id: string
  label: string
  /** 'participant' renders as a box, 'actor' renders as a stick figure */
  type: 'participant' | 'actor'
  /**
   * Index of the message that creates this participant (`create participant
   * X` on the line before it). The participant's box is drawn at that
   * message's row instead of in the header, and its lifeline starts there.
   * Unset for participants that exist from the top of the diagram.
   */
  createdAt?: number
  /**
   * Index of the message that destroys this participant (`destroy X` on the
   * line before it). Its lifeline ends at that message's row with a cross,
   * and no footer box is drawn. Unset for participants that live to the end.
   */
  destroyedAt?: number
}

export interface Message {
  from: string
  to: string
  label: string
  /** Arrow style: solid line or dashed line */
  lineStyle: 'solid' | 'dashed'
  /** Arrow head: filled (closed) or open */
  arrowHead: 'filled' | 'open'
  /**
   * Set for a "lost message" cross-terminator (`-x`/`--x`). `arrowHead`
   * stays `'filled'` for these (unchanged, to preserve existing SVG output)
   * — this flag lets the ASCII renderer draw a distinct cross glyph instead
   * of the plain filled arrowhead it shares with `->>`/`-->>`. See issue
   * #330; not yet modeled by the SVG renderer's markers.
   */
  isLost?: boolean
  /** Activate the target lifeline (+) */
  activate?: boolean
  /** Deactivate the source lifeline (-) */
  deactivate?: boolean
  /** Bidirectional arrow (`<<->>` or `<<-->>`) — draw an arrow head on both ends */
  bidirectional?: boolean
  /** Sequence number to display next to this arrow when `autonumber` is active */
  seqNumber?: number
}

export interface Block {
  /** Block type keyword */
  type: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'rect'
  /** Label for the block header */
  label: string
  /** Index of the first message inside this block */
  startIndex: number
  /** Index of the last message inside this block (inclusive) */
  endIndex: number
  /** For alt/par blocks: indices where "else"/"and" dividers appear (message indices) */
  dividers: Array<{ index: number; label: string }>
}

export interface Note {
  /** Which actor(s) the note is attached to */
  actorIds: string[]
  /** Note text content */
  text: string
  /** Position relative to the actor(s) */
  position: 'left' | 'right' | 'over'
  /** Message index after which this note appears */
  afterIndex: number
}

// ============================================================================
// Positioned sequence diagram — ready for SVG rendering
// ============================================================================

export interface PositionedSequenceDiagram {
  width: number
  height: number
  actors: PositionedActor[]
  lifelines: Lifeline[]
  messages: PositionedMessage[]
  activations: Activation[]
  blocks: PositionedBlock[]
  notes: PositionedNote[]
}

export interface PositionedActor {
  id: string
  label: string
  type: 'participant' | 'actor'
  /** Center x of the actor box */
  x: number
  /** Top y of the actor box */
  y: number
  width: number
  height: number
}

/** Vertical dashed line from actor to bottom of diagram */
export interface Lifeline {
  actorId: string
  x: number
  topY: number
  bottomY: number
  /**
   * Set when the actor is destroyed mid-diagram (`Actor.destroyedAt`):
   * `bottomY` is then the destroying message's row rather than the diagram
   * bottom, and the renderer marks it with a cross.
   */
  destroyed?: boolean
}

export interface PositionedMessage {
  from: string
  to: string
  label: string
  lineStyle: 'solid' | 'dashed'
  arrowHead: 'filled' | 'open'
  /** Start point (from actor's lifeline) */
  x1: number
  /** End point (to actor's lifeline) */
  x2: number
  /** Vertical position */
  y: number
  /** Whether this is a self-message (same actor) */
  isSelf: boolean
  /** Bidirectional arrow (`<<->>` or `<<-->>`) — draw an arrow head on both ends */
  bidirectional: boolean
  /** Sequence number to display next to this arrow when `autonumber` is active */
  seqNumber?: number
}

/** Narrow rectangle on a lifeline showing active processing */
export interface Activation {
  actorId: string
  x: number
  topY: number
  bottomY: number
  width: number
}

export interface PositionedBlock {
  type: Block['type']
  label: string
  x: number
  y: number
  width: number
  height: number
  /** Divider lines within the block (for alt/par) */
  dividers: Array<{ y: number; label: string }>
}

export interface PositionedNote {
  text: string
  x: number
  y: number
  width: number
  height: number
  /** Actor IDs this note is attached to (for SVG attribution) */
  actors?: string[]
  /** Note position relative to actors (for SVG attribution) */
  position?: 'left' | 'right' | 'over'
}
