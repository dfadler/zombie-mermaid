---
'zombie-mermaid': minor
---

`render --ascii -w/--max-width` now automatically applies compact spacing (tightest node/border padding, no label wrapping or direction changes) when the diagram overflows the target width, instead of only warning. If compact spacing brings it within the target, a note is printed to stderr and the narrower diagram is what's printed; if it still doesn't fit, the existing overflow warning fires (now noting that compaction was already tried) and the full, unmodified diagram is still printed — never truncated. Full auto-fit reflow (label wrapping, direction flipping) remains out of scope — see issue #335.
