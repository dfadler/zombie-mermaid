// Core of the weekly mentions watch (#2176): collectors for each source, URL
// canonicalization, dedupe against a seen-set, and the issue-body formatter.
// Network access goes through an injected `fetch` so tests run offline; the
// CLI entry point is scripts/mention-watch.ts.

/* eslint-disable @typescript-eslint/no-explicit-any -- third-party API JSON; field access is covered by fixtures in __tests__/mention-watch.test.ts */

export interface Finding {
  url: string
  title: string
  source: string
  date?: string
  /** Login or username of whoever wrote it, when the source gives one. */
  author?: string
  /** Text the name matcher runs on. Absent = the source already matched the phrase exactly. */
  text?: string
}

export interface Config {
  phrases: string[]
  excludeUrlPrefixes: string[]
  /** Findings by these logins are dropped even when their URL is in someone else's repo. */
  excludeAuthors: string[]
  maxPerQuery: number
  maxReported: number
}

export interface Ctx {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  token?: string
  /** Tavily API key; the Web collector is skipped without it. */
  tavilyKey?: string
  max: number
  /** Pause between GitHub search calls (code search allows ~10 requests/min). */
  githubDelayMs: number
  sleep: (ms: number) => Promise<void>
}

/** `reportedIn` is the report issue URL, filled in by the workflow once the issue exists. */
export type SeenSet = Record<string, { firstSeen: string; reportedIn?: string }>

const NAME_RE = /zombie[\s_-]*mermaid/i
const ZWSP = '​'

export function matchesName(text: string): boolean {
  return NAME_RE.test(text)
}

// Xstg: Google's click tracking on YouTube results, which made one video two URLs.
const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|ref$|ref_src$|xstg$)/i

export function canonicalizeUrl(raw: string): string {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return raw.trim()
  }
  u.hash = ''
  u.hostname = u.hostname.toLowerCase()
  const kept = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAM.test(k))
    .sort(([a], [b]) => a.localeCompare(b))
  u.search = ''
  for (const [k, v] of kept) u.searchParams.append(k, v)
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '')
  return u.toString()
}

export function isExcluded(url: string, prefixes: string[]): boolean {
  const c = canonicalizeUrl(url)
  return prefixes.some((p) => c === p || c.startsWith(p + '/'))
}

// --- collectors -----------------------------------------------------------

async function getJson(
  ctx: Ctx,
  url: string,
  init?: RequestInit,
): Promise<any> {
  const res = await ctx.fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function ghHeaders(ctx: Ctx): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'zombie-mermaid-mention-watch',
  }
  if (ctx.token) h.Authorization = `Bearer ${ctx.token}`
  return h
}

const q = (phrase: string) => encodeURIComponent(`"${phrase}"`)

// Hosts the GitHub, npm and Hacker News collectors already search, so the web
// collector drops them instead of reporting the same page twice.
const COVERED_HOST_RE = /(^|\.)(github\.com|npmjs\.com|ycombinator\.com)$/i
// The project name is also a Halloween costume, so web hits must also talk about
// diagrams or rendering. ponytail: keyword match on Tavily's snippet only, so a real
// mention whose snippet lacks these words is dropped; widen the list if that bites.
const WEB_CONTEXT_RE =
  /\b(diagrams?|flowcharts?|render(?:er|ing|s)?|ascii|svg|npm|typescript|javascript|markdown|cli|library|package|mermaid\.?js)\b/i
// Tavily dates are RFC 2822 ("Sun, 19 Oct 2025 ..."); the report wants YYYY-MM-DD.
const isoDate = (raw: unknown) => {
  const t = typeof raw === 'string' ? Date.parse(raw) : NaN
  return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10)
}
// '' for a missing or malformed URL, so the filter below drops it too.
const hostOf = (url: unknown) => {
  try {
    return new URL(String(url)).hostname
  } catch {
    return ''
  }
}

type Collector = {
  source: string
  github: boolean
  /** Skipped (not counted as an attempt or an error) unless ctx.tavilyKey is set. */
  needsTavilyKey?: boolean
  run: (ctx: Ctx, phrase: string) => Promise<Finding[]>
}

export const COLLECTORS: Collector[] = [
  {
    source: 'GitHub code',
    github: true,
    run: async (ctx, phrase) => {
      const j = await getJson(
        ctx,
        `https://api.github.com/search/code?q=${q(phrase)}&per_page=${ctx.max}`,
        { headers: ghHeaders(ctx) },
      )
      return (j.items ?? []).map((i: any) => ({
        url: i.html_url,
        title: `${i.repository?.full_name}: ${i.path}`,
        source: 'GitHub code',
      }))
    },
  },
  {
    source: 'GitHub issues and PRs',
    github: true,
    run: async (ctx, phrase) => {
      const j = await getJson(
        ctx,
        `https://api.github.com/search/issues?q=${q(phrase)}&per_page=${ctx.max}`,
        { headers: ghHeaders(ctx) },
      )
      return (j.items ?? []).map((i: any) => ({
        url: i.html_url,
        title: i.title,
        source: 'GitHub issues and PRs',
        date: i.created_at,
        author: i.user?.login,
        text: `${i.title}\n${i.body ?? ''}`,
      }))
    },
  },
  {
    source: 'GitHub repositories',
    github: true,
    run: async (ctx, phrase) => {
      const j = await getJson(
        ctx,
        `https://api.github.com/search/repositories?q=${q(phrase)}&per_page=${ctx.max}`,
        { headers: ghHeaders(ctx) },
      )
      return (j.items ?? []).map((i: any) => ({
        url: i.html_url,
        title: `${i.full_name}${i.description ? ` - ${i.description}` : ''}`,
        source: 'GitHub repositories',
        date: i.pushed_at,
        text: `${i.full_name}\n${i.description ?? ''}`,
      }))
    },
  },
  {
    source: 'GitHub discussions',
    github: true,
    run: async (ctx, phrase) => {
      const query = `query($q: String!, $n: Int!) { search(query: $q, type: DISCUSSION, first: $n) { nodes { ... on Discussion { title url createdAt body author { login } } } } }`
      const j = await getJson(ctx, 'https://api.github.com/graphql', {
        method: 'POST',
        headers: { ...ghHeaders(ctx), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { q: `"${phrase}"`, n: ctx.max },
        }),
      })
      if (j.errors) throw new Error('GraphQL error')
      return (j.data?.search?.nodes ?? [])
        .filter((n: any) => n?.url)
        .map((n: any) => ({
          url: n.url,
          title: n.title,
          source: 'GitHub discussions',
          date: n.createdAt,
          author: n.author?.login,
          text: `${n.title}\n${n.body ?? ''}`,
        }))
    },
  },
  {
    source: 'npm',
    github: false,
    run: async (ctx, phrase) => {
      const j = await getJson(
        ctx,
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(phrase)}&size=${ctx.max}`,
      )
      return (j.objects ?? []).map(({ package: p }: any) => ({
        url: p.links?.npm ?? `https://www.npmjs.com/package/${p.name}`,
        title: `${p.name}${p.description ? ` - ${p.description}` : ''}`,
        source: 'npm',
        date: p.date,
        author: p.publisher?.username,
        text: `${p.name}\n${p.description ?? ''}\n${(p.keywords ?? []).join(' ')}`,
      }))
    },
  },
  {
    source: 'Hacker News',
    github: false,
    run: async (ctx, phrase) => {
      const j = await getJson(
        ctx,
        `https://hn.algolia.com/api/v1/search_by_date?query=${q(phrase)}&tags=(story,comment)&hitsPerPage=${ctx.max}`,
      )
      return (j.hits ?? []).map((h: any) => ({
        url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        title: h.title ?? `Comment on: ${h.story_title ?? 'a story'}`,
        source: 'Hacker News',
        date: h.created_at,
        author: h.author,
        text: [
          h.title,
          h.story_title,
          h.url,
          h.story_url,
          h.story_text,
          h.comment_text,
        ]
          .filter(Boolean)
          .join('\n'),
      }))
    },
  },
  {
    source: 'Web',
    github: false,
    needsTavilyKey: true,
    run: async (ctx, phrase) => {
      // The spaced phrase is the creature on the open web (#2215); hyphenated spellings only.
      if (/\s/.test(phrase)) return []
      // https://docs.tavily.com/documentation/api-reference/endpoint/search
      const j = await getJson(ctx, 'https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.tavilyKey}`,
        },
        body: JSON.stringify({
          query: `"${phrase}" diagram renderer`,
          max_results: Math.min(ctx.max, 20),
          search_depth: 'basic',
          include_published_date: true,
        }),
      })
      return (j.results ?? [])
        .filter((r: any) => {
          const host = hostOf(r?.url)
          return (
            host !== '' &&
            !COVERED_HOST_RE.test(host) &&
            WEB_CONTEXT_RE.test(`${r.title ?? ''}\n${r.content ?? ''}`)
          )
        })
        .map((r: any) => ({
          url: r.url,
          title: r.title ?? r.url,
          source: 'Web',
          date: isoDate(r.published_date),
          text: `${r.title ?? ''}\n${r.content ?? ''}`,
        }))
    },
  },
]

export interface CollectResult {
  findings: Finding[]
  errors: string[]
  attempts: number
}

/** Runs every collector for every phrase. A failing call is recorded, never thrown. */
export async function collectAll(
  ctx: Ctx,
  config: Pick<Config, 'phrases' | 'excludeUrlPrefixes' | 'excludeAuthors'>,
  collectors: Collector[] = COLLECTORS,
): Promise<CollectResult> {
  const byUrl = new Map<string, Finding>()
  const errors: string[] = []
  let attempts = 0
  for (const c of collectors) {
    if (c.needsTavilyKey && !ctx.tavilyKey) continue
    for (const phrase of config.phrases) {
      attempts++
      try {
        for (const f of await c.run(ctx, phrase)) {
          if (!f.url) continue
          if (
            f.author &&
            config.excludeAuthors.some(
              (a) => a.toLowerCase() === f.author!.toLowerCase(),
            )
          )
            continue
          if (f.text !== undefined && !matchesName(f.text)) continue
          if (isExcluded(f.url, config.excludeUrlPrefixes)) continue
          const key = canonicalizeUrl(f.url)
          if (!byUrl.has(key)) byUrl.set(key, f)
        }
      } catch (e) {
        errors.push(`${c.source} ("${phrase}"): ${(e as Error).message}`)
      }
      if (c.github && ctx.githubDelayMs > 0) await ctx.sleep(ctx.githubDelayMs)
    }
  }
  return { findings: [...byUrl.values()], errors, attempts }
}

// --- dedupe and report ----------------------------------------------------

export function selectNew(
  findings: Finding[],
  seen: SeenSet,
  limit: number,
): Finding[] {
  return findings
    .filter((f) => !(canonicalizeUrl(f.url) in seen))
    .slice(0, limit)
}

export function mergeSeen(
  seen: SeenSet,
  reported: Finding[],
  date: string,
): SeenSet {
  const next = { ...seen }
  for (const f of reported) next[canonicalizeUrl(f.url)] = { firstSeen: date }
  return next
}

/** Neutralize third-party text: no mentions, issue refs, markup, or autolinks. */
export function sanitize(text: string, max = 140): string {
  let s = text
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > max) s = s.slice(0, max - 1) + '…'
  return s
    .replace(/[\\`*_[\]<>|!()~]/g, (c) => `\\${c}`)
    .replace(/@/g, `@${ZWSP}`)
    .replace(/#/g, `#${ZWSP}`)
    .replace(/https?:\/\//gi, (m) => `${m.slice(0, 4)}${ZWSP}${m.slice(4)}`)
}

const linkUrl = (url: string) =>
  url.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20')

export function buildReport(opts: {
  findings: Finding[]
  date: string
  errors: string[]
}): string {
  const { findings, date, errors } = opts
  const lines = [
    `# Mentions report: ${date}`,
    '',
    `${findings.length} new mention${findings.length === 1 ? '' : 's'} since the last report. Text below is copied from third-party pages and is untrusted.`,
  ]
  const sources = [...new Set(findings.map((f) => f.source))]
  for (const source of sources) {
    const group = findings.filter((f) => f.source === source)
    lines.push('', `## ${source} (${group.length})`, '')
    for (const f of group) {
      const by = f.author ? ` by ${sanitize(f.author, 40)}` : ''
      const when = f.date ? ` (${f.date.slice(0, 10)})` : ''
      lines.push(`- [ ] [${sanitize(f.title)}](${linkUrl(f.url)})${by}${when}`)
    }
  }
  if (errors.length) {
    lines.push(
      '',
      '## Sources that failed this run',
      '',
      ...errors.map((e) => `- ${sanitize(e, 200)}`),
    )
  }
  return lines.join('\n') + '\n'
}

export interface WatchResult {
  report: string
  nextSeen: SeenSet
  newCount: number
  found: number
  errors: string[]
  /** Every source call failed, so there is nothing trustworthy to report. */
  allFailed: boolean
}

/** One full pass: collect, drop what was already reported, build the report and the next seen-set. */
export async function runWatch(opts: {
  config: Config
  seen: SeenSet
  date: string
  ctx: Ctx
}): Promise<WatchResult> {
  const { config, seen, date, ctx } = opts
  const { findings, errors, attempts } = await collectAll(ctx, config)
  const fresh = selectNew(findings, seen, config.maxReported)
  return {
    report: buildReport({ findings: fresh, date, errors }),
    nextSeen: mergeSeen(seen, fresh, date),
    newCount: fresh.length,
    found: findings.length,
    errors,
    allFailed: attempts > 0 && errors.length === attempts,
  }
}
