---
name: pr-checklist
description: |
  Rules for the checkbox list in a PR body (.github/PULL_REQUEST_TEMPLATE.md).
  Use whenever you open, edit, or update a PR body, or are asked to "tick the
  boxes", fix the `PR checklist` CI check, or get a PR mergeable. A box is
  checked only after its task was done and verified in this session; never to
  turn CI green.
---

# pr-checklist

CI (`PR checklist` in `.github/workflows/pr-hygiene.yml`) fails while any
`- [ ]` is left in the PR body. A checked box is a claim that the task is done.
Checking one to satisfy the gate defeats it, so:

1. **Never pre-check.** Write the body with every box unchecked, then work
   down the list. Don't copy a body from another PR with its boxes ticked.
2. **Check a box only with evidence from this session.** For a command item
   (`pnpm run lint`, `format:check`, `typecheck`, `pnpm test`), run it, see it
   exit 0, then check it. A run from an earlier session, a subagent's claim,
   or "it passed in CI last time" is not evidence: re-run, or leave unchecked.
   For a file item (changeset, `demo/fork-fixes-data.ts` entry, screenshot,
   pasted Mermaid source), confirm the file or text is in the diff/body first
   (`git diff --stat origin/main`, `gh pr view --json body`).
3. **N/A needs a reason.** If an item does not apply, check it and write
   `N/A: <one-line reason tied to this diff>` on the same line (for example
   `N/A: no ASCII output change, only demo/ CSS`). Don't mark N/A to skip work
   that does apply; if unsure, do the work.
4. **Answer, don't just tick, the yes/no and link items.** "Breaking change?
   yes / no" gets the answer written; "Linked issue" gets the real `#N`;
   follow-ups are filed issues (see `close-out`).
5. **Can't do it? Leave it unchecked and say so.** Report which boxes are open
   and why. The failing `PR checklist` check is the correct outcome; the user
   decides. Never edit the template, the workflow, or the script to get past it.
6. **Re-check after any later push.** A new commit can invalidate a box
   (lint now fails, a changeset got dropped). Before reporting the PR ready,
   re-verify each checked command item against the final commit and edit the
   body (write it to a file, `gh pr edit --body-file`; never a heredoc in `$()`).

End with one line: boxes checked (with evidence), N/A (with reasons), left open.
