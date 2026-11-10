// Fail when the PR body still has an unchecked `- [ ]` task-list item.
// Run by .github/workflows/pr-hygiene.yml (job `PR checklist`) with the body in
// PR_BODY, and unit-tested in __tests__/check-pr-checklist.test.ts. Plain .mjs so
// the job needs no pnpm install.
import { pathToFileURL } from 'node:url'

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/

/** The fence a line opens, or null. A backtick fence's info string cannot hold a backtick. */
function openingFence(line) {
  const m = FENCE_OPEN.exec(line)
  if (!m || (m[1][0] === '`' && m[2].includes('`'))) return null
  return { ch: m[1][0], len: m[1].length }
}

/** CommonMark: same character, at least as long, nothing after it but spaces. */
function closesFence(line, fence) {
  const m = FENCE_CLOSE.exec(line)
  return !!m && m[1][0] === fence.ch && m[1].length >= fence.len
}

/**
 * The lines GitHub shows as text, with code fences and HTML comments removed in ONE
 * forward pass that tracks both: a `<!--` inside a fence (or a fence inside a comment)
 * is literal, so neither can hide or expose lines outside it. Output is never
 * re-scanned, so nested input such as `<!<!-- a -->--` cannot rebuild a marker
 * (CodeQL js/incomplete-multi-character-sanitization).
 *
 * An unterminated `<!--` stays visible text. A fence that is never closed also stays
 * visible: CommonMark would make the rest of the body code, but then one stray fence
 * would hide every box and pass the gate. `unclosed` names that opener's line so the
 * caller can scan again with it treated as plain text. Ceiling: fences nested in list
 * items are not modelled.
 */
function visibleLines(body, literalFences) {
  const lines = body.split(/\r?\n/)
  const out = []
  let fence = null
  let fenceAt = -1
  for (let i = 0; i < lines.length; i++) {
    if (fence) {
      if (closesFence(lines[i], fence)) fence = null
      continue
    }
    if (!literalFences.has(i) && (fence = openingFence(lines[i]))) {
      fenceAt = i
      continue
    }
    let rest = lines[i]
    for (;;) {
      const open = rest.indexOf('<!--')
      if (open < 0) break
      let j = i
      let close = rest.indexOf('-->', open + 4)
      while (close < 0 && ++j < lines.length) close = lines[j].indexOf('-->')
      if (close < 0) break
      out.push(rest.slice(0, open))
      rest = (j === i ? rest : lines[j]).slice(close + 3)
      i = j
    }
    out.push(rest)
  }
  return { out, unclosed: fence ? fenceAt : -1 }
}

/** Unchecked task-list items in a PR body, ignoring HTML comments and code fences. */
export function uncheckedItems(body) {
  const literalFences = new Set()
  for (;;) {
    const { out, unclosed } = visibleLines(String(body ?? ''), literalFences)
    if (unclosed >= 0) {
      literalFences.add(unclosed)
      continue
    }
    const items = []
    for (const line of out) {
      const m = /^[ \t]*[-*+][ \t]+\[ \][ \t]+(.*)$/.exec(line)
      if (m) items.push(m[1].trim())
    }
    return items
  }
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
