/**
 * Which After text each committed fork-fixes `-after.png` was captured from
 * (#2916). `scripts/capture-fork-fixes-terminal.ts` records a hash per entry;
 * `__tests__/fork-fixes-screenshot-hashes.test.ts` fails when the current
 * render no longer matches, i.e. a snapshot changed without a re-capture.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export const HASHES_PATH = new URL(
  '../fork-fixes-screenshot-hashes.json',
  import.meta.url,
)

export const hashAfterText = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, 16)

export const readHashes = (path: URL = HASHES_PATH): Record<string, string> =>
  existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>)
    : {}

/** Records `id`'s hash, keeping keys sorted so the file diffs cleanly. */
export function recordHash(
  id: string,
  text: string,
  path: URL = HASHES_PATH,
): void {
  const all = { ...readHashes(path), [id]: hashAfterText(text) }
  const sorted = Object.fromEntries(
    Object.entries(all).sort(([a], [b]) => a.localeCompare(b)),
  )
  writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n')
}

/** Ids whose current After text differs from (or is missing in) the recorded hashes. */
export const staleIds = (
  current: Record<string, string>,
  recorded: Record<string, string>,
): string[] =>
  Object.keys(current).filter(
    (id) => recorded[id] !== hashAfterText(current[id]!),
  )
