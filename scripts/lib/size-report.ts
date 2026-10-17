/**
 * Pure helpers behind `pnpm run size:report` (scripts/size-report.ts):
 * byte accounting, per-module attribution from sourcemaps, duplicate
 * detection and tarball classification. No I/O, so it is unit-tested.
 */
import { brotliCompressSync, gzipSync } from 'node:zlib'

export interface Sizes {
  raw: number
  gzip: number
  brotli: number
}

export interface SourceMap {
  sources: string[]
  mappings: string
}

export function measure(buf: Buffer | string): Sizes {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf
  return {
    raw: b.length,
    gzip: gzipSync(b).length,
    brotli: brotliCompressSync(b).length,
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Decode one line of base64-VLQ mappings into number arrays (one per segment). */
function decodeLine(line: string): number[][] {
  const segs: number[][] = []
  let cur: number[] = []
  let value = 0
  let shift = 0
  for (const ch of line) {
    if (ch === ',') {
      segs.push(cur)
      cur = []
      continue
    }
    const digit = B64.indexOf(ch)
    value += (digit & 31) << shift
    if (digit & 32) {
      shift += 5
    } else {
      cur.push(value & 1 ? -(value >> 1) : value >> 1)
      value = 0
      shift = 0
    }
  }
  segs.push(cur)
  return segs.filter((s) => s.length > 0)
}

export const UNMAPPED = '(unmapped)'

/**
 * Attribute every generated character of `code` to a source file: each
 * mapping segment owns the text up to the next segment (or end of line).
 * Columns are UTF-16 code units, so this is chars, not bytes (exact for
 * the ASCII-dominated bundles measured here). Returns source -> chars.
 */
export function attribute(code: string, map: SourceMap): Map<string, number> {
  const out = new Map<string, number>()
  const add = (k: string, n: number) => out.set(k, (out.get(k) ?? 0) + n)
  const mapLines = map.mappings.split(';')
  let srcIdx = 0
  code.split('\n').forEach((text, i) => {
    const segs = decodeLine(mapLines[i] ?? '')
    if (segs.length === 0) return add(UNMAPPED, text.length + 1)
    let col = 0
    const starts: { col: number; src: string }[] = []
    for (const s of segs) {
      col += s[0] ?? 0
      if (s.length >= 4) srcIdx += s[1] ?? 0
      starts.push({
        col,
        src: s.length >= 4 ? (map.sources[srcIdx] ?? UNMAPPED) : UNMAPPED,
      })
    }
    if (starts[0] && starts[0].col > 0) add(UNMAPPED, starts[0].col)
    starts.forEach((s, j) => {
      const end = starts[j + 1]?.col ?? text.length + 1
      add(s.src, Math.max(0, end - s.col))
    })
  })
  return out
}

/**
 * Normalize a sourcemap `sources` entry to a stable label: repo-relative path,
 * or `node_modules/<pkg>` so a dependency's files roll up into one row.
 */
export function moduleLabel(
  mapDir: string,
  source: string,
  repoRoot: string,
): string {
  if (source === UNMAPPED) return source
  const parts: string[] = mapDir.split('/')
  for (const seg of source.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  const abs = parts.join('/')
  const nm = abs.lastIndexOf('/node_modules/')
  if (nm >= 0) {
    const rest = abs.slice(nm + '/node_modules/'.length).split('/')
    const name = rest[0]?.startsWith('@') ? rest.slice(0, 2).join('/') : rest[0]
    return `node_modules/${name}`
  }
  const root = repoRoot.endsWith('/') ? repoRoot : `${repoRoot}/`
  return abs.startsWith(root) ? abs.slice(root.length) : abs
}

export function topN<T extends { bytes: number }>(rows: T[], n: number): T[] {
  return [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, n)
}

export interface Duplicate {
  module: string
  files: string[]
  bytes: number
}

/**
 * Modules that appear in more than one output file. `bytes` is the extra
 * weight: the sum over all copies except the largest.
 */
export function findDuplicates(
  perFile: Record<string, Map<string, number>>,
): Duplicate[] {
  const byModule = new Map<string, { file: string; n: number }[]>()
  for (const [file, mods] of Object.entries(perFile))
    for (const [mod, n] of mods) {
      if (mod === UNMAPPED) continue
      byModule.set(mod, [...(byModule.get(mod) ?? []), { file, n }])
    }
  const dups: Duplicate[] = []
  for (const [module, copies] of byModule) {
    if (copies.length < 2) continue
    const total = copies.reduce((s, c) => s + c.n, 0)
    const max = Math.max(...copies.map((c) => c.n))
    dups.push({ module, files: copies.map((c) => c.file), bytes: total - max })
  }
  return dups.sort((a, b) => b.bytes - a.bytes)
}

export type TarballKind =
  'esm' | 'cjs' | 'sourcemap' | 'dts' | 'docs' | 'manifest' | 'other'

export function classify(path: string): TarballKind {
  if (/\.map$/.test(path)) return 'sourcemap'
  if (/\.d\.c?ts$/.test(path)) return 'dts'
  if (/\.cjs$/.test(path)) return 'cjs'
  if (/\.m?js$/.test(path)) return 'esm'
  if (path === 'package.json') return 'manifest'
  if (/\.md$|^LICENSE/.test(path)) return 'docs'
  return 'other'
}

/** Sum an `npm pack --json` file list by kind. */
export function tarballByKind(
  files: { path: string; size: number }[],
): Record<TarballKind, number> {
  const out: Record<TarballKind, number> = {
    esm: 0,
    cjs: 0,
    sourcemap: 0,
    dts: 0,
    docs: 0,
    manifest: 0,
    other: 0,
  }
  for (const f of files) out[classify(f.path)] += f.size
  return out
}

export function table(headers: string[], rows: (string | number)[][]): string {
  const line = (r: (string | number)[]) => `| ${r.join(' | ')} |`
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map(line),
  ].join('\n')
}
