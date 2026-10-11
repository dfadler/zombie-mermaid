// Fails when the live demo site's JSON-LD softwareVersion lags npm `latest`
// for more than a day (#1574; the Pages deploy once sat stuck for four days
// unnoticed, #1525). Zero deps so the workflow needs no install.
// Env: SITE_URL, PACKAGE, GRACE_HOURS (default 24), LAST_PAGES_SUCCESS (info only).
import { pathToFileURL } from 'node:url'

export function siteVersion(html) {
  for (const m of html.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const v = JSON.parse(m[1]).softwareVersion
      if (v) return String(v)
    } catch {}
  }
  return null
}

/** Returns an error string when stale, else null. */
export function driftError({
  site,
  latest,
  publishedAt,
  now,
  graceHours = 24,
}) {
  if (!site) return 'no softwareVersion found in live site JSON-LD'
  if (site === latest) return null
  const ageH = (now - Date.parse(publishedAt)) / 36e5
  return ageH > graceHours
    ? `site serves ${site} but npm latest ${latest} was published ${ageH.toFixed(1)}h ago`
    : null
}

/** Fetches npm + the live site; returns { line, err } (err null when fresh). */
export async function run(env, fetchFn = fetch, now = Date.now()) {
  const { SITE_URL, PACKAGE, GRACE_HOURS, LAST_PAGES_SUCCESS } = env
  const get = async (u) => {
    const r = await fetchFn(u)
    if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`)
    return r
  }
  const reg = await (await get(`https://registry.npmjs.org/${PACKAGE}`)).json()
  const latest = reg['dist-tags'].latest
  const site = siteVersion(await (await get(SITE_URL)).text())
  const err = driftError({
    site,
    latest,
    publishedAt: reg.time[latest],
    now,
    graceHours: Number(GRACE_HOURS || 24),
  })
  const line = `site=${site} npm=${latest} last pages.yml success=${LAST_PAGES_SUCCESS || 'unknown'}`
  return { line, err }
}

/** CLI entry: prints the status line, annotates drift; returns the exit code. */
export async function main(env, fetchFn = fetch) {
  const { line, err } = await run(env, fetchFn)
  console.log(line)
  if (err) console.error(`::error::${err}`)
  return err ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.env)
}
