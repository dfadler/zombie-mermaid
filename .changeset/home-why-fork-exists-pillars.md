---
---

No release: replaces the home page's flat six-card "Six nodes, one
rendering engine." feature grid with two sections that each have a
distinct, non-overlapping job.

"Why This Fork Exists" (mirroring the README section of the same name)
is now weighted toward zombie-mermaid's own contribution rather than the
mermaid.js/beautiful-mermaid history: beautiful-mermaid already fixed
mermaid.js's aesthetics/theming/terminal-output/dependency problems (see
`docs/migrating-from-beautiful-mermaid.md`'s "What is drop-in" section),
so this section spends its space on what's actually new to this fork
instead — a real CLI binary and the `mergeEdges` render option, both
called out as "new to this fork" in that same doc, plus a card
summarizing the documented parser bugs (dropped edges, corrupted labels,
stray nodes) with a real link to `fork-fixes.html`. It deliberately does
not restate the fork's merged-PR/days-since-commit numbers or bug count —
those already have a home in `ProofSection` further down the page.

"Built for how diagrams get used now" keeps the original six facts'
copy but regroups them into three named pillars (Output flexibility /
Drop-in architecture / Proven at scale), two facts each, and drops
theming from the list — the page's live Theme Showcase directly above
already proves it, so restating "15 built-in themes" / "Full Shiki
compatibility" in a static card would just repeat what the visitor saw
work. In its place: "Ultra-fast" and "CI-enforced accessibility," two
real README features (`Ultra-fast — Renders 100+ diagrams in under
500ms`, `Accessible SVG output, CI-enforced`) that were previously true
of this fork but never shown anywhere on the home page.

Three new icons (`SpeedIcon`, `AccessibilityIcon`, `MergeEdgesIcon`) were
added to `demo/components/icons.tsx` for the above, following the file's
existing stroke-icon conventions; they're original to this change, not
transcribed from the design canvas the rest of the file's icons are
pinned to.

In passing, fixed a stale doc comment left over from the #804
hero/main-app split: the old `FeatureGrid` carried a header comment
about "the showcase's build-time diagram" that actually described a
different, unrelated function.

Nothing here touches the published `zombie-mermaid` package.
