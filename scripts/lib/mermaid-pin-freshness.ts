/**
 * Is the pinned `mermaid` devDependency still the mermaid users see?
 *
 * `scripts/lib/real-mermaid.ts` and `pnpm run layout:oracle` treat the pin as
 * ground truth. mermaid.live and GitHub follow current mermaid, so a pin that
 * falls behind a minor or major release silently turns "matches mermaid" into
 * "matches an old mermaid" (#1699: 11.17.2 flipped uncrossed subgraphs, 12.x
 * and GitHub do not). Run directly (`tsx scripts/lib/mermaid-pin-freshness.ts`)
 * to print the result; exits 0 either way, since a stale pin is a prompt to
 * re-check parity claims, not a build failure.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export interface PinFreshness {
  pinned: string
  latest: string | undefined
  /** True when `latest` is a newer major or minor than `pinned`. */
  stale: boolean
  message: string
}

/** Whether `latest` is a newer major or minor than `pinned` (patches don't count). */
export function isBehind(pinned: string, latest: string): boolean {
  const [pMaj = 0, pMin = 0] = pinned.split('.').map(Number)
  const [lMaj = 0, lMin = 0] = latest.split('.').map(Number)
  return lMaj > pMaj || (lMaj === pMaj && lMin > pMin)
}

/** The `mermaid` devDependency version, e.g. `12.2.0`. */
export function pinnedMermaidVersion(): string {
  return (
    JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { devDependencies: Record<string, string> }
  ).devDependencies['mermaid']!.replace(/^[^\d]*/, '')
}

export function pinFreshness(
  latestOverride?: string,
  pinnedOverride?: string,
): PinFreshness {
  const pinned = pinnedOverride ?? pinnedMermaidVersion()
  let latest = latestOverride
  if (latest === undefined) {
    try {
      latest = execFileSync('npm', ['view', 'mermaid', 'version'], {
        encoding: 'utf8',
        timeout: 15_000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      latest = undefined
    }
  }
  if (!latest) {
    return {
      pinned,
      latest,
      stale: false,
      message: `mermaid pinned at ${pinned}; npm latest unknown (offline?)`,
    }
  }
  const stale = isBehind(pinned, latest)
  return {
    pinned,
    latest,
    stale,
    message: stale
      ? `mermaid pin ${pinned} is behind npm latest ${latest}. mermaid.live and GitHub follow current mermaid: check a parity claim there before building on the oracle (CLAUDE.md, "Parity with mermaid.js").`
      : `mermaid pinned at ${pinned} (npm latest ${latest})`,
  }
}

/**
 * Last observed mermaid version per user-facing surface (2026-10-22, #2184;
 * method in docs/known-differences.md). Re-check by hand when the pin moves:
 * the page cannot be queried from a script.
 */
export const SURFACE_VERSIONS = {
  'GitHub ```mermaid blocks': '12.1.0 (bundle fingerprint)',
  'mermaid.live': '12.2.0 (version label)',
} as const

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = pinFreshness()
  const seen = Object.entries(SURFACE_VERSIONS).map(([k, v]) => `${k} ${v}`)
  console.log(
    `${r.stale ? 'STALE   ' : 'ok      '} ${r.message}\n         last checked 2026-10-22: ${seen.join('; ')}`,
  )
}
