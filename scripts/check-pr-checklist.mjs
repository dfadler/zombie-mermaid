// Fail when the PR body still has an unchecked `- [ ]` task-list item.
// Run by .github/workflows/pr-hygiene.yml (job `PR checklist`) with the body in
// PR_BODY, and unit-tested in __tests__/check-pr-checklist.test.ts. Plain .mjs so
// the job needs no pnpm install.
import { pathToFileURL } from 'node:url'

/** Unchecked task-list items in a PR body, ignoring HTML comments and code fences. */
export function uncheckedItems(body) {
  const visible = String(body ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[^\n]*$/gm, '')
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
