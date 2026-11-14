/**
 * Seeded diagram generator + invariant checker for the ELK-registered ASCII
 * fuzz (#3146). Plain mulberry32, no fast-check: a failure prints the source
 * and replays from `(seed, run)`.
 */

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(r: Rng, xs: readonly T[]): T =>
  xs[Math.floor(r() * xs.length)]!
const int = (r: Rng, lo: number, hi: number): number =>
  lo + Math.floor(r() * (hi - lo + 1))

const DIRS = ['TD', 'LR', 'RL', 'BT'] as const
const SHAPES: ReadonlyArray<readonly [string, string]> = [
  ['[', ']'],
  ['(', ')'],
  ['{', '}'],
  ['([', '])'],
  ['((', '))'],
  ['[[', ']]'],
  ['[(', ')]'],
  ['{{', '}}'],
  ['[/', '/]'],
  ['>', ']'],
]
const OPS = ['-->', '---', '-.->', '==>'] as const
const WORDS = [
  'a',
  'Bb',
  'ccc',
  'Start',
  'End',
  'Check',
  'x1',
  'Long label',
  'Z',
]

const word = (r: Rng): string => {
  const w = pick(r, WORDS)
  return r() < 0.3 ? `${w}${int(r, 0, 99)}` : w
}

export interface Fuzzed {
  src: string
  /** Texts that must appear in the output. */
  labels: string[]
}

function flowchart(r: Rng): Fuzzed {
  const n = int(r, 2, 14)
  const lines = [`flowchart ${pick(r, DIRS)}`]
  const labels: string[] = []
  const decl: string[] = []
  for (let i = 0; i < n; i++) {
    const [o, c] = pick(r, SHAPES)
    const t = word(r)
    labels.push(t)
    decl.push(`n${i}${o}"${t}"${c}`)
  }
  // Subgraphs: slices of the node list, optionally nested.
  const sgCount = r() < 0.4 ? int(r, 1, 3) : 0
  const used = new Set<number>()
  const body: string[] = []
  for (let s = 0; s < sgCount; s++) {
    const free = [...Array(n).keys()].filter((i) => !used.has(i))
    if (free.length < 1) break
    const members = free.slice(0, int(r, 1, Math.min(4, free.length)))
    members.forEach((m) => used.add(m))
    const title = `G${s}`
    labels.push(title)
    const inner = members.map((m) => `    ${decl[m]}`)
    if (r() < 0.3 && s + 1 < sgCount)
      inner.push(`    direction ${pick(r, DIRS)}`)
    body.push(`  subgraph ${title}["${title}"]`, ...inner, '  end')
  }
  for (let i = 0; i < n; i++) if (!used.has(i)) body.push(`  ${decl[i]}`)
  lines.push(...body)
  const e = int(r, 0, n + 4)
  for (let k = 0; k < e; k++) {
    const a = int(r, 0, n - 1)
    const b = r() < 0.12 ? a : int(r, 0, n - 1)
    const op = pick(r, OPS)
    const edge = r() < 0.3 ? `${op}|${word(r)}|` : op
    lines.push(`  n${a} ${edge} n${b}`)
    if (r() < 0.1) lines.push(`  n${a} ${edge} n${b}`)
  }
  return { src: lines.join('\n'), labels }
}

function state(r: Rng): Fuzzed {
  const n = int(r, 2, 10)
  const lines = ['stateDiagram-v2']
  if (r() < 0.5) lines.push(`  direction ${pick(r, DIRS)}`)
  const labels = [...Array(n).keys()].map((i) => `S${i}x`)
  const comp = r() < 0.4 && n >= 3
  const inComp = comp ? Math.min(n - 1, int(r, 1, 3)) : 0
  lines.push(
    ...labels.slice(inComp).map((l, i) => `  state "${l}" as t${i + inComp}`),
  )
  if (comp) {
    lines.push('  state C {')
    labels
      .slice(0, inComp)
      .forEach((l, i) => lines.push(`    state "${l}" as t${i}`))
    for (let i = 0; i + 1 < inComp; i++) lines.push(`    t${i} --> t${i + 1}`)
    if (r() < 0.5) lines.push('    [*] --> t0')
    lines.push('  }')
    labels.push('C')
  }
  const e = int(r, 1, n + 3)
  for (let k = 0; k < e; k++) {
    const a = int(r, 0, n - 1)
    const b = r() < 0.1 ? a : int(r, 0, n - 1)
    const t = r() < 0.3 ? ` : ${word(r)}` : ''
    lines.push(`  t${a} --> t${b}${t}`)
  }
  if (r() < 0.5) lines.push(`  [*] --> t${int(r, 0, n - 1)}`)
  if (r() < 0.5) lines.push(`  t${int(r, 0, n - 1)} --> [*]`)
  return { src: lines.join('\n'), labels }
}

function classDiagram(r: Rng): Fuzzed {
  const n = int(r, 2, 8)
  const lines = ['classDiagram']
  if (r() < 0.5) lines.push(`  direction ${pick(r, DIRS)}`)
  const labels = [...Array(n).keys()].map((i) => `Cls${i}`)
  labels.forEach((c) => {
    lines.push(`  class ${c}`)
    if (r() < 0.5) lines.push(`  ${c} : +field${int(r, 0, 9)}`)
  })
  const rel = ['<|--', '*--', 'o--', '-->', '--', '..>', '..|>', '..']
  const e = int(r, 1, n + 3)
  for (let k = 0; k < e; k++) {
    const a = int(r, 0, n - 1)
    const b = r() < 0.1 ? a : int(r, 0, n - 1)
    const t = r() < 0.3 ? ` : ${pick(r, ['uses', 'has', 'owns'])}` : ''
    lines.push(`  ${labels[a]} ${pick(r, rel)} ${labels[b]}${t}`)
  }
  return { src: lines.join('\n'), labels }
}

function er(r: Rng): Fuzzed {
  const n = int(r, 2, 8)
  const labels = [...Array(n).keys()].map((i) => `ENT${i}`)
  const lines = ['erDiagram']
  const card = ['||--o{', '||--||', '}o--o{', '|o--|{', '}|..|{']
  const e = int(r, 1, n + 3)
  for (let k = 0; k < e; k++) {
    const a = int(r, 0, n - 1)
    const b = r() < 0.1 ? a : int(r, 0, n - 1)
    lines.push(`  ${labels[a]} ${pick(r, card)} ${labels[b]} : rel${k}`)
  }
  labels.forEach((l) => {
    if (r() < 0.4)
      lines.push(`  ${l} {`, '    string name', '    int id', '  }')
  })
  const src = lines.join('\n')
  // An entity no relationship or block mentions is not in the diagram.
  return { src, labels: labels.filter((l) => src.includes(l)) }
}

export function generate(r: Rng): Fuzzed {
  const x = r()
  if (x < 0.55) return flowchart(r)
  if (x < 0.75) return state(r)
  if (x < 0.9) return classDiagram(r)
  return er(r)
}

/** Why `out` is wrong for `f`, or undefined when it holds every invariant. */
export function violation(
  f: Fuzzed,
  out: string,
  checkLabels = true,
): string | undefined {
  const lines = out.split('\n')
  const widths = new Set(lines.map((l) => [...l].length))
  if (widths.size !== 1)
    return `not rectangular (widths ${[...widths].join(',')})`
  if (/NaN|undefined|Infinity|\[object/.test(out)) return 'NaN/undefined text'
  for (const l of checkLabels ? f.labels : []) {
    if (!out.includes(l)) return `label ${JSON.stringify(l)} missing`
  }
  return undefined
}
