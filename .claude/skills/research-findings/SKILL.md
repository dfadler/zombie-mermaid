---
name: research-findings
description: |
  Where results of investigating, measuring, benchmarking, profiling or comparing go: an
  issue comment, not a file in the repo. Use whenever you hold findings for an issue, are asked
  where to put or how to write up results, or are about to save results as a doc (any
  `docs/research/` file, a notes or findings markdown file). Not for decisions (use
  decision-doc-review) or code changes.
---

# research-findings

## Contract

- **Input:** the results of investigation, measurement or spike work on a GitHub issue.
- **Output:** an issue comment body (conclusion first, long output in `<details>`, script permalinks) and where it is posted.
- **Does not:** write decision docs or change code.

Findings from investigation, measurement or spike work on an issue go **in the issue**.

1. Post them as a comment on the issue (`gh issue comment <n> --body-file <file>`; write the
   body with the Write tool, never a heredoc inside `$()`).
2. Put long output (raw timings, tables, logs) in a collapsed
   `<details><summary>…</summary> … </details>` block, with the conclusion above it.
3. Link any script or other artifact by a permalink to its file in the repo
   (`https://github.com/dfadler/zombie-mermaid/blob/<sha>/<path>`), not a bare path.
4. Post a comment instead of adding a `docs/research/*.md` doc. Write a doc only when something
   else (a guide, a code comment, a script) links to it and it is worth keeping current;
   `pnpm run check:docs` and the `pre-pr-check.sh` and `research-nudge.sh` hooks flag the rest.
5. Former research docs and where their findings now live are indexed in
   `docs/research/README.md`; look there before re-running a past investigation.

A repo doc may keep a short summary (a few lines: the conclusion and the numbers that matter) with a
link to the issue comment; the method, tables and raw output stay in the comment.

If the user asks for a full-length file anyway, say where the rule points, then do what they asked.

See [#1479](https://github.com/dfadler/zombie-mermaid/issues/1479) and
[#1642](https://github.com/dfadler/zombie-mermaid/issues/1642).
