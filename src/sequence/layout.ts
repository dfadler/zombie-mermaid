import type {
  SequenceDiagram,
  PositionedSequenceDiagram,
  PositionedActor,
  Lifeline,
  PositionedMessage,
  Activation,
  PositionedBlock,
  PositionedNote,
  PositionedParticipantBox,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_WEIGHTS, resolveFontSizes } from '../styles.ts'

// ============================================================================
// Sequence diagram layout engine
//
// Custom timeline-based layout (no ELK — sequence diagrams aren't graphs).
//
// Layout strategy:
//   1. Space actors horizontally based on label widths + min gap
//   2. Stack messages vertically in chronological order
//   3. Track activation boxes via a stack
//   4. Position blocks (loop/alt/opt) as background rectangles
//   5. Position notes next to their target actors
// ============================================================================

/** Layout constants specific to sequence diagrams */
const SEQ = {
  /** Padding around the entire diagram */
  padding: 30,
  /** Minimum gap between actor centers */
  actorGap: 140,
  /** Actor box height */
  actorHeight: 40,
  /** Horizontal padding inside actor boxes */
  actorPadX: 16,
  /** Vertical space between actor boxes and first message */
  headerGap: 20,
  /** Vertical space per message row */
  messageRowHeight: 40,
  /** Extra vertical space for self-messages (they loop back) */
  selfMessageHeight: 30,
  /** Activation box width (narrow rectangle on lifeline) */
  activationWidth: 10,
  /** Block padding (loop/alt borders) */
  blockPadX: 10,
  blockPadTop: 40,
  blockPadBottom: 8,
  /** Extra vertical space before the first message in a block (room for the header label) */
  blockHeaderExtra: 28,
  /** Extra vertical space before a message at a divider boundary (room for else/and label) */
  dividerExtra: 24,
  /** Note dimensions */
  noteWidth: 60,
  notePadX: 12,
  notePadY: 6,
  noteGap: 10,
  /** Gap between a message arrow and a note positioned directly after it */
  noteOffsetAfterMessage: 8,
  /** Gap between consecutively stacked notes */
  noteStackGap: 4,
  /**
   * `box … end` group padding: horizontal clearance beyond the outermost
   * member's box, vertical clearance above the actor boxes (under the label
   * band) and below the lifeline bottoms.
   */
  boxPad: 10,
} as const

/**
 * Height of the label band at the top of a `box … end` group, in px — the
 * label's font size plus vertical breathing room. Shared with the renderer
 * so the label lands centred in the band the layout reserved for it.
 */
export function boxLabelHeight(labelFontSize: number): number {
  return labelFontSize + 8
}

/** Resolved sequence-layout config — same shape as {@link SEQ} but mutable numbers. */
type SeqConfig = { [K in keyof typeof SEQ]: number }

/**
 * Merge user-provided sequence-layout overrides over the {@link SEQ} defaults.
 * Any field left unspecified (or `undefined`) falls back to its default.
 */
function resolveSeqOptions(overrides?: RenderOptions['sequence']): SeqConfig {
  return {
    ...SEQ,
    actorHeight: overrides?.actorHeight ?? SEQ.actorHeight,
    headerGap: overrides?.headerGap ?? SEQ.headerGap,
    messageRowHeight: overrides?.messageRowHeight ?? SEQ.messageRowHeight,
    noteOffsetAfterMessage:
      overrides?.noteOffsetAfterMessage ?? SEQ.noteOffsetAfterMessage,
    noteStackGap: overrides?.noteStackGap ?? SEQ.noteStackGap,
  }
}

/**
 * Lay out a parsed sequence diagram.
 * Returns a fully positioned diagram ready for SVG rendering.
 */
export function layoutSequenceDiagram(
  diagram: SequenceDiagram,
  options: RenderOptions = {},
): PositionedSequenceDiagram {
  if (diagram.actors.length === 0) {
    return {
      width: 0,
      height: 0,
      actors: [],
      lifelines: [],
      messages: [],
      activations: [],
      blocks: [],
      notes: [],
      boxes: [],
    }
  }

  const seq = resolveSeqOptions(options.sequence)
  const fontSizes = resolveFontSizes(options.fontSizes)

  // 1. Calculate actor widths and assign horizontal positions (center X)
  const actorWidths = diagram.actors.map((a) => {
    const textW = estimateTextWidth(
      a.label,
      fontSizes.nodeLabel,
      FONT_WEIGHTS.nodeLabel,
    )
    return Math.max(textW + seq.actorPadX * 2, 80)
  })

  // Build actor center X positions with minimum gap
  const actorCenterX: number[] = []
  let currentX = seq.padding + actorWidths[0]! / 2
  for (let i = 0; i < diagram.actors.length; i++) {
    if (i > 0) {
      const minGap = Math.max(
        seq.actorGap,
        (actorWidths[i - 1]! + actorWidths[i]!) / 2 + 40,
      )
      currentX += minGap
    }
    actorCenterX.push(currentX)
  }

  // Build actor ID → index lookup
  const actorIndex = new Map<string, number>()
  for (let i = 0; i < diagram.actors.length; i++) {
    actorIndex.set(diagram.actors[i]!.id, i)
  }

  // 2. Position actors at the top. A `box … end` group draws a full-height
  //    background starting at the top padding, so when any (non-empty) box
  //    exists the actor row moves down to leave room for the box's top
  //    padding and — if any box has a label — its label band. Mermaid does
  //    the same (`bumpVerticalPos(boxes[0].textMaxHeight)`).
  const renderedBoxes = diagram.boxes.filter((b) => b.actorIds.length > 0)
  const anyBoxLabel = renderedBoxes.some((b) => b.label !== '')
  const boxTopInset =
    renderedBoxes.length === 0
      ? 0
      : seq.boxPad + (anyBoxLabel ? boxLabelHeight(fontSizes.edgeLabel) : 0)
  const actorY = seq.padding + boxTopInset
  const actors: PositionedActor[] = diagram.actors.map((a, i) => ({
    id: a.id,
    label: a.label,
    type: a.type,
    x: actorCenterX[i]!,
    y: actorY,
    width: actorWidths[i]!,
    height: seq.actorHeight,
  }))

  // Box backgrounds span from the outermost member's left edge to the
  // outermost member's right edge (plus padding) — any participant declared
  // between two members sits visually inside, as in Mermaid. Heights are
  // filled in once the diagram bottom is known (step 8 below).
  const boxes: PositionedParticipantBox[] = renderedBoxes.map((box) => {
    const idxs = box.actorIds.map((id) => actorIndex.get(id) ?? 0)
    const lo = Math.min(...idxs)
    const hi = Math.max(...idxs)
    const left = actorCenterX[lo]! - actorWidths[lo]! / 2 - seq.boxPad
    const right = actorCenterX[hi]! + actorWidths[hi]! / 2 + seq.boxPad
    const positioned: PositionedParticipantBox = {
      label: box.label,
      x: left,
      y: seq.padding,
      width: right - left,
      height: 0,
    }
    if (box.color !== undefined) positioned.color = box.color
    return positioned
  })

  // 3. Stack messages vertically
  let messageY = actorY + seq.actorHeight + seq.headerGap
  const messages: PositionedMessage[] = []

  // Pre-scan blocks to determine which message indices need extra vertical
  // space for block headers (e.g. "alt [Valid credentials]") or divider
  // labels (e.g. "[else Invalid]"). Without this, messages inside blocks
  // overlap with the header/divider text that sits above them.
  const extraSpaceBefore = new Map<number, number>()
  for (const block of diagram.blocks) {
    // First message in the block needs room for the block header label
    const prev = extraSpaceBefore.get(block.startIndex) ?? 0
    extraSpaceBefore.set(block.startIndex, Math.max(prev, seq.blockHeaderExtra))

    // Each divider (else/and) needs room for the divider label
    for (const div of block.dividers) {
      const prevDiv = extraSpaceBefore.get(div.index) ?? 0
      extraSpaceBefore.set(div.index, Math.max(prevDiv, seq.dividerExtra))
    }
  }

  // Pre-group notes by the message index they follow, so we can position
  // them inline during the message stacking loop (avoids overlap bugs).
  const notesByAfterIndex = new Map<number, typeof diagram.notes>()
  for (const note of diagram.notes) {
    const list = notesByAfterIndex.get(note.afterIndex) ?? []
    list.push(note)
    notesByAfterIndex.set(note.afterIndex, list)
  }
  const positionedNotes: PositionedNote[] = []

  // Handle notes that appear before the first message (afterIndex === -1)
  const notesBeforeFirstMsg = notesByAfterIndex.get(-1)
  if (notesBeforeFirstMsg && notesBeforeFirstMsg.length > 0) {
    let noteY = messageY
    for (const note of notesBeforeFirstMsg) {
      const noteW = Math.max(
        seq.noteWidth,
        estimateTextWidth(
          note.text,
          fontSizes.edgeLabel,
          FONT_WEIGHTS.edgeLabel,
        ) +
          seq.notePadX * 2,
      )
      const noteH = fontSizes.edgeLabel + seq.notePadY * 2

      // X positioning based on actor position and note type
      const firstActorIdx = actorIndex.get(note.actorIds[0] ?? '') ?? 0
      let noteX: number
      if (note.position === 'left') {
        noteX =
          actorCenterX[firstActorIdx]! -
          actorWidths[firstActorIdx]! / 2 -
          noteW -
          seq.noteGap
      } else if (note.position === 'right') {
        noteX =
          actorCenterX[firstActorIdx]! +
          actorWidths[firstActorIdx]! / 2 +
          seq.noteGap
      } else {
        // over — center between first and last actor
        if (note.actorIds.length > 1) {
          const lastActorIdx =
            actorIndex.get(note.actorIds[note.actorIds.length - 1] ?? '') ??
            firstActorIdx
          noteX =
            (actorCenterX[firstActorIdx]! + actorCenterX[lastActorIdx]!) / 2 -
            noteW / 2
        } else {
          noteX = actorCenterX[firstActorIdx]! - noteW / 2
        }
      }

      positionedNotes.push({
        text: note.text,
        x: noteX,
        y: noteY,
        width: noteW,
        height: noteH,
        position: note.position,
        actors: note.actorIds,
      })

      noteY += noteH + seq.noteStackGap
    }

    messageY = Math.max(messageY, noteY + seq.messageRowHeight / 2)
  }

  // Track activation stack per actor: array of { startY, depth } objects
  // Depth is used to offset nested activations horizontally for visual clarity
  const activationStacks = new Map<
    string,
    { startY: number; depth: number }[]
  >()
  const activations: Activation[] = []
  const nestingOffset = 4 // Horizontal offset per nesting level

  /** Open an activation bar on `actorId` at row `y` (stacks for nesting). */
  function startActivation(actorId: string, y: number): void {
    const stack = activationStacks.get(actorId) ?? []
    activationStacks.set(actorId, stack)
    const depth = stack.length // Current depth before pushing
    stack.push({ startY: y, depth })
  }

  /**
   * Close the innermost open activation on `actorId` at row `y`. A
   * deactivate with nothing open is ignored rather than fatal (Mermaid
   * itself errors here; this renderer has always been lenient about it).
   */
  function endActivation(actorId: string, y: number): void {
    const stack = activationStacks.get(actorId)
    if (!stack || stack.length === 0) return
    const { startY, depth } = stack.pop()!
    const idx = actorIndex.get(actorId) ?? 0
    // Offset nested activations to the right for visual distinction
    const xOffset = depth * nestingOffset
    activations.push({
      actorId,
      x: actorCenterX[idx]! - seq.activationWidth / 2 + xOffset,
      topY: startY,
      bottomY: y,
      width: seq.activationWidth,
    })
  }

  /**
   * Standalone `activate`/`deactivate` statements, grouped by the message
   * they follow. Applied at that message's row — the same row the `+`/`-`
   * shorthand on that message would use — through the same two helpers, so
   * the two spellings can't drift apart.
   */
  const activationEventsByAfterIndex = new Map<
    number,
    typeof diagram.activations
  >()
  for (const event of diagram.activations) {
    const list = activationEventsByAfterIndex.get(event.afterIndex) ?? []
    list.push(event)
    activationEventsByAfterIndex.set(event.afterIndex, list)
  }
  function applyActivationEvents(afterIndex: number, y: number): void {
    for (const event of activationEventsByAfterIndex.get(afterIndex) ?? []) {
      if (event.kind === 'start') startActivation(event.actorId, y)
      else endActivation(event.actorId, y)
    }
  }

  // Events before the first message open at the top of the message area.
  applyActivationEvents(-1, messageY)

  for (let msgIdx = 0; msgIdx < diagram.messages.length; msgIdx++) {
    const msg = diagram.messages[msgIdx]!
    const fromIdx = actorIndex.get(msg.from) ?? 0
    const toIdx = actorIndex.get(msg.to) ?? 0
    const isSelf = msg.from === msg.to

    // Add extra vertical space if this message sits below a block header or divider
    const extra = extraSpaceBefore.get(msgIdx) ?? 0
    if (extra > 0) messageY += extra

    const x1 = actorCenterX[fromIdx]!
    let x2 = actorCenterX[toIdx]!

    // A `create participant` message ends at the near edge of the box it
    // creates rather than at the lifeline centre — the box sits on this row
    // (see the created-actor placement after this loop), so an arrow to the
    // centre would run underneath it. Mermaid's renderer makes the same
    // adjustment (`receiverAdjustment(actor, width / 2)`).
    const createsRecipient =
      !isSelf && diagram.actors[toIdx]!.createdAt === msgIdx
    if (createsRecipient) {
      const halfW = actorWidths[toIdx]! / 2
      x2 += x1 < x2 ? -halfW : halfW
    }

    messages.push({
      from: msg.from,
      to: msg.to,
      label: msg.label,
      lineStyle: msg.lineStyle,
      arrowHead: msg.arrowHead,
      x1,
      x2,
      y: messageY,
      isSelf,
      bidirectional: msg.bidirectional ?? false,
      seqNumber: msg.seqNumber,
    })

    // Handle activation - track nesting depth for visual offset. The `+`
    // shorthand activates the recipient, `-` deactivates the sender (see
    // parser.ts); standalone statements following this message apply at
    // the same row, after the shorthand, in source order.
    if (msg.activate) startActivation(msg.to, messageY)
    if (msg.deactivate) endActivation(msg.from, messageY)
    applyActivationEvents(msgIdx, messageY)

    // Advance messageY past the message itself
    messageY += isSelf
      ? seq.selfMessageHeight + seq.messageRowHeight
      : seq.messageRowHeight
    // The created box is centred on this row, so its lower half hangs
    // below the arrow — give the next row room to clear it (Mermaid bumps
    // by the same half-height after a creating message).
    if (createsRecipient) messageY += seq.actorHeight / 2

    // Position notes that appear after this message.
    // Notes start below the self-message loop (if self) or below the arrow,
    // and consecutive notes stack vertically. If notes extend beyond the
    // normal message advance, push messageY further so subsequent messages
    // don't overlap.
    const notesForMsg = notesByAfterIndex.get(msgIdx)
    if (notesForMsg && notesForMsg.length > 0) {
      // Self-message loops extend selfMessageHeight below msg.y;
      // normal arrows sit at msg.y with no extension below.
      const selfLoopExtra = isSelf ? seq.selfMessageHeight : 0
      let noteY =
        messages[msgIdx]!.y + selfLoopExtra + seq.noteOffsetAfterMessage

      for (const note of notesForMsg) {
        const noteW = Math.max(
          seq.noteWidth,
          estimateTextWidth(
            note.text,
            fontSizes.edgeLabel,
            FONT_WEIGHTS.edgeLabel,
          ) +
            seq.notePadX * 2,
        )
        const noteH = fontSizes.edgeLabel + seq.notePadY * 2

        // X positioning based on actor position and note type
        const firstActorIdx = actorIndex.get(note.actorIds[0] ?? '') ?? 0
        let noteX: number
        if (note.position === 'left') {
          noteX =
            actorCenterX[firstActorIdx]! -
            actorWidths[firstActorIdx]! / 2 -
            noteW -
            seq.noteGap
        } else if (note.position === 'right') {
          noteX =
            actorCenterX[firstActorIdx]! +
            actorWidths[firstActorIdx]! / 2 +
            seq.noteGap
        } else {
          // over — center between first and last actor
          if (note.actorIds.length > 1) {
            const lastActorIdx =
              actorIndex.get(note.actorIds[note.actorIds.length - 1] ?? '') ??
              firstActorIdx
            noteX =
              (actorCenterX[firstActorIdx]! + actorCenterX[lastActorIdx]!) / 2 -
              noteW / 2
          } else {
            noteX = actorCenterX[firstActorIdx]! - noteW / 2
          }
        }

        positionedNotes.push({
          text: note.text,
          x: noteX,
          y: noteY,
          width: noteW,
          height: noteH,
          position: note.position,
          actors: note.actorIds,
        })

        noteY += noteH + seq.noteStackGap // Stack next note below with gap
      }

      // Push messageY forward if notes extended beyond the normal advance.
      // Add half a row height so the next message's label (rendered at msg.y - 6)
      // has clearance from the last note's bottom edge.
      messageY = Math.max(messageY, noteY + seq.messageRowHeight / 2)
    }
  }

  // Close any unclosed activations (preserving depth for offset)
  for (const [actorId, stack] of activationStacks) {
    for (const { startY, depth } of stack) {
      const idx = actorIndex.get(actorId) ?? 0
      const xOffset = depth * nestingOffset
      activations.push({
        actorId,
        x: actorCenterX[idx]! - seq.activationWidth / 2 + xOffset,
        topY: startY,
        bottomY: messageY - seq.messageRowHeight / 2,
        width: seq.activationWidth,
      })
    }
  }

  // 4. Position blocks (loop/alt/opt)
  const blocks: PositionedBlock[] = diagram.blocks.map((block) => {
    // Block spans from the Y of startIndex to endIndex messages
    const startMsg = messages[block.startIndex]
    const endMsg = messages[block.endIndex]
    const blockTop = (startMsg?.y ?? messageY) - seq.blockPadTop
    const blockBottom = (endMsg?.y ?? messageY) + seq.blockPadBottom + 12

    // Block width spans all actors involved in its messages
    const involvedActors = new Set<number>()
    for (let mi = block.startIndex; mi <= block.endIndex; mi++) {
      const m = diagram.messages[mi]
      if (m) {
        involvedActors.add(actorIndex.get(m.from) ?? 0)
        involvedActors.add(actorIndex.get(m.to) ?? 0)
      }
    }
    // Fallback: span all actors if none involved
    if (involvedActors.size === 0) {
      for (let ai = 0; ai < diagram.actors.length; ai++) involvedActors.add(ai)
    }
    const minIdx = Math.min(...involvedActors)
    const maxIdx = Math.max(...involvedActors)
    const blockLeft =
      actorCenterX[minIdx]! - actorWidths[minIdx]! / 2 - seq.blockPadX
    const blockRight =
      actorCenterX[maxIdx]! + actorWidths[maxIdx]! / 2 + seq.blockPadX

    // Position dividers — offset from message Y so the divider label text
    // (rendered at divider.y + 14 in the renderer) clears the message label
    // (rendered at msg.y - 6).
    //
    // Default offset 28 gives ~8px baseline clearance, which is sufficient
    // when the divider label (left-aligned at block edge) and message label
    // (centered between actors) don't share horizontal space. When they DO
    // overlap horizontally (e.g. long divider labels like "[Account locked]"
    // next to centered message labels like "403 Forbidden"), we increase the
    // offset to 36 so text bounding boxes have ~5px visual clearance.
    const dividers = block.dividers.map((d) => {
      const msg = messages[d.index]
      const msgY = msg?.y ?? messageY
      let offset = 28

      // Dynamic overlap detection: increase offset when the divider label
      // and message label occupy the same horizontal region, which would
      // cause vertical text overlap at the default 8px baseline gap.
      if (d.label && msg?.label) {
        const divLabelText = `[${d.label}]`
        const divLabelW = estimateTextWidth(
          divLabelText,
          fontSizes.edgeLabel,
          FONT_WEIGHTS.edgeLabel,
        )
        const divLabelLeft = blockLeft + 8
        const divLabelRight = divLabelLeft + divLabelW

        const msgLabelW = estimateTextWidth(
          msg.label,
          fontSizes.edgeLabel,
          FONT_WEIGHTS.edgeLabel,
        )
        // Self-messages render labels at x1 + 36 (left-aligned); normal
        // messages center the label between the two actor lifelines.
        const msgLabelLeft = msg.isSelf
          ? msg.x1 + 36
          : (msg.x1 + msg.x2) / 2 - msgLabelW / 2
        const msgLabelRight = msgLabelLeft + msgLabelW

        if (divLabelRight > msgLabelLeft && divLabelLeft < msgLabelRight) {
          offset = 36
        }
      }

      return { y: msgY - offset, label: d.label }
    })

    return {
      type: block.type,
      label: block.label,
      x: blockLeft,
      y: blockTop,
      width: blockRight - blockLeft,
      height: blockBottom - blockTop,
      dividers,
    }
  })

  // 5. Notes — already positioned inline during the message stacking loop
  //    (step 3) to properly account for self-message loops and vertical stacking.
  const notes = positionedNotes

  // 6. Bounding-box post-processing
  //
  // Notes positioned "left of" the first actor or "right of" the last actor
  // can extend beyond the actor-based viewport. Compute the true bounding box
  // across all positioned elements, then shift everything right if anything
  // extends left of the desired padding margin and expand the width to fit.
  const diagramBottom = messageY + seq.padding

  // Find global X extents across actors, blocks, notes, and message labels
  let globalMinX: number = seq.padding // actors already start at seq.padding
  let globalMaxX = 0
  for (const a of actors) {
    globalMinX = Math.min(globalMinX, a.x - a.width / 2)
    globalMaxX = Math.max(globalMaxX, a.x + a.width / 2)
  }
  for (const b of blocks) {
    globalMinX = Math.min(globalMinX, b.x)
    globalMaxX = Math.max(globalMaxX, b.x + b.width)
  }
  for (const n of notes) {
    globalMinX = Math.min(globalMinX, n.x)
    globalMaxX = Math.max(globalMaxX, n.x + n.width)
  }
  for (const b of boxes) {
    globalMinX = Math.min(globalMinX, b.x)
    globalMaxX = Math.max(globalMaxX, b.x + b.width)
  }
  // Include self-message labels in bounding box — they extend to the right of the actor
  // and could be clipped if not accounted for in the SVG width
  for (const m of messages) {
    if (m.isSelf && m.label) {
      const loopW = 30 // matches renderer loopW
      const labelPadding = 8
      const labelLeft = m.x1 + loopW + labelPadding
      const labelWidth = estimateTextWidth(
        m.label,
        fontSizes.edgeLabel,
        FONT_WEIGHTS.edgeLabel,
      )
      globalMaxX = Math.max(globalMaxX, labelLeft + labelWidth + 8) // +8 for safety margin
    }
  }

  // If elements extend left of the desired padding, shift everything right
  const shiftX = globalMinX < seq.padding ? seq.padding - globalMinX : 0
  if (shiftX > 0) {
    for (const a of actors) a.x += shiftX
    for (const m of messages) {
      m.x1 += shiftX
      m.x2 += shiftX
    }
    for (const act of activations) act.x += shiftX
    for (const b of blocks) {
      b.x += shiftX
    }
    for (const n of notes) n.x += shiftX
    for (const b of boxes) b.x += shiftX
    // Also shift actor center X array (used for lifelines below)
    for (let i = 0; i < actorCenterX.length; i++) actorCenterX[i]! += shiftX
  }

  // 7. Participant lifecycle: a created participant's box moves from the
  //    header down to its creating message's row, centred on the arrow
  //    (Mermaid: `actor.starty = lineStartY - actor.height / 2`), and a
  //    destroyed participant's lifeline stops at its destroying message.
  //    Both indices come from the parser, which already verified the
  //    message exists and involves the actor — the `?? messageY` fallbacks
  //    only guard the type, not a reachable state.
  for (let i = 0; i < diagram.actors.length; i++) {
    const createdAt = diagram.actors[i]!.createdAt
    if (createdAt !== undefined) {
      actors[i]!.y = (messages[createdAt]?.y ?? messageY) - seq.actorHeight / 2
    }
  }

  // 8. Calculate final lifelines (after shift so X positions are correct)
  const lifelines: Lifeline[] = diagram.actors.map((a, i) => {
    const destroyedAt = a.destroyedAt
    const lifeline: Lifeline = {
      actorId: a.id,
      x: actorCenterX[i]!,
      topY: actors[i]!.y + seq.actorHeight,
      bottomY:
        destroyedAt === undefined
          ? diagramBottom - seq.padding
          : (messages[destroyedAt]?.y ?? messageY),
    }
    if (destroyedAt !== undefined) lifeline.destroyed = true
    return lifeline
  })

  // Box backgrounds run from the top padding to just under the lifeline
  // bottoms (boxPad < padding, so this stays inside the diagram height).
  for (const b of boxes) {
    b.height = diagramBottom - seq.padding + seq.boxPad - b.y
  }

  // 9. Calculate diagram dimensions from the bounding box
  const diagramWidth = globalMaxX + shiftX + seq.padding
  const diagramHeight = diagramBottom

  return {
    width: Math.max(diagramWidth, 200),
    height: Math.max(diagramHeight, 100),
    actors,
    lifelines,
    messages,
    activations,
    blocks,
    notes,
    boxes,
  }
}
