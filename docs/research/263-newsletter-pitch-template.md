# Newsletter pitch template — draft, not ready to send

Status: **draft template, blocked on data.** Written for
[#263](https://github.com/dfadler/zombie-mermaid/issues/263), which depends on
[#258](https://github.com/dfadler/zombie-mermaid/issues/258) (PR-rescue
campaign) and [#259](https://github.com/dfadler/zombie-mermaid/issues/259)
(recurring "state of the fork" report). As of 2026-09-08 both are **open**
with no numbers published yet — #258 has not merged any upstream PRs, and
#259 has not published a report. **Do not send any pitch built from this
template until both of those have real, citable numbers.** This file only
prepares the mechanics (audience list, pitch skeleton, checklist) so the
actual drafting-and-sending step in #263 is fast once the data exists; it
does not itself constitute a pitch.

## Why this angle, and why it needs numbers first

Per #263: newsletter editors (JavaScript Weekly, TLDR, etc.) want a concrete
hook, not "we forked X." The "maintained fork, stalled upstream" angle only
works with specifics — how many stale PRs got rescued, how many releases
shipped, what notable fixes landed — because the editors this list targets
see generic "we forked X" pitches constantly and filter on verifiable
substance.

## Target list (draft — verify submission guidelines before sending)

| Outlet                | Submission channel                   | Notes                                                                                      |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| JavaScript Weekly     | https://javascriptweekly.com/submit  | Curated by Peter Cooper; wants a one-line "why this matters" plus a link.                  |
| Node Weekly           | https://nodeweekly.com/submit        | Same curator/network as JavaScript Weekly.                                                 |
| TLDR (Web Dev / Tech) | https://tldr.tech/submit             | High volume; short, concrete pitch performs best.                                          |
| Console.dev           | https://console.dev/#suggest         | Developer-tool-focused; likes "what problem this solves" framing.                          |
| Bytes.dev             | https://bytes.dev (contact via site) | Editorial, chattier tone — a plain fact sheet won't fit; adapt tone if targeting this one. |

Verify each outlet's current submission process before using it — newsletter
submission forms and editors change over time, and this table was compiled
without confirming each link resolves to a live, unchanged process.

## Pitch skeleton (fill in bracketed placeholders once #258/#259 have data)

```
Subject: zombie-mermaid — a maintained fork of beautiful-mermaid, [N] stale PRs rescued

Hi [editor name],

beautiful-mermaid (Mermaid-to-ASCII/SVG renderer) has had [N] open PRs
sitting unmerged for months, some over half a year old. zombie-mermaid is a
maintained fork that's merged [N] of them so far, crediting each original
author, and shipped [N] releases since [date].

Concrete numbers as of [date]:
- [N] upstream PRs rescued / merged, credited to original authors
- [N] releases shipped since the fork started
- [1-3 notable fixes/features, one line each]

Link: https://github.com/dfadler/zombie-mermaid
State-of-the-fork report: [link to #259's published report]

Happy to answer questions or provide more detail.

[sign-off]
```

## Pre-send checklist

- [ ] #258 has merged and credited at least one real upstream PR (not just
      reviewed/triaged)
- [ ] #259 has published at least one "state of the fork" report with real
      numbers
- [ ] Every bracketed placeholder above is replaced with a verified, current
      number — not copied from this file's example values
- [ ] Each target outlet's submission link/process re-checked as current
      (links above may have changed)
- [ ] A human has reviewed and approved the actual pitch text before it goes
      out — this is external communication on the project's behalf and is
      out of scope for an agent to send unsupervised

## What this file does not do

This file does not send anything, does not fabricate numbers, and does not
mark #263 as complete — #263 stays open until #258 and #259 produce real
data and a human sends the actual pitches.
