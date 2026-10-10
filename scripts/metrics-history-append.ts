/**
 * Appends one snapshot of public project metrics (GitHub stars, npm weekly
 * downloads and unpacked size per published package) to a tracked JSONL
 * history, metrics-history.jsonl, so a post can show a real before/after
 * (#1520). Same append-only JSONL shape as bench-history.jsonl.
 *
 * Usage: tsx scripts/metrics-history-append.ts [--history=<path>] [--max-entries=<n>]
 *
 * Meant to run weekly from .github/workflows/dashboard-refresh.yml. A failed fetch
 * records `null` for that value rather than aborting, so one npm blip
 * doesn't lose the week's other numbers.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const REPO = 'dfadler/zombie-mermaid'
export const PACKAGES = [
  'zombie-mermaid',
  '@zombie-mermaid/core',
  '@zombie-mermaid/mermaid-parser',
  '@zombie-mermaid/svg-renderer',
  '@zombie-mermaid/ascii-renderer',
  '@zombie-mermaid/mcp',
]

export interface PackageMetrics {
  version: string | null
  unpackedSize: number | null
  weeklyDownloads: number | null
}

export interface MetricsEntry {
  generatedAt: string
  stars: number | null
  packages: Record<string, PackageMetrics>
}

export type Fetcher = (url: string) => Promise<unknown>

const jsonFetch: Fetcher = async (url) => {
  const headers: Record<string, string> = {
    'user-agent': 'zombie-mermaid-metrics',
  }
  if (url.startsWith('https://api.github.com') && process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch (err) {
    console.warn(String(err))
    return null
  }
}

/** Pure given `fetcher`, so tests inject a fixture instead of the network. */
export async function collect(
  fetcher: Fetcher,
  now = new Date(),
): Promise<MetricsEntry> {
  const gh = await orNull(
    fetcher(`https://api.github.com/repos/${REPO}`) as Promise<{
      stargazers_count: number
    }>,
  )
  const packages: Record<string, PackageMetrics> = {}
  for (const name of PACKAGES) {
    const meta = await orNull(
      fetcher(
        `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`,
      ) as Promise<{
        version: string
        dist?: { unpackedSize?: number }
      }>,
    )
    const dl = await orNull(
      fetcher(
        `https://api.npmjs.org/downloads/point/last-week/${name}`,
      ) as Promise<{
        downloads: number
      }>,
    )
    packages[name] = {
      version: meta?.version ?? null,
      unpackedSize: meta?.dist?.unpackedSize ?? null,
      weeklyDownloads: dl?.downloads ?? null,
    }
  }
  return {
    generatedAt: now.toISOString(),
    stars: gh?.stargazers_count ?? null,
    packages,
  }
}

export function appendEntry(
  entries: MetricsEntry[],
  entry: MetricsEntry,
  maxEntries: number,
): MetricsEntry[] {
  const next = [...entries, entry]
  return next.length > maxEntries ? next.slice(next.length - maxEntries) : next
}

export function parseHistory(raw: string): MetricsEntry[] {
  return raw
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as MetricsEntry)
}

export function serializeHistory(entries: MetricsEntry[]): string {
  return entries.map((e) => JSON.stringify(e) + '\n').join('')
}

async function main() {
  const args = process.argv.slice(2)
  const arg = (flag: string) =>
    args.find((a) => a.startsWith(flag))?.slice(flag.length)
  const historyPath = arg('--history=') ?? 'metrics-history.jsonl'
  const maxEntries = Number(arg('--max-entries=') ?? '520')

  let existing: MetricsEntry[] = []
  try {
    existing = parseHistory(await readFile(historyPath, 'utf-8'))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  const updated = appendEntry(existing, await collect(jsonFetch), maxEntries)
  await writeFile(historyPath, serializeHistory(updated), 'utf-8')
  console.log(
    `Appended metrics entry to ${historyPath} (${updated.length} entries).`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
