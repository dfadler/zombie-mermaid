---
'zombie-mermaid': patch
---

Demo-site only: link the "What this fork fixes" page to the upstream issues it resolves, and add 9 new before/after entries.

The page named a commit and a PR for each fix but never mentioned the upstream `lukilabs/beautiful-mermaid` issue it traces back to, so a reader following a link from an upstream issue had no way to find the corresponding entry. Existing entries whose fix also closes one of the 25 upstream issues we've now confirmed and linked back to (via `gh issue comment`) get an "upstream #N" link in their meta line; `ForkFix` gained an optional `upstreamIssues: number[]` field for this (an array, since one PR sometimes fixes several upstream reports and one upstream report is sometimes split across two entries that each fix a different symptom of it).

Nine fixes that were confirmed against upstream issues but had no entry on the page at all are added: ER entity aliases and the `direction` directive (#129, #131), an edge-less subgraph member merging two subgraph frames (#143), `~~~` invisible-link syntax (#144), `:::className` not reaching the rendered `<g>` element (#80), CJK state names and text-embedded edge labels in flowcharts (#43, #32), and ER relationship-label truncation plus a stray box-start tee character (both symptoms of #121). Every new entry's before/after pair is generated the same way as the existing ones — rendered live against the actual pre-fix and current code, not hand-written — and was spot-checked against the real output rather than assumed from the commit message.
