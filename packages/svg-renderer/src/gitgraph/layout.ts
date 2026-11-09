// ============================================================================
// GitGraph layout
//
// A port of Mermaid's gitGraphRenderer.ts (checked against mermaid@12.3.0):
// the same constants, the same two passes over the commits (the first only
// records positions, the second draws), the same arrow routing and the same
// branch-label geometry, for `LR`, `TB` and `BT`, with and without
// `parallelCommits` and `rotateCommitLabel`. Mermaid measures text with
// getBBox in the browser; here widths are summed Trebuchet MS advances (as for
// timeline) and a line is `round(.939 em) + round(.222 em)` tall, which
// matches the 19px (16px text) and 11px (10px text) it measures.
//
// The viewBox is Mermaid's too: the bounding box of everything drawn, padded
// by 8. Coordinates stay in Mermaid's user space; the renderer shifts them so
// the viewBox starts at 0,0.
// ============================================================================

import type {
  GitCommit,
  GitGraph,
  PositionedGitArrow,
  PositionedGitBranch,
  PositionedGitCommit,
  PositionedGitGraph,
  PositionedGitShape,
  PositionedGitTag,
} from '@zombie-mermaid/mermaid-parser'
import { textWidth } from '../timeline/layout.ts'

const LAYOUT_OFFSET = 10
const COMMIT_STEP = 40
const PX = 4
const PY = 2
const THEME_COLOR_LIMIT = 8
const DEFAULT_POS = 30
const DIAGRAM_PADDING = 8
const TITLE_TOP_MARGIN = 25

interface Pt {
  x: number
  y: number
}

/** The height of a line of text at `size` px, as Chromium rounds the font's ascent and descent. */
export function lineHeight(size: number): number {
  return Math.round(0.939 * size) + Math.round(0.222 * size)
}
const ascent = (size: number): number => Math.round(0.939 * size)
const descent = (size: number): number => Math.round(0.222 * size)

/** Mermaid's `drawText` splits a branch name into rows on `\n` and `<br>`. */
function textRows(txt: string): string[] {
  return txt.split(/\\n|\n|<br\s*\/?>/gi).map((r) => r.trim())
}

/** Bounding box accumulator (SVG getBBox: fill geometry, no stroke). */
class Box {
  minX = Infinity
  minY = Infinity
  maxX = -Infinity
  maxY = -Infinity
  add(x: number, y: number): void {
    if (x < this.minX) this.minX = x
    if (x > this.maxX) this.maxX = x
    if (y < this.minY) this.minY = y
    if (y > this.maxY) this.maxY = y
  }
  rect(x: number, y: number, w: number, h: number, t?: (p: Pt) => Pt): void {
    for (const p of [
      { x, y },
      { x: x + w, y },
      { x, y: y + h },
      { x: x + w, y: y + h },
    ]) {
      const q = t ? t(p) : p
      this.add(q.x, q.y)
    }
  }
}

type Transform = (p: Pt) => Pt
const rotateAbout =
  (deg: number, cx: number, cy: number): Transform =>
  (p) => {
    const a = (deg * Math.PI) / 180
    const dx = p.x - cx
    const dy = p.y - cy
    return {
      x: cx + dx * Math.cos(a) - dy * Math.sin(a),
      y: cy + dx * Math.sin(a) + dy * Math.cos(a),
    }
  }
const translate =
  (tx: number, ty: number): Transform =>
  (p) => ({ x: p.x + tx, y: p.y + ty })
const compose =
  (...fns: Transform[]): Transform =>
  (p) =>
    fns.reduceRight((q, f) => f(q), p)

const num = (n: number): string => String(Math.round(n * 1e6) / 1e6)

export function layoutGitGraph(g: GitGraph): PositionedGitGraph {
  const dir = g.direction
  const vertical = dir === 'TB' || dir === 'BT'
  const cfg = g.config
  const commits = new Map<string, GitCommit>(g.commits.map((c) => [c.id, c]))

  const branchPos = new Map<string, { pos: number; index: number }>()
  const commitPos = new Map<string, Pt>()
  const lanes: number[] = []
  let maxPos = 0
  const box = new Box()

  // ---- branch positions -------------------------------------------------
  let bp = 0
  g.branches.forEach((name, index) => {
    const w = Math.max(...textRows(name).map((r) => textWidth(r)))
    branchPos.set(name, { pos: bp, index })
    bp += 50 + (cfg.rotateCommitLabel ? 40 : 0) + (vertical ? w / 2 : 0)
  })

  // ---- positions of commits ---------------------------------------------
  const findClosestParent = (parents: string[]): string | undefined => {
    let closest: string | undefined
    let target: number
    let cmp: (a: number, b: number) => boolean
    if (dir === 'BT') {
      cmp = (a, b) => a <= b
      target = Infinity
    } else {
      cmp = (a, b) => a >= b
      target = 0
    }
    for (const parent of parents) {
      const p = vertical ? commitPos.get(parent)?.y : commitPos.get(parent)?.x
      if (p !== undefined && cmp(p, target)) {
        closest = parent
        target = p
      }
    }
    return closest
  }

  const findClosestParentBT = (parents: string[]): string | undefined => {
    let closest = ''
    let max = Infinity
    for (const parent of parents) {
      const p = commitPos.get(parent)!.y
      if (p <= max) {
        closest = parent
        max = p
      }
    }
    return closest || undefined
  }

  const calculateCommitPosition = (c: GitCommit): number => {
    const closest = findClosestParent(c.parents.filter((p) => p !== null))
    if (!closest) throw new Error(`Closest parent not found for commit ${c.id}`)
    const y = commitPos.get(closest)?.y
    if (y === undefined)
      throw new Error(`Closest parent position not found for commit ${c.id}`)
    return y + COMMIT_STEP
  }

  const setParallelBTPos = (sortedKeys: string[], defaultPos: number): void => {
    let curPos = defaultPos
    let maxPosition = defaultPos
    const roots: GitCommit[] = []
    for (const key of sortedKeys) {
      const c = commits.get(key)!
      if (c.parents.length) {
        curPos = calculateCommitPosition(c)
        maxPosition = Math.max(curPos, maxPosition)
      } else roots.push(c)
      const b = branchPos.get(c.branch)!
      commitPos.set(c.id, { x: b.pos, y: curPos + LAYOUT_OFFSET })
    }
    curPos = maxPosition
    for (const c of roots) {
      const b = branchPos.get(c.branch)!
      commitPos.set(c.id, { x: b.pos, y: curPos + defaultPos })
    }
    for (const key of sortedKeys) {
      const c = commits.get(key)!
      if (c.parents.length) {
        const closest = findClosestParentBT(c.parents)!
        curPos = commitPos.get(closest)!.y - COMMIT_STEP
        if (curPos <= maxPosition) maxPosition = curPos
        const x = branchPos.get(c.branch)!.pos
        commitPos.set(c.id, { x, y: curPos - LAYOUT_OFFSET })
      }
    }
  }

  const calculatePosition = (c: GitCommit): number => {
    if (c.parents.length > 0) {
      const closest = findClosestParent(c.parents)
      if (closest) {
        const pp = commitPos.get(closest) ?? { x: 0, y: 0 }
        if (dir === 'TB') return pp.y + COMMIT_STEP
        if (dir === 'BT')
          return (commitPos.get(c.id) ?? { x: 0, y: 0 }).y - COMMIT_STEP
        return pp.x + COMMIT_STEP
      }
    } else {
      if (dir === 'TB') return DEFAULT_POS
      if (dir === 'BT')
        return (commitPos.get(c.id) ?? { x: 0, y: 0 }).y - COMMIT_STEP
      return 0
    }
    return 0
  }

  const getCommitPosition = (
    c: GitCommit,
    pos: number,
  ): { x: number; y: number; posWithOffset: number } => {
    const posWithOffset =
      dir === 'BT' && cfg.parallelCommits ? pos : pos + LAYOUT_OFFSET
    const branchY = branchPos.get(c.branch)?.pos
    const x = vertical ? branchPos.get(c.branch)?.pos : posWithOffset
    if (x === undefined || branchY === undefined)
      throw new Error(`Position were undefined for commit ${c.id}`)
    const y = vertical ? posWithOffset : branchY - 2
    return { x, y, posWithOffset }
  }

  const colorOf = (branch: string): number =>
    (branchPos.get(branch)?.index ?? 0) % THEME_COLOR_LIMIT

  // ---- commit symbols, labels and tags ----------------------------------
  const typeClassOf = (c: GitCommit): string => {
    switch (c.customType ?? c.type) {
      case 'REVERSE':
        return 'commit-reverse'
      case 'HIGHLIGHT':
        return 'commit-highlight'
      case 'MERGE':
        return 'commit-merge'
      case 'CHERRY_PICK':
        return 'commit-cherry-pick'
      default:
        return 'commit-normal'
    }
  }

  const bullet = (
    c: GitCommit,
    p: { x: number; y: number },
  ): PositionedGitShape[] => {
    const sym = c.customType ?? c.type
    const tc = typeClassOf(c)
    const ci = colorOf(c.branch)
    const out: PositionedGitShape[] = []
    if (sym === 'HIGHLIGHT') {
      out.push({
        kind: 'rect',
        x: p.x - 10,
        y: p.y - 10,
        w: 20,
        h: 20,
        cls: `commit ${c.id} commit-highlight${ci} ${tc}-outer`,
      })
      out.push({
        kind: 'rect',
        x: p.x - 6,
        y: p.y - 6,
        w: 12,
        h: 12,
        cls: `commit ${c.id} commit${ci} ${tc}-inner`,
      })
    } else if (sym === 'CHERRY_PICK') {
      const cls = `commit ${c.id} ${tc}`
      out.push({ kind: 'circle', cx: p.x, cy: p.y, r: 10, cls })
      out.push({
        kind: 'circle',
        cx: p.x - 3,
        cy: p.y + 2,
        r: 2.75,
        cls,
        fill: '#fff',
      })
      out.push({
        kind: 'circle',
        cx: p.x + 3,
        cy: p.y + 2,
        r: 2.75,
        cls,
        fill: '#fff',
      })
      out.push({
        kind: 'line',
        x1: p.x + 3,
        y1: p.y + 1,
        x2: p.x,
        y2: p.y - 5,
        cls,
        stroke: '#fff',
      })
      out.push({
        kind: 'line',
        x1: p.x - 3,
        y1: p.y + 1,
        x2: p.x,
        y2: p.y - 5,
        cls,
        stroke: '#fff',
      })
    } else {
      out.push({
        kind: 'circle',
        cx: p.x,
        cy: p.y,
        r: 10,
        cls: `commit ${c.id} commit${ci}`,
      })
      if (sym === 'MERGE')
        out.push({
          kind: 'circle',
          cx: p.x,
          cy: p.y,
          r: 6,
          cls: `commit ${tc} ${c.id} commit${ci}`,
        })
      if (sym === 'REVERSE')
        out.push({
          kind: 'path',
          d: `M ${p.x - 5},${p.y - 5}L${p.x + 5},${p.y + 5}M${p.x - 5},${p.y + 5}L${p.x + 5},${p.y - 5}`,
          cls: `commit ${tc} ${c.id} commit${ci}`,
        })
    }
    return out
  }

  const labelOf = (
    c: GitCommit,
    cp: { x: number; y: number; posWithOffset: number },
    pos: number,
  ): PositionedGitCommit['label'] => {
    if (
      !(
        c.type !== 'CHERRY_PICK' &&
        ((c.customId && c.type === 'MERGE') || c.type !== 'MERGE') &&
        cfg.showCommitLabel
      )
    )
      return undefined
    const w = textWidth(c.id, 10)
    const h = lineHeight(10)
    let rect = {
      x: cp.posWithOffset - w / 2 - PY,
      y: cp.y + 13.5,
      w: w + 2 * PY,
      h: h + 2 * PY,
    }
    let textPos = { x: pos, y: cp.y + 25 }
    const label: NonNullable<PositionedGitCommit['label']> = {
      text: c.id,
      rect,
      textPos,
    }
    let t: Transform | undefined
    if (vertical) {
      rect = {
        ...rect,
        x: cp.x - (w + 4 * PX + 5),
        y: cp.y - 12,
      }
      textPos = { x: cp.x - (w + 4 * PX), y: cp.y + h - 12 }
      label.rect = rect
      label.textPos = textPos
      if (cfg.rotateCommitLabel) {
        label.rotate = `rotate(-45, ${num(cp.x)}, ${num(cp.y)})`
        t = rotateAbout(-45, cp.x, cp.y)
      }
    } else {
      textPos = { x: cp.posWithOffset - w / 2, y: cp.y + 25 }
      label.textPos = textPos
      if (cfg.rotateCommitLabel) {
        const rx = -7.5 - ((w + 10) / 25) * 9.5
        const ry = 10 + (w / 25) * 8.5
        label.groupTransform = `translate(${num(rx)}, ${num(ry)}) rotate(-45, ${num(pos)}, ${num(cp.y)})`
        t = compose(translate(rx, ry), rotateAbout(-45, pos, cp.y))
      }
    }
    box.rect(label.rect.x, label.rect.y, label.rect.w, label.rect.h, t)
    box.rect(label.textPos.x, label.textPos.y - ascent(10), w, h, t)
    return label
  }

  const tagsOf = (
    c: GitCommit,
    cp: { x: number; y: number; posWithOffset: number },
    pos: number,
  ): PositionedGitTag[] => {
    if (c.tags.length === 0) return []
    // Mermaid reverses the tags in place: the last one is drawn nearest the commit.
    const values = [...c.tags].reverse()
    const h = lineHeight(10)
    const widths = values.map((v) => textWidth(v, 10))
    const maxW = Math.max(...widths)
    const h2 = h / 2
    const out: PositionedGitTag[] = []
    values.forEach((text, i) => {
      const yOffset = i * 20
      const ly = cp.y - 19.2 - yOffset
      const tag: PositionedGitTag = {
        text,
        points: [
          [pos - maxW / 2 - PX / 2, ly + PY],
          [pos - maxW / 2 - PX / 2, ly - PY],
          [cp.posWithOffset - maxW / 2 - PX, ly - h2 - PY],
          [cp.posWithOffset + maxW / 2 + PX, ly - h2 - PY],
          [cp.posWithOffset + maxW / 2 + PX, ly + h2 + PY],
          [cp.posWithOffset - maxW / 2 - PX, ly + h2 + PY],
        ]
          .map(([x, y]) => `${num(x!)},${num(y!)}`)
          .join(' '),
        hole: { cx: pos - maxW / 2 + PX / 2, cy: ly },
        textPos: {
          x: cp.posWithOffset - widths[i]! / 2,
          y: cp.y - 16 - yOffset,
        },
      }
      let polyPts = [
        { x: pos - maxW / 2 - PX / 2, y: ly + PY },
        { x: pos - maxW / 2 - PX / 2, y: ly - PY },
        { x: cp.posWithOffset - maxW / 2 - PX, y: ly - h2 - PY },
        { x: cp.posWithOffset + maxW / 2 + PX, y: ly - h2 - PY },
        { x: cp.posWithOffset + maxW / 2 + PX, y: ly + h2 + PY },
        { x: cp.posWithOffset - maxW / 2 - PX, y: ly + h2 + PY },
      ]
      let hole: Pt = { x: tag.hole.cx, y: tag.hole.cy }
      let textBox = {
        x: tag.textPos.x,
        y: tag.textPos.y - ascent(10),
        w: widths[i]!,
        t: undefined as Transform | undefined,
      }
      if (vertical) {
        const yOrigin = pos + yOffset
        const x = cp.x
        polyPts = [
          { x, y: yOrigin + 2 },
          { x, y: yOrigin - 2 },
          { x: x + LAYOUT_OFFSET, y: yOrigin - h2 - 2 },
          { x: x + LAYOUT_OFFSET + maxW + 4, y: yOrigin - h2 - 2 },
          { x: x + LAYOUT_OFFSET + maxW + 4, y: yOrigin + h2 + 2 },
          { x: x + LAYOUT_OFFSET, y: yOrigin + h2 + 2 },
        ]
        tag.points = polyPts.map((p) => `${num(p.x)},${num(p.y)}`).join(' ')
        tag.polygonTransform = `translate(12,12) rotate(45, ${num(x)},${num(pos)})`
        tag.hole = { cx: x + PX / 2, cy: yOrigin }
        tag.holeTransform = tag.polygonTransform
        tag.textPos = { x: x + 5, y: yOrigin + 3 }
        tag.textTransform = `translate(14,14) rotate(45, ${num(x)},${num(pos)})`
        const rot = rotateAbout(45, x, pos)
        const t12 = compose(translate(12, 12), rot)
        const t14 = compose(translate(14, 14), rot)
        polyPts = polyPts.map(t12)
        hole = t12({ x: tag.hole.cx, y: tag.hole.cy })
        textBox = {
          x: tag.textPos.x,
          y: tag.textPos.y - ascent(10),
          w: widths[i]!,
          t: t14,
        }
      }
      for (const p of polyPts) box.add(p.x, p.y)
      box.add(hole.x - 1.5, hole.y - 1.5)
      box.add(hole.x + 1.5, hole.y + 1.5)
      box.rect(textBox.x, textBox.y, textBox.w, h, textBox.t)
      out.push(tag)
    })
    return out
  }

  const drawCommits = (modify: boolean): PositionedGitCommit[] => {
    const out: PositionedGitCommit[] = []
    let pos = vertical ? DEFAULT_POS : 0
    let sortedKeys = [...commits.keys()].sort(
      (a, b) => commits.get(a)!.seq - commits.get(b)!.seq,
    )
    if (dir === 'BT') {
      if (cfg.parallelCommits) setParallelBTPos(sortedKeys, pos)
      sortedKeys = sortedKeys.reverse()
    }
    for (const key of sortedKeys) {
      const c = commits.get(key)!
      if (cfg.parallelCommits) pos = calculatePosition(c)
      const cp = getCommitPosition(c, pos)
      if (modify) {
        const shapes = bullet(c, cp)
        for (const s of shapes) {
          if (s.kind === 'circle') {
            box.add(s.cx - s.r, s.cy - s.r)
            box.add(s.cx + s.r, s.cy + s.r)
          } else if (s.kind === 'rect') box.rect(s.x, s.y, s.w, s.h)
          else if (s.kind === 'path') {
            box.add(cp.x - 5, cp.y - 5)
            box.add(cp.x + 5, cp.y + 5)
          } else {
            box.add(s.x1, s.y1)
            box.add(s.x2, s.y2)
          }
        }
        const label = labelOf(c, cp, pos)
        const tags = tagsOf(c, cp, pos)
        const pc: PositionedGitCommit = { id: c.id, shapes, tags }
        if (label) pc.label = label
        out.push(pc)
      }
      if (vertical) commitPos.set(c.id, { x: cp.x, y: cp.posWithOffset })
      else commitPos.set(c.id, { x: cp.posWithOffset, y: cp.y })
      pos =
        dir === 'BT' && cfg.parallelCommits
          ? pos + COMMIT_STEP
          : pos + COMMIT_STEP + LAYOUT_OFFSET
      if (pos > maxPos) maxPos = pos
    }
    return out
  }

  // ---- arrows -----------------------------------------------------------
  const findLane = (y1: number, y2: number, depth = 0): number => {
    const candidate = y1 + Math.abs(y1 - y2) / 2
    if (depth > 5) return candidate
    if (lanes.every((lane) => Math.abs(lane - candidate) >= 10)) {
      lanes.push(candidate)
      return candidate
    }
    const diff = Math.abs(y1 - y2)
    return findLane(y1, y2 - diff / 5, depth + 1)
  }

  const shouldReroute = (
    a: GitCommit,
    b: GitCommit,
    p1: Pt,
    p2: Pt,
  ): boolean => {
    const bIsFurthest = vertical ? p1.x < p2.x : p1.y < p2.y
    const branch = bIsFurthest ? b.branch : a.branch
    return [...commits.values()].some(
      (x) => x.seq > a.seq && x.seq < b.seq && x.branch === branch,
    )
  }

  const drawArrow = (a: GitCommit, b: GitCommit): PositionedGitArrow => {
    const p1 = commitPos.get(a.id)
    const p2 = commitPos.get(b.id)
    if (p1 === undefined || p2 === undefined)
      throw new Error(
        `Commit positions not found for commits ${a.id} and ${b.id}`,
      )
    const reroute = shouldReroute(a, b, p1, p2)
    let arc = ''
    let arc2 = ''
    let radius = 0
    let offset = 0
    let colorIdx = branchPos.get(b.branch)?.index
    const mergeFromOther = b.type === 'MERGE' && a.id !== b.parents[0]
    if (mergeFromOther) colorIdx = branchPos.get(a.branch)?.index
    let d: string | undefined
    if (reroute) {
      arc = 'A 10 10, 0, 0, 0,'
      arc2 = 'A 10 10, 0, 0, 1,'
      radius = 10
      offset = 10
      const lineY = p1.y < p2.y ? findLane(p1.y, p2.y) : findLane(p2.y, p1.y)
      const lineX = p1.x < p2.x ? findLane(p1.x, p2.x) : findLane(p2.x, p1.x)
      if (dir === 'TB') {
        if (p1.x < p2.x) {
          d = `M ${p1.x} ${p1.y} L ${lineX - radius} ${p1.y} ${arc2} ${lineX} ${p1.y + offset} L ${lineX} ${p2.y - radius} ${arc} ${lineX + offset} ${p2.y} L ${p2.x} ${p2.y}`
        } else {
          colorIdx = branchPos.get(a.branch)?.index
          d = `M ${p1.x} ${p1.y} L ${lineX + radius} ${p1.y} ${arc} ${lineX} ${p1.y + offset} L ${lineX} ${p2.y - radius} ${arc2} ${lineX - offset} ${p2.y} L ${p2.x} ${p2.y}`
        }
      } else if (dir === 'BT') {
        if (p1.x < p2.x) {
          d = `M ${p1.x} ${p1.y} L ${lineX - radius} ${p1.y} ${arc} ${lineX} ${p1.y - offset} L ${lineX} ${p2.y + radius} ${arc2} ${lineX + offset} ${p2.y} L ${p2.x} ${p2.y}`
        } else {
          colorIdx = branchPos.get(a.branch)?.index
          d = `M ${p1.x} ${p1.y} L ${lineX + radius} ${p1.y} ${arc2} ${lineX} ${p1.y - offset} L ${lineX} ${p2.y + radius} ${arc} ${lineX - offset} ${p2.y} L ${p2.x} ${p2.y}`
        }
      } else if (p1.y < p2.y) {
        d = `M ${p1.x} ${p1.y} L ${p1.x} ${lineY - radius} ${arc} ${p1.x + offset} ${lineY} L ${p2.x - radius} ${lineY} ${arc2} ${p2.x} ${lineY + offset} L ${p2.x} ${p2.y}`
      } else {
        colorIdx = branchPos.get(a.branch)?.index
        d = `M ${p1.x} ${p1.y} L ${p1.x} ${lineY + radius} ${arc2} ${p1.x + offset} ${lineY} L ${p2.x - radius} ${lineY} ${arc} ${p2.x} ${lineY - offset} L ${p2.x} ${p2.y}`
      }
    } else {
      arc = 'A 20 20, 0, 0, 0,'
      arc2 = 'A 20 20, 0, 0, 1,'
      radius = 20
      offset = 20
      if (dir === 'TB') {
        if (p1.x < p2.x) {
          d = mergeFromOther
            ? `M ${p1.x} ${p1.y} L ${p1.x} ${p2.y - radius} ${arc} ${p1.x + offset} ${p2.y} L ${p2.x} ${p2.y}`
            : `M ${p1.x} ${p1.y} L ${p2.x - radius} ${p1.y} ${arc2} ${p2.x} ${p1.y + offset} L ${p2.x} ${p2.y}`
        }
        if (p1.x > p2.x) {
          d = mergeFromOther
            ? `M ${p1.x} ${p1.y} L ${p1.x} ${p2.y - radius} ${arc2} ${p1.x - offset} ${p2.y} L ${p2.x} ${p2.y}`
            : `M ${p1.x} ${p1.y} L ${p2.x + radius} ${p1.y} ${arc} ${p2.x} ${p1.y + offset} L ${p2.x} ${p2.y}`
        }
        if (p1.x === p2.x) d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
      } else if (dir === 'BT') {
        if (p1.x < p2.x) {
          d = mergeFromOther
            ? `M ${p1.x} ${p1.y} L ${p1.x} ${p2.y + radius} ${arc2} ${p1.x + offset} ${p2.y} L ${p2.x} ${p2.y}`
            : `M ${p1.x} ${p1.y} L ${p2.x - radius} ${p1.y} ${arc} ${p2.x} ${p1.y - offset} L ${p2.x} ${p2.y}`
        }
        if (p1.x > p2.x) {
          d = mergeFromOther
            ? `M ${p1.x} ${p1.y} L ${p1.x} ${p2.y + radius} ${arc} ${p1.x - offset} ${p2.y} L ${p2.x} ${p2.y}`
            : `M ${p1.x} ${p1.y} L ${p2.x + radius} ${p1.y} ${arc2} ${p2.x} ${p1.y - offset} L ${p2.x} ${p2.y}`
        }
        if (p1.x === p2.x) d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
      } else {
        if (p1.y < p2.y) {
          d = mergeFromOther
            ? `M ${p1.x} ${p1.y} L ${p2.x - radius} ${p1.y} ${arc2} ${p2.x} ${p1.y + offset} L ${p2.x} ${p2.y}`
            : `M ${p1.x} ${p1.y} L ${p1.x} ${p2.y - radius} ${arc} ${p1.x + offset} ${p2.y} L ${p2.x} ${p2.y}`
        }
        if (p1.y > p2.y) {
          d = mergeFromOther
            ? `M ${p1.x} ${p1.y} L ${p2.x - radius} ${p1.y} ${arc} ${p2.x} ${p1.y - offset} L ${p2.x} ${p2.y}`
            : `M ${p1.x} ${p1.y} L ${p1.x} ${p2.y + radius} ${arc2} ${p1.x + offset} ${p2.y} L ${p2.x} ${p2.y}`
        }
        if (p1.y === p2.y) d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
      }
    }
    if (d === undefined) throw new Error('Line definition not found')
    // Every vertex of the path (the arcs are quarter circles inside their corner box).
    for (const m of d.matchAll(
      /[ML] (-?[\d.e+-]+) (-?[\d.e+-]+)|, 0, 0, [01], (-?[\d.e+-]+) (-?[\d.e+-]+)/g,
    )) {
      box.add(Number(m[1] ?? m[3]), Number(m[2] ?? m[4]))
    }
    return { d, colorIndex: (colorIdx ?? 0) % THEME_COLOR_LIMIT }
  }

  // ---- run: first pass positions, branches, arrows, second pass draws ----
  drawCommits(false)

  const branches: PositionedGitBranch[] = []
  if (cfg.showBranches) {
    g.branches.forEach((name, index) => {
      const ci = index % THEME_COLOR_LIMIT
      const pos = branchPos.get(name)!.pos
      const spineY = vertical ? pos : pos - 2
      let line = { x1: 0, y1: spineY, x2: maxPos, y2: spineY }
      if (dir === 'TB') line = { x1: pos, y1: DEFAULT_POS, x2: pos, y2: maxPos }
      else if (dir === 'BT')
        line = { x1: pos, y1: maxPos, x2: pos, y2: DEFAULT_POS }
      lanes.push(spineY)
      box.add(line.x1, line.y1)
      box.add(line.x2, line.y2)

      const rows = textRows(name)
      const bw = Math.max(...rows.map((r) => textWidth(r)))
      const bh = rows.length * lineHeight(16)
      const rot = cfg.rotateCommitLabel ? 30 : 0
      let bkg: PositionedGitBranch['bkg'] = {
        x: -bw - 4 - rot,
        y: -bh / 2 + 10,
        w: bw + 18,
        h: bh + 4,
        tx: -19,
        ty: spineY - 12,
      }
      let label = { x: -bw - 14 - rot, y: spineY - bh / 2 - 2 }
      if (dir === 'TB') {
        bkg = { x: pos - bw / 2 - 10, y: 0, w: bkg.w, h: bkg.h }
        label = { x: pos - bw / 2 - 5, y: 0 }
      } else if (dir === 'BT') {
        bkg = { x: pos - bw / 2 - 10, y: maxPos, w: bkg.w, h: bkg.h }
        label = { x: pos - bw / 2 - 5, y: maxPos }
      }
      box.rect(bkg.x + (bkg.tx ?? 0), bkg.y + (bkg.ty ?? 0), bkg.w, bkg.h)
      box.rect(label.x, label.y + 1, bw, bh)
      branches.push({ name, colorIndex: ci, line, bkg, label })
    })
  }

  const arrows: PositionedGitArrow[] = []
  for (const c of commits.values())
    for (const parent of c.parents)
      arrows.push(drawArrow(commits.get(parent)!, c))

  const drawn = drawCommits(true)

  // ---- title and viewBox -------------------------------------------------
  const out: PositionedGitGraph = {
    direction: dir,
    viewBox: { x: 0, y: 0, width: 0, height: 0 },
    branches,
    arrows,
    commits: drawn,
    showBranches: cfg.showBranches,
  }
  if (!Number.isFinite(box.minX)) box.add(0, 0)
  if (g.title) {
    const cx = box.minX + (box.maxX - box.minX) / 2
    const tw = textWidth(g.title, 18)
    out.title = { text: g.title, x: cx, y: -TITLE_TOP_MARGIN }
    box.rect(
      cx - tw / 2,
      -TITLE_TOP_MARGIN - ascent(18),
      tw,
      ascent(18) + descent(18),
    )
  }
  out.viewBox = {
    x: box.minX - DIAGRAM_PADDING,
    y: box.minY - DIAGRAM_PADDING,
    width: box.maxX - box.minX + 2 * DIAGRAM_PADDING,
    height: box.maxY - box.minY + 2 * DIAGRAM_PADDING,
  }
  return out
}
