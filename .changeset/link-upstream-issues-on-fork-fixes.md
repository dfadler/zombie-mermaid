---
'zombie-mermaid': patch
---

Demo-site only: link the "What this fork fixes" page to the upstream issues it resolves, and add 9 new before/after entries.

The page named a commit and a PR for each fix but never mentioned the upstream `lukilabs/beautiful-mermaid` issue it traces back to, so a reader following a link from an upstream issue had no way to find the corresponding entry. We recently confirmed and commented on 25 fixed upstream issues (via `gh issue comment`); 23 of those trace to a renderer bug this page can demonstrate with a before/after diagram, and each now gets an "upstream #N" link in its entry's meta line. (The other 2 — #45 and #73 — are packaging/build fixes with no diagram to show, so they're not on this page at all.) `ForkFix` gained an optional `upstreamIssues: number[]` field for this (an array, since one PR sometimes fixes several upstream reports and one upstream report is sometimes split across two entries that each fix a different symptom of it).

Nine fixes that were confirmed against upstream issues but had no entry on the page at all are added: ER entity aliases and the `direction` directive (#129, #131), an edge-less subgraph member merging two subgraph frames (#143), `~~~` invisible-link syntax (#144), `:::className` not reaching the rendered `<g>` element (#80), CJK state names and text-embedded edge labels in flowcharts (#43, #32), and ER relationship-label truncation plus a stray box-start tee character (both symptoms of #121). Every new entry's before/after pair is generated the same way as the existing ones — rendered live against the actual pre-fix and current code, not hand-written — and was spot-checked against the real output rather than assumed from the commit message.
