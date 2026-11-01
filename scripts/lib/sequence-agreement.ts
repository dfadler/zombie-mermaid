/**
 * Sequence-diagram order agreement against official mermaid.js (#1686),
 * for scripts/sequence-oracle.ts. Browser-free so it can be unit-tested.
 *
 * Sequence diagrams are not laid out by a graph engine: mermaid puts
 * participants left to right and messages top to bottom. So node placement
 * (layout-agreement.ts) says nothing; what can still regress is the order and
 * direction of that grid (a participant created by a message, an `autonumber`,
 * a `box`, a `par` block, an alias). Only order and direction are compared,
 * not pixel positions, so font and padding differences do not count.
 */

/** x of every participant lifeline, and every message in source order. */
export interface SeqLayout {
  actors: Record<string, number>
  messages: { from: string; to: string; y: number }[]
}

/** Each figure is the share of agreeing pairs/messages, 0..1, or null with nothing to compare. */
export interface SeqAgreement {
  /** Participant pairs on the same side (left/right) of each other. */
  participants: number | null
  /** Message pairs in the same top/bottom order. */
  messages: number | null
  /** Messages pointing the same way (left, right or to self). */
  direction: number | null
  actors: number
  msgs: number
}

const attr = (tag: string, name: string): string | undefined => {
  const start = tag.indexOf(` ${name}="`)
  if (start < 0) return undefined
  const from = start + name.length + 3
  return tag.slice(from, tag.indexOf('"', from))
}

const nums = (s: string | undefined): number[] =>
  (s?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)

/** First y of the first line, path or polyline in `html`: where a message starts. */
function firstY(html: string): number | undefined {
  const tag = /<(line|path|polyline)\b[^>]*>/.exec(html)
  if (!tag) return undefined
  if (tag[1] === 'line') return nums(attr(tag[0], 'y1'))[0]
  // A path `M x,y C ...` and polyline `x,y x,y ...` both start with an x,y pair.
  return nums(attr(tag[0], tag[1] === 'path' ? 'd' : 'points'))[1]
}

/** Official mermaid: `line[data-et=life-line]` and `[data-et=message]` elements. */
export function parseOfficialSequence(svg: string): SeqLayout {
  const actors: Record<string, number> = {}
  for (const m of svg.matchAll(/<line\b[^>]*data-et="life-line"[^>]*>/g)) {
    const id = attr(m[0], 'data-id')
    const x = nums(attr(m[0], 'x1'))[0]
    if (id !== undefined && x !== undefined) actors[id] = x
  }
  const messages: SeqLayout['messages'] = []
  for (const m of svg.matchAll(
    /<(?:line|path)\b[^>]*data-et="message"[^>]*>/g,
  )) {
    const y = firstY(m[0])
    if (y !== undefined) {
      messages.push({
        from: attr(m[0], 'data-from') ?? '',
        to: attr(m[0], 'data-to') ?? '',
        y,
      })
    }
  }
  return { actors, messages }
}

/** Our renderer: `line.lifeline[data-actor]` and `g.message[data-from][data-to]`. */
export function parseOurSequence(svg: string): SeqLayout {
  const actors: Record<string, number> = {}
  for (const m of svg.matchAll(/<line\b[^>]*class="lifeline"[^>]*>/g)) {
    const id = attr(m[0], 'data-actor')
    const x = nums(attr(m[0], 'x1'))[0]
    if (id !== undefined && x !== undefined) actors[id] = x
  }
  const messages: SeqLayout['messages'] = []
  for (const m of svg.matchAll(
    /<g\b[^>]*class="message"[^>]*>([\s\S]*?)<\/g>/g,
  )) {
    const y = firstY(m[1]!)
    if (y !== undefined) {
      messages.push({
        from: attr(m[0], 'data-from') ?? '',
        to: attr(m[0], 'data-to') ?? '',
        y,
      })
    }
  }
  return { actors, messages }
}

const share = (agree: number, total: number): number | null =>
  total === 0 ? null : agree / total

const side = (a: number | undefined, b: number | undefined): number =>
  a === undefined || b === undefined ? NaN : Math.sign(a - b)

/** Order and direction agreement of our sequence layout with the official one. */
export function sequenceAgreement(
  official: SeqLayout,
  ours: SeqLayout,
): SeqAgreement {
  const ids = Object.keys(official.actors).sort()
  let pairs = 0
  let agree = 0
  for (const [i, a] of ids.entries()) {
    for (const b of ids.slice(i + 1)) {
      pairs++
      if (
        side(official.actors[a], official.actors[b]) ===
        side(ours.actors[a], ours.actors[b])
      ) {
        agree++
      }
    }
  }
  const participants = share(agree, pairs)

  const om = official.messages
  pairs = 0
  agree = 0
  for (let i = 0; i < om.length; i++) {
    for (let j = i + 1; j < om.length; j++) {
      pairs++
      if (
        side(om[i]!.y, om[j]!.y) ===
        side(ours.messages[i]?.y, ours.messages[j]?.y)
      ) {
        agree++
      }
    }
  }
  const messages = share(agree, pairs)

  const dir = (l: SeqLayout, i: number): number => {
    const m = l.messages[i]
    return m ? side(l.actors[m.to], l.actors[m.from]) : NaN
  }
  agree = om.filter((_, i) => dir(official, i) === dir(ours, i)).length
  return {
    participants,
    messages,
    direction: share(agree, om.length),
    actors: ids.length,
    msgs: om.length,
  }
}

/** Lowest figure of a sample, or null when it has none (a lone participant, no messages). */
export function worstSeq(a: SeqAgreement): number | null {
  const v = [a.participants, a.messages, a.direction].filter(
    (n): n is number => n !== null,
  )
  return v.length > 0 ? Math.min(...v) : null
}

/**
 * Floor for every sample's lowest figure. Order and direction agree
 * everywhere today, so any disagreement is a regression: no per-sample
 * overrides, and a sample that needs one should say why next to it.
 */
export const SEQUENCE_FLOOR = 1

/**
 * One tracked sequence data point (#1686, scripts/sequence-oracle.ts): mean
 * of each figure over the sequence samples. Floor-gated per sample.
 */
export interface SequenceEntry {
  kind: 'sequence'
  date: string
  commit: string
  mermaid: string
  samples: number
  participants: number | null
  messages: number | null
  direction: number | null
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((n): n is number => n !== null)
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Collapse per-sample results into one history entry. */
export function summarizeSequence(
  results: Record<string, SeqAgreement>,
  meta: { date: string; commit: string; mermaid: string },
): SequenceEntry {
  const all = Object.values(results)
  return {
    kind: 'sequence',
    ...meta,
    samples: all.length,
    participants: mean(all.map((r) => r.participants)),
    messages: mean(all.map((r) => r.messages)),
    direction: mean(all.map((r) => r.direction)),
  }
}

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function sequenceBreaches(
  results: Record<string, SeqAgreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstSeq(r)
    if (low !== null && low + 1e-9 < SEQUENCE_FLOOR) {
      out.push(
        `${title} (${Math.round(low * 100)}% < ${SEQUENCE_FLOOR * 100}%)`,
      )
    }
  }
  return out
}
