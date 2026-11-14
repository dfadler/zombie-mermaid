---
name: migrate-docs-to-issues
description: |
  Finds long docs under `docs/research/` and `docs/decisions/` and moves their bulk onto the issue they answer,
  leaving a short summary and a link in the repo. Use when asked to clean up, shrink, audit or migrate research
  or decision docs, or when a doc there has grown past a page. Not for writing new findings (use
  research-findings) or reviewing a new decision doc (use decision-doc-review).
---

# migrate-docs-to-issues

## Contract

- **Input:** optionally a doc path or an issue number; with neither, the whole of `docs/research/` and `docs/decisions/`.
- **Output:** the candidate table from the report script, then for each doc the user picks: a drafted issue comment, and after the user confirms the post, the doc rewritten as a short summary that links the comment.
- **Does not:** post a comment or edit a doc the user has not picked, change `Status:` lines, or touch docs that nothing in the table lists.

## Steps

1. Run `pnpm exec tsx scripts/doc-migration-report.ts` (add `--max-lines N` to change the 80-line cutoff, `--all` to list every doc). It is read-only and prints each doc's length, status, issue numbers it names and how many files outside the two directories cite it.
2. Show the table. Ask which docs to migrate; do not pick for the user. Docs cited by guides or scripts (`Referenced by` above 0) keep their file name and the line the citing file relies on.
3. For each picked doc, find its issue: the number in the file name, else the issue the first paragraph or `Status:` line names. If none is clear, ask the user.
4. Draft the comment body with the Write tool: a one-paragraph conclusion, then the doc's body inside `<details><summary>Full write-up (moved from <path>)</summary> … </details>`. Link scripts and files by permalink to the current commit.
5. Show the draft and the target issue and ask for confirmation to post it. A comment is public and cannot be fully retracted. Then run `gh issue comment <n> --body-file <file>` and keep the comment URL it prints.
6. Rewrite the doc to the short form: the title, the `Status:` line unchanged (and `As of:` for a research doc), the decision or conclusion in 3 to 8 lines, and `Full write-up: <comment URL>`.
7. Run `pnpm run check:docs`; fix any reported missing line, then show the diff of the shortened doc.

A doc is finished when its comment URL is in the doc, `pnpm run check:docs` passes, and the user has seen the diff.
