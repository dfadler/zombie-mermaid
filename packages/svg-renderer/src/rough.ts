// ============================================================================
// rough.js subset
//
// A dependency-free port of the parts of rough.js 4.6.6 (MIT, Preet Shihn;
// the version mermaid@12.3.0 bundles) that a `look: handDrawn` ishikawa needs:
// the seeded generator, `line`, closed polygons/rectangles, and SVG paths made
// of absolute `M` / `L` / `Q` / `Z`, outlined or solid-filled. The jitter is
// byte-for-byte rough.js's for the same seed.
//
// Not ported: hachure and other pattern fills (they need rough.js's path
// sampling and hachure-fill code), arcs, ellipses and curves. Callers that need
// a hachure fill leave it out.
// ============================================================================

interface Opts {
  roughness: number
  seed: number
  /** Lazily created, shared by every shape drawn with this options object (rough.js's `randomizer`). */
  rand?: Rand
  disableMultiStroke: boolean
}

interface Rand {
  seed: number
}

type Op = readonly ['M' | 'L' | 'C', ...number[]]

const MAX_OFFSET = 2
const BOWING = 1

// rough.js: a seed of 0 means `Math.random()`. Rendering must be deterministic
// (the same input twice gives the same SVG), so 0 maps to a fixed seed instead.
const next = (o: Opts): number => {
  o.rand ??= { seed: o.seed || 1 }
  o.rand.seed = Math.imul(48271, o.rand.seed)
  return ((2 ** 31 - 1) & o.rand.seed) / 2 ** 31
}

const offset = (min: number, max: number, o: Opts, gain = 1): number =>
  o.roughness * gain * (next(o) * (max - min) + min)
const offsetOpt = (x: number, o: Opts, gain = 1): number =>
  offset(-x, x, o, gain)

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  o: Opts,
  overlay: boolean,
): Op[] {
  const lengthSq = (x1 - x2) ** 2 + (y1 - y2) ** 2
  const length = Math.sqrt(lengthSq)
  const gain =
    length < 200
      ? 1
      : length > 500
        ? 0.4
        : -0.0016668 * length + 1.233334
  let off = MAX_OFFSET
  if (off * off * 100 > lengthSq) off = length / 10
  const half = off / 2
  const diverge = 0.2 + next(o) * 0.2
  let midX = (BOWING * MAX_OFFSET * (y2 - y1)) / 200
  let midY = (BOWING * MAX_OFFSET * (x1 - x2)) / 200
  midX = offsetOpt(midX, o, gain)
  midY = offsetOpt(midY, o, gain)
  const rnd = (): number => offsetOpt(overlay ? half : off, o, gain)
  // Evaluation order matters: each call draws from the seeded generator.
  const m = ['M', x1 + rnd(), y1 + rnd()] as const
  const c = [
    'C',
    midX + x1 + (x2 - x1) * diverge + rnd(),
    midY + y1 + (y2 - y1) * diverge + rnd(),
    midX + x1 + 2 * (x2 - x1) * diverge + rnd(),
    midY + y1 + 2 * (y2 - y1) * diverge + rnd(),
    x2 + rnd(),
    y2 + rnd(),
  ] as const
  return [m, c]
}

function doubleLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  o: Opts,
): Op[] {
  const a = line(x1, y1, x2, y2, o, false)
  return o.disableMultiStroke ? a : [...a, ...line(x1, y1, x2, y2, o, true)]
}

function bezierTo(
  [x1, y1, x2, y2, x, y]: [number, number, number, number, number, number],
  cur: [number, number],
  o: Opts,
): Op[] {
  const ros = [MAX_OFFSET, MAX_OFFSET + 0.3] as const
  const ops: Op[] = []
  for (let i = 0; i < (o.disableMultiStroke ? 1 : 2); i++) {
    ops.push(
      i === 0
        ? ['M', cur[0], cur[1]]
        : ['M', cur[0] + offsetOpt(ros[0], o), cur[1] + offsetOpt(ros[0], o)],
    )
    const r = ros[i]!
    const f = [x + offsetOpt(r, o), y + offsetOpt(r, o)]
    ops.push([
      'C',
      x1 + offsetOpt(r, o),
      y1 + offsetOpt(r, o),
      x2 + offsetOpt(r, o),
      y2 + offsetOpt(r, o),
      f[0]!,
      f[1]!,
    ])
  }
  return ops
}

/** Segments of an absolute `M`/`L`/`Q`/`Z` path; `Q` becomes `C` as path-data-parser's `normalize` does. */
function segments(d: string): { key: string; data: number[] }[] {
  const out: { key: string; data: number[] }[] = []
  let cur: [number, number] = [0, 0]
  let first: [number, number] = [0, 0]
  for (const part of d.match(/[MLQZ][^MLQZ]*/g) ?? []) {
    const key = part[0]!
    const n = part
      .slice(1)
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (key === 'Q') {
      const [qx, qy, x, y] = n as [number, number, number, number]
      out.push({
        key: 'C',
        data: [
          cur[0] + (2 * (qx - cur[0])) / 3,
          cur[1] + (2 * (qy - cur[1])) / 3,
          x + (2 * (qx - x)) / 3,
          y + (2 * (qy - y)) / 3,
          x,
          y,
        ],
      })
      cur = [x, y]
    } else if (key === 'Z') {
      out.push({ key, data: [] })
      cur = first
    } else {
      out.push({ key, data: n })
      cur = [n[0]!, n[1]!]
      if (key === 'M') first = cur
    }
  }
  return out
}

function pathOps(d: string, o: Opts): Op[] {
  const ops: Op[] = []
  let cur: [number, number] = [0, 0]
  let first: [number, number] = [0, 0]
  for (const { key, data } of segments(d)) {
    if (key === 'M') {
      cur = first = [data[0]!, data[1]!]
    } else if (key === 'L') {
      ops.push(...doubleLine(cur[0], cur[1], data[0]!, data[1]!, o))
      cur = [data[0]!, data[1]!]
    } else if (key === 'C') {
      ops.push(...bezierTo(data as Parameters<typeof bezierTo>[0], cur, o))
      cur = [data[4]!, data[5]!]
    } else {
      ops.push(...doubleLine(cur[0], cur[1], first[0], first[1], o))
      cur = first
    }
  }
  return ops
}

const toD = (ops: readonly Op[]): string =>
  ops
    .map(([k, ...n]) =>
      k === 'C'
        ? `C${n[0]} ${n[1]}, ${n[2]} ${n[3]}, ${n[4]} ${n[5]}`
        : `${k}${n[0]} ${n[1]}`,
    )
    .join(' ')

const opts = (roughness: number, seed: number): Opts => ({
  roughness,
  seed,
  disableMultiStroke: false,
})

/** `rc.line(...)`: the path `d` of one rough stroke. */
export const roughLine = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  roughness: number,
  seed: number,
): string => toD(doubleLine(x1, y1, x2, y2, opts(roughness, seed)))

/** `rc.path(d, { stroke })` outline of an absolute `M`/`L`/`Q`/`Z` path (no fill). */
export const roughPathOutline = (
  d: string,
  roughness: number,
  seed: number,
): string => toD(pathOps(d, opts(roughness, seed)))

/**
 * `rc.path(d, { fillStyle: 'solid', fill, stroke })` of a single closed
 * subpath: the solid fill shape and the outline, in rough.js's draw order (the
 * outline consumes the generator first).
 */
export function roughPathSolid(
  d: string,
  roughness: number,
  seed: number,
): { fill: string; outline: string } {
  const o = opts(roughness, seed)
  const outline = toD(pathOps(d, o))
  const fillOps = pathOps(d, {
    ...o,
    disableMultiStroke: true,
    roughness: roughness + 0.8,
  })
  // rough.js `_mergedShape`: drop every `move` but the first.
  return {
    outline,
    fill: toD(fillOps.filter((op, i) => i === 0 || op[0] !== 'M')),
  }
}

/** `rc.rectangle(...)` outline (a closed four-point polygon; `fill` unsupported). */
export function roughRectOutline(
  x: number,
  y: number,
  w: number,
  h: number,
  roughness: number,
  seed: number,
): string {
  const o = opts(roughness, seed)
  const p = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ] as const
  const ops: Op[] = []
  for (let i = 0; i < 4; i++) {
    const a = p[i]!
    const b = p[(i + 1) % 4]!
    ops.push(...doubleLine(a[0], a[1], b[0], b[1], o))
  }
  return toD(ops)
}
