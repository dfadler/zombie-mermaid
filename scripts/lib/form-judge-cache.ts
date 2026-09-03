/**
 * Pure logic for form-judge-weekly.yml's per-category verdict cache:
 * content-hashing, cache-hit/miss partitioning, and cache finalization.
 * Split out from scripts/form-judge-prepare.ts and
 * scripts/form-judge-finalize-cache.ts so it's testable without touching the
 * filesystem or CI.
 *
 * Cache entries are keyed by `title`, not `id` — `id` is derived from a
 * sample's *global* array index in samples-data.ts (see form-facts.ts) and
 * shifts whenever an unrelated sample is added/removed earlier in that
 * array, even though the sample's own content never changed.
 *
 * The content hash normalizes out the sample's `renderId` before hashing
 * `trimmedSvg`: mermaid embeds that id (derived from the same unstable
 * array-index `id`) into every retained element's `id`/`url(#...)`
 * attribute in the SVG it returns, so hashing the raw SVG would reintroduce
 * the exact array-index fragility the title-based cache key was chosen to
 * avoid — just through the hash *input* instead of the cache *key*.
 */

import { createHash } from 'node:crypto'
import type { IndexEntry, SampleFile } from '../form-facts.ts'

export interface CacheEntry {
  hash: string
  verdictLine: string
}

/** Keyed by sample `title`. */
export type CacheFile = Record<string, CacheEntry>

export interface CombinedSample {
  id: string
  title: string
  source: string
  trimmedSvg: string
  asciiText: string
}

export interface PrepareResult {
  /** Samples needing a fresh judgment this run — judgeable and a cache miss. */
  combinedData: CombinedSample[]
  /** Verdict lines already known without an LLM call — skips and cache hits. */
  seededResultLines: string[]
  /** title -> content hash, for every judgeable entry this run (hit or miss). */
  hashSideFile: Record<string, string>
}

/** Mirrors the `id.replace(/-/g, '_')` transform form-facts.ts passes into renderRealMermaidSvg. */
export function renderIdFor(id: string): string {
  return id.replace(/-/g, '_')
}

/**
 * Strips every occurrence of `renderId` out of `svg` before hashing, so two
 * renders of identical diagram content under different renderIds (e.g.
 * because an unrelated sample shifted this one's array index) normalize to
 * the same string.
 */
export function normalizeSvgForHash(svg: string, renderId: string): string {
  return renderId ? svg.split(renderId).join(' RENDER_ID ') : svg
}

export function computeContentHash(
  trimmedSvg: string,
  asciiText: string,
  renderId: string,
): string {
  const normalizedSvg = normalizeSvgForHash(trimmedSvg, renderId)
  return createHash('sha256')
    .update(normalizedSvg + ' ' + asciiText)
    .digest('hex')
}

/** Never throws — a missing or malformed cache file is treated as empty. */
export function parseCacheFile(raw: string | null): CacheFile {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CacheFile
    }
    return {}
  } catch {
    return {}
  }
}

/** Rewrites a verdict line's `id` field; returns the line unchanged if it's not valid JSON. */
export function rewriteVerdictId(line: string, newId: string): string {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>
    obj.id = newId
    return JSON.stringify(obj)
  } catch {
    return line
  }
}

/**
 * Partitions a category's index into: verdicts already known without
 * judging (non-judgeable entries resolved deterministically, cache hits
 * replayed with a rewritten id), and the reduced set of samples that
 * actually need a fresh LLM judgment this run.
 */
export function buildReducedSetAndSeededResults(
  index: IndexEntry[],
  factsById: Map<string, SampleFile>,
  cache: CacheFile,
): PrepareResult {
  const combinedData: CombinedSample[] = []
  const seededResultLines: string[] = []
  const hashSideFile: Record<string, string> = {}

  for (const entry of index) {
    if (!entry.judgeable) {
      seededResultLines.push(
        JSON.stringify({
          id: entry.id,
          title: entry.title,
          skipped: true,
          reason: entry.mermaidError ?? entry.asciiError ?? 'unknown',
        }),
      )
      continue
    }

    const facts = factsById.get(entry.id)
    if (!facts || facts.trimmedSvg === null || facts.asciiText === null) {
      // Index claims judgeable but the facts file disagrees — shouldn't
      // happen, but fail toward judging it fresh rather than skipping.
      continue
    }

    const renderId = renderIdFor(entry.id)
    const hash = computeContentHash(facts.trimmedSvg, facts.asciiText, renderId)
    hashSideFile[entry.title] = hash

    const cached = cache[entry.title]
    if (cached && cached.hash === hash) {
      seededResultLines.push(rewriteVerdictId(cached.verdictLine, entry.id))
      continue
    }

    combinedData.push({
      id: entry.id,
      title: entry.title,
      source: facts.source,
      trimmedSvg: facts.trimmedSvg,
      asciiText: facts.asciiText,
    })
  }

  return { combinedData, seededResultLines, hashSideFile }
}

/**
 * Derives the updated cache purely from what actually ended up in the
 * final results file. A sample that never got a verdict written (e.g. a
 * timeout mid-batch) is simply absent here, so it's correctly treated as
 * still needing judgment next run — never falsely marked done.
 */
export function finalizeCache(
  finalResultsLines: string[],
  hashSideFile: Record<string, string>,
): CacheFile {
  const cache: CacheFile = {}
  for (const line of finalResultsLines) {
    if (!line.trim()) continue
    let obj: { title?: unknown; skipped?: unknown }
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    if (obj.skipped) continue
    const title = obj.title
    if (typeof title !== 'string') continue
    const hash = hashSideFile[title]
    if (!hash) continue
    cache[title] = { hash, verdictLine: line }
  }
  return cache
}
