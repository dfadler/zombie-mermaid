---
name: research-findings
description: |
  Where to put the results of investigation, measurement, benchmark or spike work
  on a GitHub issue: post them as an issue comment, not a new `docs/research/*.md`.
  Use when you finish (or are about to write up) a spike, profiling run, measurement,
  comparison or other research for an issue, or are about to create a file under
  `docs/research/`. Not for decision docs (`docs/decisions/`) or for ordinary code
  or test changes.
---

# research-findings

Findings from investigation, measurement or spike work on an issue go **in the issue**.

1. Post them as a comment on the issue (`gh issue comment <n> --body-file <file>`; write the
   body with the Write tool, never a heredoc inside `$()`).
2. Put long output (raw timings, tables, logs) in a collapsed
   `<details><summary>…</summary> … </details>` block, with the conclusion above it.
3. Link any script or other artifact by a permalink to its file in the repo
   (`https://github.com/dfadler/zombie-mermaid/blob/<sha>/<path>`), not a bare path.
4. Do **not** add a `docs/research/*.md` doc. Write one only when something else (a guide, a
   code comment, a script) links to it and it is worth keeping current: `pnpm run check:docs`
   fails on an unreferenced doc under `docs/research/`, `scripts/pre-pr-check.sh` warns when a
   PR adds one, and `scripts/research-nudge.sh` nudges when you create one.
5. Former research docs and where their findings now live are indexed in
   `docs/research/README.md`; look there before re-running a past investigation.

If the user asks for a file anyway, say where the rule points, then do what they asked.

See [#1479](https://github.com/dfadler/zombie-mermaid/issues/1479) and
[#1642](https://github.com/dfadler/zombie-mermaid/issues/1642).
