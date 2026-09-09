/**
 * Shared ELK instance singleton.
 *
 * Uses elk.bundled.js (pure synchronous JS, ~1.6 MB) for all environments.
 * The singleton is created lazily on first use and cached forever.
 *
 * ELK's FakeWorker wraps both postMessage and onmessage in setTimeout(0),
 * making the normal API fully async. To bypass this:
 *   1. During construction, we capture setTimeout(0) callbacks and flush them
 *      synchronously — this registers the layout algorithms immediately.
 *   2. For layout calls, we call dispatcher.saveDispatch() directly (skipping
 *      the FakeWorker's postMessage setTimeout) and intercept the result via
 *      rawWorker.onmessage (which the dispatcher calls synchronously).
 */

import type { ELK, ElkNode } from 'elkjs'
import ELKBundled from 'elkjs/lib/elk.bundled.js'
import type { LayoutCache } from '@zombie-mermaid/core'

/** The message envelope ELK's FakeWorker passes to `dispatcher.saveDispatch()`
 * to request a layout run. Mirrors the shape elk-worker.min.js expects on
 * `data` for a `cmd: 'layout'` request — not part of elkjs's public types. */
interface ElkWorkerRequest {
  id: number
  cmd: 'layout'
  graph: ElkNode
}

/** The message envelope ELK's dispatcher passes back to `onmessage` once a
 * layout run completes. Mirrors elk-worker.min.js's response shape for a
 * `cmd: 'layout'` request — not part of elkjs's public types. */
interface ElkWorkerResponse {
  id: number
  data?: ElkNode
  error?: unknown
}

interface RawFakeWorker {
  postMessage(msg: unknown): void
  onmessage: ((e: { data: ElkWorkerResponse }) => void) | null
  dispatcher: {
    saveDispatch(msg: { data: ElkWorkerRequest }): void
  }
}

/**
 * The shape of elkjs's bundled `ELK` instance that actually exists at
 * runtime, including the internal `worker` handle. elkjs's public `ELK`
 * type (from `elk-api.d.ts`) only declares `layout`/`knownLayout*`/
 * `terminateWorker` — it deliberately doesn't expose worker internals,
 * since those aren't a supported API. We rely on them anyway (see file
 * header), so this extends the public type with the internal piece we
 * touch instead of casting through `unknown`.
 */
interface ElkBundledInternal extends ELK {
  worker: { worker: RawFakeWorker }
}

let elk: ELK | null = null
let rawWorker: RawFakeWorker | null = null

// ============================================================================
// Opt-in layout cache
// ============================================================================

/**
 * `LayoutCache`'s shape lives in `@zombie-mermaid/core`'s `types.ts`
 * because `RenderOptions.layoutCache` references it and `core` must not
 * type-import this package (zombie-mermaid#625). Re-exported here so this
 * module stays the single import site for everything layout-cache-related,
 * exactly as before the split.
 */
export type { LayoutCache }

/**
 * Concrete shape of a `LayoutCache`, restated locally.
 *
 * `core`'s `LayoutCache` interface marks `map`/`maxSize` `@internal`
 * (see the comment on that interface in packages/core/src/types.ts), so
 * api-extractor strips them from `@zombie-mermaid/core`'s *published*
 * `dist/index.d.ts` — deliberately, so they stay invisible to
 * `@zombie-mermaid/core` consumers and to `zombie-mermaid`'s own public
 * types (which re-export `LayoutCache` from this package). As of #769,
 * `@zombie-mermaid/core` is a real, independently-built dependency of this
 * package rather than bundled source, so this module now resolves
 * `LayoutCache` through that same trimmed public declaration too — same as
 * any other consumer. This module is the one place, in or out of `core`,
 * that actually builds and mutates those fields (`createLayoutCache()`
 * below; the cache read/evict logic in `elkLayoutSync()`), so it restates
 * the concrete shape here — kept in sync by hand with `core`'s source of
 * truth — rather than either widening `core`'s public surface or fighting
 * api-extractor's trimming in the build config to get it back.
 */
interface LayoutCacheShape {
  map: Map<string, ElkNode>
  maxSize: number
}

const DEFAULT_LAYOUT_CACHE_SIZE = 20

/**
 * Create a new opt-in layout cache with a bounded size (default 20
 * entries). Once full, the least-recently-used entry is evicted to make
 * room for a new one.
 *
 * Pass the result to `elkLayoutSync()` directly, or via
 * `RenderOptions.layoutCache` (threaded through by `layoutGraphSync()`,
 * `layoutClassDiagramSync()`, and `layoutErDiagramSync()`) to memoize
 * layout across repeated renders of the same diagram + options.
 */
export function createLayoutCache(
  maxSize: number = DEFAULT_LAYOUT_CACHE_SIZE,
): LayoutCache {
  if (!Number.isInteger(maxSize) || maxSize < 1) {
    throw new Error(
      `createLayoutCache: maxSize must be a positive integer, got ${maxSize}`,
    )
  }
  // Typed as the concrete shape first (see `LayoutCacheShape` above), then
  // returned as the public, trimmed `LayoutCache` — a plain widening
  // assignment, not a cast.
  const cache: LayoutCacheShape = { map: new Map(), maxSize }
  return cache
}

/**
 * Deterministically serialize a value for use as a cache key, sorting
 * object keys recursively so two structurally-equal ELK input graphs
 * always produce an identical string regardless of property-insertion
 * order. Plain `JSON.stringify()` does not guarantee that — and this
 * function is the only thing standing between a cache hit and returning
 * some *other* diagram's layout, so it can't be allowed to drift with
 * insertion order.
 *
 * The ELK input graph built by `mermaidToElk()` is plain JSON (arrays,
 * plain objects, strings, numbers, booleans — the shape ELK's own JSON
 * schema requires) with every render option that affects layout already
 * baked in (direction, spacing, per-subgraph overrides, etc.), so
 * serializing the graph itself is a complete and correct cache key: equal
 * serialized input always means equal ELK output, since ELK layout is a
 * pure function of its input graph.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`,
    )
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Ensure the ELK singleton exists.
 *
 * Patches setTimeout during construction to capture and synchronously flush
 * the algorithm registration callback that ELK queues via setTimeout(0).
 * Without this, layout calls fail with "algorithm not found" until the
 * next macrotask.
 */
function ensureElk(): RawFakeWorker {
  if (elk && rawWorker) return rawWorker

  // Capture setTimeout(0) callbacks queued during ELK construction
  const pending: (() => void)[] = []
  const origSetTimeout = globalThis.setTimeout
  // @ts-expect-error — simplified signature for our interception, not
  // assignment-compatible with the full `typeof setTimeout` overload set
  globalThis.setTimeout = (fn: () => void, delay?: number) => {
    if (delay === 0) {
      pending.push(fn)
      return 0
    }
    return origSetTimeout(fn, delay)
  }

  // Bun defines `self` (= globalThis) but not `document`, which tricks
  // elk-worker.min.js into taking the Web Worker branch instead of the
  // CJS branch. Temporarily hide `self` so it exports {Worker: FakeWorker}.
  // `lib` in tsconfig.json is `["ESNext"]` (no `dom`), so `self`/`document`
  // aren't ambiently declared on `globalThis` — narrow to just the two
  // properties this probe touches instead of a blanket `Record`.
  const g = globalThis as { self?: unknown; document?: unknown }
  const hadSelf = 'self' in g
  const origSelf = g.self
  if (hadSelf && typeof g.document === 'undefined') {
    delete g.self
  }

  elk = new ELKBundled()
  if (!elk) {
    // Unreachable — `new ELKBundled()` always returns an instance — but
    // makes the invariant explicit rather than letting the cast below
    // silently paper over a null `elk` if that ever stopped being true.
    throw new Error('ELKBundled construction unexpectedly produced no instance')
  }

  // Restore self
  if (hadSelf) g.self = origSelf

  // Restore setTimeout immediately
  globalThis.setTimeout = origSetTimeout

  // Flush captured callbacks synchronously — registers layout algorithms
  pending.forEach((fn) => fn())

  // Cache the raw FakeWorker for elkLayoutSync()
  rawWorker = (elk as ElkBundledInternal).worker.worker
  return rawWorker
}

/**
 * Run ELK layout synchronously.
 *
 * Bypasses BOTH of ELK's setTimeout(0) wrappers:
 *   - FakeWorker.postMessage wraps dispatch in setTimeout(0) — bypassed by
 *     calling dispatcher.saveDispatch() directly
 *   - PromisedWorker.onmessage wraps receive in setTimeout(0) — bypassed by
 *     replacing rawWorker.onmessage with a direct interceptor
 *
 * @param cache - Optional opt-in layout cache (see `createLayoutCache()`).
 *   When provided, a cache hit returns the previous result without running
 *   ELK layout again. Omitted/undefined preserves the original
 *   always-recompute behavior exactly.
 */
export function elkLayoutSync(graph: ElkNode, cache?: LayoutCache): ElkNode {
  // `cache`, when provided, is always an object this module itself built
  // via `createLayoutCache()` above — never anything constructed outside
  // this package. Restated as the concrete shape here (see
  // `LayoutCacheShape`'s doc comment) since the public `LayoutCache` type
  // this parameter is declared with intentionally hides `map`/`maxSize`.
  const internalCache = cache as LayoutCacheShape | undefined
  const cacheKey = internalCache ? stableStringify(graph) : undefined
  if (internalCache && cacheKey !== undefined) {
    const cached = internalCache.map.get(cacheKey)
    if (cached) {
      // Mark as most-recently-used: Map iteration order follows insertion
      // order, so a delete+re-set moves this entry to the end — which is
      // what the LRU eviction below relies on to find the *least*
      // recently used entry (the current first key).
      internalCache.map.delete(cacheKey)
      internalCache.map.set(cacheKey, cached)
      return cached
    }
  }

  const worker = ensureElk()

  let result: ElkNode | undefined
  let error: unknown

  // Replace onmessage to intercept the result synchronously
  // (the dispatcher calls this directly, without setTimeout)
  const origOnmessage = worker.onmessage
  worker.onmessage = (answer: { data: ElkWorkerResponse }) => {
    if (answer.data.error) {
      error = answer.data.error
    } else {
      result = answer.data.data
    }
  }

  // Call dispatcher.saveDispatch directly — bypasses FakeWorker.postMessage's
  // setTimeout(0) wrapper. The dispatcher processes the layout synchronously
  // and calls rawWorker.onmessage with the result.
  worker.dispatcher.saveDispatch({
    data: { id: 0, cmd: 'layout', graph },
  })

  // Restore original handler
  worker.onmessage = origOnmessage

  if (error) throw error
  if (!result) throw new Error('ELK layout did not return synchronously')

  if (internalCache && cacheKey !== undefined) {
    internalCache.map.set(cacheKey, result)
    if (internalCache.map.size > internalCache.maxSize) {
      // Map iteration order is insertion order, so the first key is the
      // least recently used (see the recency bump on hit, above).
      const oldestKey = internalCache.map.keys().next().value
      if (oldestKey !== undefined) internalCache.map.delete(oldestKey)
    }
  }

  return result
}
