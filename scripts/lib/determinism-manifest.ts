// Pure manifest builder for scripts/determinism-manifest.ts (#1861).
import { createHash } from 'node:crypto'

export const hash = (s: string): string =>
  createHash('sha256').update(s).digest('hex').slice(0, 16)

/** Run a render; a throw becomes `THROW:<message>` so it hashes (and diffs) like output. */
export const attempt = (fn: () => string): string => {
  try {
    return fn()
  } catch (e) {
    return `THROW:${e instanceof Error ? e.message : String(e)}`
  }
}

/** One `<hash> <kind> <index> <title>` line per render, svg then ascii per sample. */
export function manifestLines(
  samples: ReadonlyArray<{ title: string; source: string }>,
  renderSvg: (source: string) => string,
  renderAscii: (source: string) => string,
): string[] {
  return samples.flatMap((s, i) => {
    const title = s.title.replace(/\s+/g, ' ')
    return [
      `${hash(attempt(() => renderSvg(s.source)))} svg ${i} ${title}`,
      `${hash(attempt(() => renderAscii(s.source)))} ascii ${i} ${title}`,
    ]
  })
}
