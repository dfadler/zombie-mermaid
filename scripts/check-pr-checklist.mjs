// Fail when the PR body still has an unchecked `- [ ]` task-list item.
// Run by .github/workflows/pr-hygiene.yml (job `PR checklist`) with the body in
// PR_BODY, and unit-tested in __tests__/check-pr-checklist.test.ts. Plain .mjs so
// the job needs no pnpm install.
import { pathToFileURL } from 'node:url'

// One left-to-right pass, like the renderer: a comment runs from `<!--` to the next
// `-->`, and text before it is never rescanned, so nested input such as
// `<!<!-- a -->--` cannot rebuild a marker (looping a regex strip could, and would hide
// a box GitHub shows). An unterminated `<!--` is kept, which counts more boxes, not fewer.
function stripHtmlComments(s) {
  let out = ''
  let i = 0
  for (;;) {
    const open = s.indexOf('<!--', i)
    const close = open < 0 ? -1 : s.indexOf('-->', open + 4)
    if (close < 0) return out + s.slice(i)
    out += s.slice(i, open)
    i = close + 3
  }
}

/** Unchecked task-list items in a PR body, ignoring HTML comments and code fences. */
export function uncheckedItems(body) {
  const visible = stripHtmlComments(String(body ?? '')).replace(
    /^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[^\n]*$/gm,
    '',
  )
  return [...visible.matchAll(/^[ \t]*[-*+][ \t]+\[ \][ \t]+(.*)$/gm)].map(
    (m) => m[1].trim(),
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const open = uncheckedItems(process.env.PR_BODY)
  for (const item of open)
    console.error(`::error::Unchecked PR checklist item: ${item}`)
  if (open.length > 0) {
    console.error(
      `${open.length} unchecked box(es). Do the task, then check the box (or check it with "N/A: <reason>" when it does not apply).`,
    )
    process.exit(1)
  }
}
