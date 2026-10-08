/**
 * Shared ELK instance singleton.
 *
 * Uses elk.bundled.js (pure synchronous JS, ~1.6 MB) for all environments.
 * `elkjs` is an OPTIONAL PEER dependency (#1370): this module never imports
 * it statically, so a bundler never inlines it. The constructor arrives via
 * `registerElk()`, or — under Node — is auto-loaded on first use.
 * The singleton is created lazily on first use and cached until
 * `registerElk()` is called again.
 *
 * ELK's FakeWorker wraps both postMessage and onmessage in setTimeout(0),
 * making the normal API fully async. To bypass this:
 *   1. During construction, we capture setTimeout(0) callbacks and flush them
 *      synchronously — this registers the layout algorithms immediately.
 *   2. For layout calls, we call dispatcher.saveDispatch() directly (skipping
 *      the FakeWorker's postMessage setTimeout) and intercept the result via
 *      rawWorker.onmessage (which the dispatcher calls synchronously).
 */

import type { ElkConstructor, ElkNode, LayoutCache } from '@zombie-mermaid/core'

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
 * runtime: just the internal `worker` handle. elkjs's public `ELK` type
 * deliberately doesn't expose worker internals, since those aren't a
 * supported API. We rely on them anyway (see file header).
 */
interface ElkBundledInternal {
  worker: { worker: RawFakeWorker }
}

function hasFakeWorker(x: unknown): x is ElkBundledInternal {
  const w = (x as { worker?: { worker?: unknown } } | null)?.worker?.worker
  return typeof w === 'object' && w !== null && 'dispatcher' in w
}

// Present only in the CJS build; undeclared under the ESM-only tsconfig `lib`.
declare const __filename: string | undefined

let ElkCtor: ElkConstructor | null = null
let elk: ElkBundledInternal | null = null
let rawWorker: RawFakeWorker | null = null

/** Thrown when a graph diagram renders and no `elkjs` constructor is available. */
export class ElkNotRegisteredError extends Error {
  constructor() {
    super(
      'zombie-mermaid: rendering a flowchart, state, class, ER or architecture ' +
        'diagram needs the optional peer dependency "elkjs". Install it ' +
        '(npm i elkjs) and call registerElk(ELK) once at startup with ' +
        "`import ELK from 'elkjs/lib/elk.bundled.js'`. Sequence, pie, xychart, " +
        'C4 and ASCII output do not need it.',
    )
    this.name = 'ElkNotRegisteredError'
  }
}

/**
 * Register the `elkjs` constructor used for flowchart, state, class, ER and
 * architecture layout. Call once before rendering, in browsers and bundlers:
 *
 *     import ELK from 'elkjs/lib/elk.bundled.js'
 *     registerElk(ELK)
 *
 * Under Node (and Bun) this is optional when `elkjs` is installed: it is
 * auto-loaded on first use. Calling it again swaps the constructor and drops
 * the cached instance.
 */
export function registerElk(ctor: ElkConstructor): void {
  ElkCtor = ctor
  elk = null
  rawWorker = null
}

/**
 * Best-effort synchronous load of `elkjs` under Node/Bun. Goes through
 * `createRequire` on a non-literal specifier so bundlers cannot statically
 * see (and inline) elkjs. Returns null in browsers or when elkjs is absent.
 */
function autoLoadElk(): ElkConstructor | null {
  const proc = (
    globalThis as {
      process?: {
        versions?: { node?: string }
        getBuiltinModule?: (id: string) => unknown
      }
    }
  ).process
  if (!proc?.versions?.node || typeof proc.getBuiltinModule !== 'function') {
    return null
  }
  const mod = proc.getBuiltinModule('node:module') as
    { createRequire(from: string): (id: string) => unknown } | undefined
  if (!mod) return null
  const specifier = ['elkjs', 'lib', 'elk.bundled.js'].join('/')
  // CJS build: rolldown rewrites `import.meta` to `{}`, so prefer `__filename`.
  // vite-node injects __filename into every module, so the plain-ESM
  // `import.meta.url` arm is unreachable under vitest; it is exercised by the
  // built ESM dist (checked manually on Node and Bun for #1370).
  /* v8 ignore next */
  const here = typeof __filename === 'string' ? __filename : import.meta.url
  const bases = [here, new URL(`file://${cwd(proc)}/`).href]
  for (const base of bases) {
    try {
      const loaded = mod.createRequire(base)(specifier) as
        ElkConstructor | { default?: ElkConstructor }
      const ctor = typeof loaded === 'function' ? loaded : loaded.default
      if (typeof ctor === 'function') return ctor
    } catch {
      // not resolvable from this base; try the next
    }
  }
  return null
}

function cwd(proc: object): string {
  const fn = (proc as { cwd?: () => string }).cwd
  return typeof fn === 'function' ? fn.call(proc) : '/'
}

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

  const Ctor = ElkCtor ?? (ElkCtor = autoLoadElk())
  if (!Ctor) throw new ElkNotRegisteredError()

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

  let instance: unknown
  try {
    instance = new Ctor()
  } finally {
    // Restore even if construction throws, so a bad registration cannot
    // leave a patched setTimeout/self behind.
    if (hadSelf) g.self = origSelf
    globalThis.setTimeout = origSetTimeout
  }
  if (!hasFakeWorker(instance)) {
    throw new Error(
      'zombie-mermaid: registerElk() needs the ELK class from ' +
        "'elkjs/lib/elk.bundled.js' (or 'elkjs/lib/main.js'), whose " +
        'synchronous worker this renderer drives directly.',
    )
  }
  elk = instance

  // Flush captured callbacks synchronously — registers layout algorithms
  pending.forEach((fn) => fn())

  // Cache the raw FakeWorker for elkLayoutSync()
  rawWorker = elk.worker.worker
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
