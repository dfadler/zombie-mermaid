# Form-judge category prompt

Used by `.github/workflows/form-judge-weekly.yml` — one non-interactive Claude
session per diagram category, judging whether this repo's ASCII/terminal
rendering faithfully reproduces the structure real, upstream mermaid.js
renders for the same source. Real mermaid.js is the ground truth: it's the
actual library (the same engine behind the mermaid Live Editor and GitHub's
own mermaid preview), not this repo's own independent SVG reimplementation,
which could itself diverge from real mermaid semantics.

The workflow substitutes `__CATEGORY__` with the category name (e.g.
"Sequence") and `__INDEX_PATH__`/`__RESULTS_PATH__` with absolute paths
before invoking this prompt.

---

You are auditing category **"__CATEGORY__"** of a structural-fidelity report.

Read the index file at `__INDEX_PATH__` — a JSON array of `{id, category,
title, path, judgeable, mermaidError, asciiError}` entries for every sample
in this category (`path` points to that sample's own small JSON file). Skip
any entry where `judgeable` is `false` (real mermaid.js failed to parse or
this repo's ASCII renderer threw — there's no ground truth to judge, or
nothing to compare) — just note it as skipped in your final summary, don't
try to judge it.

For each judgeable entry, read its file at `path`. It contains:
- `source` — the mermaid diagram source text
- `trimmedSvg` — real mermaid.js's SVG output for that source (boilerplate
  `<defs>`/`<marker>`/`<style>` stripped; what remains is the actual
  per-diagram elements — positions, classes, `data-*` attributes, e.g.
  `data-type="actor"` vs `data-type="participant"` distinguishes a
  stick-figure actor from a box)
- `asciiText` — this repo's ASCII/terminal output for the same source. This
  is the literal text a real terminal would print, not a screenshot or an
  approximation of one.

Judge whether `asciiText` is a reasonable **structural** reproduction of
what `trimmedSvg` shows. Look specifically for:
- An element rendered as the wrong kind (e.g. a mermaid `actor` —
  `data-type="actor"` — drawn as a plain box instead of something visually
  distinct from a `participant`)
- Two elements overlapping or colliding where they shouldn't (a note
  running into an unrelated lifeline/box, two unrelated lines fused
  together, a connector overwriting label text)
- Truncated, clipped, or corrupted text (a label cut off mid-word, a line
  silently missing)
- Wrong or missing connections/relationships (an edge that doesn't match
  the source, or is missing entirely)
- An element positioned on the wrong side, in the wrong order, or attached
  to the wrong entity relative to the ground truth

Do **not** flag: the absence of color, the use of characters (`-`/`|`/`>`)
instead of smooth SVG lines/arrowheads, square corners instead of rounded
ones, or any other difference that's simply inherent to ASCII art rather
than a structural defect. If you're not confident something is a genuine
structural discrepancy, don't report it — a false positive here is worse
than a missed minor issue.

**Work through samples one at a time, and after every sample, append your
verdict as one line of JSON to `__RESULTS_PATH__`** (create the file if it
doesn't exist yet) — don't hold verdicts in memory until the end, so
progress survives even if you run out of turns partway through:

```json
{"id": "<the sample's id>", "title": "<the sample's title>", "faithful": true|false, "findings": [{"severity": "major|moderate|minor", "summary": "one sentence naming the specific defect", "evidence": "the concrete signal proving it — quote the exact ASCII text and, where relevant, the SVG attribute/element that contradicts it"}]}
```

`faithful` is `false` only when at least one finding is severe enough that
you would *not* call the ASCII output a reasonable reproduction overall — a
sample can be `faithful: true` while still carrying a minor cosmetic
finding worth noting (e.g. token order in an attribute line) that isn't, on
its own, a structural defect.

For a skipped (non-judgeable) entry, append instead:
`{"id": "<id>", "title": "<title>", "skipped": true, "reason": "<mermaidError or asciiError, whichever is set>"}`.

When you've gone through every entry in the index, you're done — do not
write a separate summary file, the workflow reads `__RESULTS_PATH__`
directly.
