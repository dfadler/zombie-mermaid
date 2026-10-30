# Promotion strategy

Status: proposal (the maintainer has not decided; questions are in "Open questions")

Tracks [#1576](https://github.com/dfadler/zombie-mermaid/issues/1576), part of
[#1502](https://github.com/dfadler/zombie-mermaid/issues/1502) and workstream
[#1950](https://github.com/dfadler/zombie-mermaid/issues/1950). Facts are checked
as of 2026-10-29; each names its source. Nothing here posts to, or contacts,
anyone.

## Context

[#1576](https://github.com/dfadler/zombie-mermaid/issues/1576) waited on the
objective. That is now accepted: **the best Mermaid renderer for terminals and
agents** ([project-objective-1564.md](project-objective-1564.md)). Promotion is
therefore judged by one question: does a channel put zombie-mermaid in front of
people who render Mermaid in a terminal or inside an agent, and does it do so
without costing trust?

Where things stand:

- **Reach is small.** 17 stars (GitHub API, 2026-10-29). `zombie-mermaid` had 4,921
  npm downloads in the 30 days to 2026-10-28; `beautiful-mermaid` had 2,354,273
  ([npm API](https://api.npmjs.org/downloads/point/last-month/zombie-mermaid)).
  npm counts include mirrors and CI installs. Downloads and integrator adoption are
  the yardstick, not stars ([#1950, first comment](https://github.com/dfadler/zombie-mermaid/issues/1950)).
- **Upstream's stars were one event a fork cannot replay.** A third party
  (`mellosouls`) submitted it to Hacker News on 2026-01-29: 418 points
  ([HN 46804828](https://news.ycombinator.com/item?id=46804828), verified via the
  Algolia API on 2026-10-29). The hook was "in your terminal", which is this
  project's stated objective. **#260 cites a different item,
  [47169523](https://news.ycombinator.com/item?id=47169523)**: that is a 2-point
  "Beautiful Mermaid" post by `tosh` on 2026-02-26, not the front-page one. The #260
  premise ("front page") is wrong and must be fixed before any draft quotes it.
- **The trust items are done.** Repo metadata
  ([#1951](https://github.com/dfadler/zombie-mermaid/issues/1951)), dated facts in
  place of "dead" ([#1952](https://github.com/dfadler/zombie-mermaid/issues/1952);
  `README.md` "Why This Fork Exists"), the migration block
  ([#1953](https://github.com/dfadler/zombie-mermaid/issues/1953);
  [migrating-from-beautiful-mermaid.md](../migrating-from-beautiful-mermaid.md)) and
  the provenance statement ([#1954](https://github.com/dfadler/zombie-mermaid/issues/1954);
  [provenance.md](../provenance.md)) are closed. The prismantis#13 reply
  ([#1955](https://github.com/dfadler/zombie-mermaid/issues/1955)) was closed as not
  planned: they closed their issue on 2026-10-17 and chose their own renderer. The
  outreach rules ([#1956](https://github.com/dfadler/zombie-mermaid/issues/1956),
  closed) are in [outreach-rules.md](../promotion/outreach-rules.md), still headed
  "draft for maintainer review".
- **The competitive picture changed.** marp-core#441/#442 propose replacing
  beautiful-mermaid with Obsidian's Pele, which claims all Mermaid 12.1.0 diagram
  types ([#1959 draft](https://github.com/dfadler/zombie-mermaid/issues/1959),
  2026-10-22; not re-checked since). Breadth is not where this project wins. The
  terminal and agent surface (CLI, MCP server, ASCII for eight types) is.
- **Prep exists, nothing is sent.** Read-only prep with entry texts is on
  [#1957](https://github.com/dfadler/zombie-mermaid/issues/1957),
  [#1958](https://github.com/dfadler/zombie-mermaid/issues/1958),
  [#1959](https://github.com/dfadler/zombie-mermaid/issues/1959) and
  [#1960](https://github.com/dfadler/zombie-mermaid/issues/1960); the repo-side
  changes landed in [#2277](https://github.com/dfadler/zombie-mermaid/pull/2277)
  (merged).
- **Drafts on branches are not in the tree.** `docs/promotion/` holds only
  `outreach-rules.md`, `upstream-pr-seen.json` and the frozen
  `258-pr-rescue-candidates.md`. The Show HN draft (PR #887, open) and the
  awesome-list targets (PR #888, closed 2026-10-29 and deferred) are not on `main`.

## Decision

### Ranking rule

Rank by fit to the objective, then by trust risk, then by effort. A channel ranks
high when its audience is already looking for a terminal or agent renderer and the
act is on a surface we own or a directory built for submissions. It ranks low when it
asks a stranger for attention, or compares us with a project that has more reach.

### Ranked channels

| Rank | Channel                                                                                                   | Fit to objective                           | Trust risk                  | Effort     | Tracking                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1    | Agent-skill directories: `npx skills add` is auto-indexed by skills.sh and already live                   | Direct (agents)                            | None                        | None       | [#1957](https://github.com/dfadler/zombie-mermaid/issues/1957)                                                               |
| 2    | MCP directories: official MCP Registry, then Glama claim and the free mcpservers.org form                 | Direct (agents)                            | Low                         | S to M     | [#1958](https://github.com/dfadler/zombie-mermaid/issues/1958)                                                               |
| 3    | One integrator with a real terminal path: `comarkdown/comark` (`@comark/ansi` calls `renderMermaidASCII`) | Direct (terminals)                         | Medium: a third-party issue | S          | [#1959](https://github.com/dfadler/zombie-mermaid/issues/1959)                                                               |
| 4    | Bug-specific upstream-thread notes, under the outreach rules                                              | Indirect                                   | Medium                      | S per note | [#258](https://github.com/dfadler/zombie-mermaid/issues/258)                                                                 |
| 5    | A single newsletter pitch (Changelog News)                                                                | Indirect, one-off                          | Medium                      | S          | [#1960](https://github.com/dfadler/zombie-mermaid/issues/1960)                                                               |
| 6    | Show HN                                                                                                   | Reach, but only with a terminal/agent hook | High                        | M          | [#260](https://github.com/dfadler/zombie-mermaid/issues/260)                                                                 |
| 7    | Awesome lists (generic diagramming lists)                                                                 | Low                                        | Low                         | S          | [#262](https://github.com/dfadler/zombie-mermaid/issues/262), [#1790](https://github.com/dfadler/zombie-mermaid/issues/1790) |

Why this order:

1. **Directories for agents and MCP come first** because they reach the exact
   audience in the objective, need no pitch, and the facts they ask for are in the
   repo already. skills.sh needs nothing more: `zombie-mermaid` is already listed
   (1 install, probably ours) and ranks by real installs, which must not be inflated
   ([#1957](https://github.com/dfadler/zombie-mermaid/issues/1957) prep).
2. **MCP registry listing** is a release-ordered task: `package.json` needs
   `mcpName` in the _published_ tarball and `server.json`'s version must match that
   release ([#1958 prep](https://github.com/dfadler/zombie-mermaid/issues/1958)).
   `mcpName` was added in #2277 (merged), and `npm view zombie-mermaid mcpName` on
   2026-10-29 returns `io.github.dfadler/zombie-mermaid` for 5.11.2, so that
   precondition now holds; `server.json` is still not in the repo. The login is a GitHub device-flow by the owner, not by an agent.
   PulseMCP ingests from the registry, but its submissions were paused as of
   2026-09-03 (prep, not re-checked); do not chase it.
3. **Comark is the one integrator worth a note.** It is a real terminal consumer, and
   pie, C4 and architecture render as ASCII here and fall back to source there
   (#1959 prep, verified 2026-10-22 on Node 22.22.1; this project requires Node 24
   or newer). The other prospects are dropped or held: Marp is leaving; Slidev only
   shows an example in docs; fumadocs and Kami have no code path to swap;
   `vue-stream-markdown` and the Raycast extension need changes on their side and
   fit the objective less (#1959 prep).
4. **Upstream notes stay on, tightly.** They are the one channel that has
   produced stars, but 6 of the 10 most recent upstream comments were ours
   (#1950 report), so the rules in [outreach-rules.md](../promotion/outreach-rules.md)
   bind: bug-specific, disclosed, no pitch, one per thread, capped per week.
5. **A newsletter and Show HN rank low** because neither is replayable (see
   Context) and both ask a stranger's attention for a project with 17 stars. They
   become worth sending when there is something to show that the directories and the
   objective produce: see the gates below.
6. **Generic awesome lists rank last.** They serve a "diagramming" audience, not a
   terminal or agent one, and the best-fit agent list refuses us today (below).

### What is gated, and why

Every item below also needs the maintainer's go for that exact text, per rule 1 of
[outreach-rules.md](../promotion/outreach-rules.md). The gates add to that.

| Item                                                                                                       | Gate                                                                                                                                                                                                                                                                                                                                                                                                        | Why                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Any post to a third-party repo, form or list                                                               | Maintainer go on the exact text; an agent never posts                                                                                                                                                                                                                                                                                                                                                       | Outreach rule 1; also covers account creation and any email entry                                                     |
| MCP Registry publish                                                                                       | `server.json` version equal to the released version (5.11.2 carries `mcpName`); the `packageArguments` entry validated against the schema (the prep drafted it from memory)                                                                                                                                                                                                                                 | The registry rejects a mismatch; a listed server invites use                                                          |
| Glama claim, Smithery                                                                                      | Glama: confirm which claim method its dialog asks for. Smithery: **a decision to build a `.mcpb` bundle**, which is a new release surface                                                                                                                                                                                                                                                                   | Docs conflict (Glama); extra artifact to maintain (Smithery)                                                          |
| VoltAgent/awesome-agent-skills                                                                             | Real adoption (its CONTRIBUTING says brand-new skills are not accepted)                                                                                                                                                                                                                                                                                                                                     | A decline sits on record; submit later, not now ([#1957 prep](https://github.com/dfadler/zombie-mermaid/issues/1957)) |
| Generic awesome lists (#262)                                                                               | [#1790](https://github.com/dfadler/zombie-mermaid/issues/1790): re-verify each target, since the PR #888 draft is a month old and was never merged                                                                                                                                                                                                                                                          | Targets were checked once, in September                                                                               |
| Skill evals                                                                                                | [#1607](https://github.com/dfadler/zombie-mermaid/issues/1607) (open) before inviting installs                                                                                                                                                                                                                                                                                                              | A listed skill with no checks is a trust risk                                                                         |
| Comark note                                                                                                | Maintainer approval of the draft; the claims in it must name the Mermaid version they were checked against (the draft uses 12.1.0 while the pin is 12.2.0 per the objective doc)                                                                                                                                                                                                                            | CLAUDE.md "Parity with mermaid.js"; the scorecard has not been re-run on 12.2.0                                       |
| Changelog News pitch                                                                                       | Reconcile the fix count (README says 55; the draft says 53; `grep -c "id: '" demo/fork-fixes-data.ts` gives 55); fix the "latest release" wording (npm shows 1.1.3, README says v1.1.2); decide against Pele's pitch (Open question 2)                                                                                                                                                                      | A pitch with a wrong number costs more than silence                                                                   |
| Show HN                                                                                                    | (a) Maintainer decides it is in scope; (b) a hook tied to the objective: terminal and agent output, with a verifiable result such as [#1592](https://github.com/dfadler/zombie-mermaid/issues/1592) (open); (c) every number in the draft refreshed ([#1789](https://github.com/dfadler/zombie-mermaid/issues/1789)); (d) the HN item in #260 corrected; (e) the post is the maintainer's own public action | The thread that made upstream scrutinised attribution of the ASCII engine; a thin "we fixed bugs" post will not hold  |
| Asking Craft for a pointer or deprecation ([#1961](https://github.com/dfadler/zombie-mermaid/issues/1961)) | Craft responds first; outreach rules list it as out of bounds                                                                                                                                                                                                                                                                                                                                               | `npm deprecate` is owner-only, and this carries the highest etiquette risk                                            |
| claude-rich-terminal ([#1522](https://github.com/dfadler/zombie-mermaid/issues/1522))                      | Stays on hold until [#2253](https://github.com/dfadler/zombie-mermaid/issues/2253) closes (maintainer decision, 2026-10-21)                                                                                                                                                                                                                                                                                 | Point them at fixed behaviour only                                                                                    |

### What is not pursued

- **A competitive reply on adewale/agentic-mermaid#303.** The re-run is done
  ([#1523](https://github.com/dfadler/zombie-mermaid/issues/1523), closed, nothing
  posted). It stays unposted unless asked: it is a rival's thread, and the outreach
  rules allow a comparison nowhere.
- **A star-history badge** ([#256](https://github.com/dfadler/zombie-mermaid/issues/256),
  PR [#1152](https://github.com/dfadler/zombie-mermaid/pull/1152)) until the curve
  shows something. At 17 stars it shows nothing.
- **Marp, Slidev, fumadocs, Kami.** See rank 3.
- **Paid placement** (mcpservers.org Premium, $39): not without a decision.

### Success measure

Per-package npm downloads and the count of dependents that name zombie-mermaid,
read monthly from the schedule recorded by
[#1520](https://github.com/dfadler/zombie-mermaid/issues/1520) (closed), with the
mirror/CI caveat stated each time. Stars are reported but not a goal. The 30-day
figure of 4,921 (2026-10-28) is the baseline. No target is set: the research found no
sourced time-to-traction for a small fork and says to expect months to years.

### Disposition of the stale issues (#1561)

These are proposals; the maintainer applies them.

| Issue                                                                                                                          | Proposal                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#268](https://github.com/dfadler/zombie-mermaid/issues/268) umbrella                                                          | Keep open, linking this doc, until ranks 1 and 2 are done; then close                                                                                                         |
| [#256](https://github.com/dfadler/zombie-mermaid/issues/256) star-history                                                      | Keep deferred; merge or close PR #1152 with it                                                                                                                                |
| [#258](https://github.com/dfadler/zombie-mermaid/issues/258) PR-rescue                                                         | Keep; the remaining work is a re-count of upstream's open PRs and diffs against what is ported. "Merged in zombie-mermaid" comments follow the outreach rules, not a campaign |
| [#260](https://github.com/dfadler/zombie-mermaid/issues/260) Show HN                                                           | Keep open as gated; correct the HN item in its body                                                                                                                           |
| [#262](https://github.com/dfadler/zombie-mermaid/issues/262) awesome lists                                                     | Keep open as gated on #1790 and adoption; PR #888's closure stands                                                                                                            |
| [#1957](https://github.com/dfadler/zombie-mermaid/issues/1957), [#1958](https://github.com/dfadler/zombie-mermaid/issues/1958) | Proceed, after the go on each submission                                                                                                                                      |
| [#1959](https://github.com/dfadler/zombie-mermaid/issues/1959)                                                                 | Narrow to Comark; drop the rest of the list                                                                                                                                   |
| [#1960](https://github.com/dfadler/zombie-mermaid/issues/1960)                                                                 | Hold (Open question 2)                                                                                                                                                        |
| [#1961](https://github.com/dfadler/zombie-mermaid/issues/1961)                                                                 | Hold; do not draft until Craft acts                                                                                                                                           |

No issue is closed as not planned without the maintainer's review.

## Open questions

For the maintainer. Each has a recommended answer.

1. **Is Show HN in scope, and what triggers it?** Recommended: yes, later, only
   with the objective's hook and the gates above; not as a repeat of the upstream
   launch.
2. **Send the Changelog News pitch now, or hold?** The #1960 prep recommended hold
   because of Pele. Recommended: hold until the fix count and release wording are
   reconciled and [#1592](https://github.com/dfadler/zombie-mermaid/issues/1592)
   has numbers; then send once, to one outlet.
3. **Approve publishing to the official MCP Registry?** It needs your GitHub login
   and a `server.json` matching the release. Recommended: yes, after the
   `packageArguments` entry is validated.
4. **Build a `.mcpb` bundle for Smithery?** It adds a release artifact.
   Recommended: no, until the registry listing shows demand.
5. **Approve the Comark issue text?** Recommended: yes after re-checking it against
   the current release and naming the Mermaid version for the fidelity claim.
6. **Confirm the outreach-rules numbers** (2 per week, 1 per day, 7-day wait),
   which the rules call a proposal, and move that doc's status out of "draft".
7. **Adoption threshold for the agent-skill lists.** Recommended: do not set a
   number now; revisit when installs are not trivial.
8. **Drop [#1961](https://github.com/dfadler/zombie-mermaid/issues/1961)?**
   Recommended: leave open but unscheduled.
9. **Is the MCP server still labelled experimental when it is listed?**
   Recommended: yes, say so in the entries (the README does).

## Consequences

- Ranks 1 and 2 give the next few weeks of work, all on surfaces the project owns or
  directories built for submissions. Nothing needs an unsolicited message to a stranger.
- Loud launches (rank 5 and 6) wait on conditions that can be checked, not on a date.
- This doc changes no code, README, issue or outreach rule. The disposition table
  and gates take effect only when the maintainer accepts them.
- Risk: an audience that finds the project through a directory and meets a gap.
  The listed facts (Node 24 or newer, elkjs registration in browsers, no gantt,
  mindmap or timeline) must stay in the entries, per the prep drafts.

## Self-review (checklist 977)

Run against the draft, 2026-10-29:

- **Degenerate inputs.** If no gate ever opens, ranks 1 and 2 still stand alone and
  nothing else is scheduled; if no directory accepts us, the measure stays
  downloads. If a channel is _unreachable_ (mcpservers.org returned 403 to the prep
  fetcher, LobeHub 403, PulseMCP paused), the doc treats it as unverified, not
  absent.
- **Boundary arithmetic.** The outreach cap is quoted as the rules state it (2 per
  week, 1 per day, 7-day wait); this doc sets no new number. Fix counts: 55 (grep,
  README), 53 (prep draft), 35 (a merged PR text per the prep); the doc uses 55 and
  flags the others.
- **Ambiguous terms.** "Adoption" means installs and dependents that name
  zombie-mermaid, not stars. "Trust items" means #1951 to #1956. "Fixed" Mermaid
  version means the one a claim names; none is assumed.
- **Sub-issue scope claims.** #1959 is narrowed to Comark on the strength of a
  prep table, not a fresh check; #1958's registry steps depend on #2277 being in a
  release; checked against npm (5.11.2 has `mcpName`).
- **Cited precedent.** Checked against the source on 2026-10-29: the HN items
  (Algolia API: 46804828 is 418 points, 47169523 is 2 points), the download counts
  (npm API), the PR and issue states (`gh`), and the outreach rules and objective
  doc (read). The Pele/Marp, directory and Comark facts are quoted from
  prep comments dated 2026-10-22 and were not re-fetched; they are labelled so.
