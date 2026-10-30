# Dev-newsletter pitch (draft, never sent)

Status: **DRAFT for maintainer review. Nothing has been submitted anywhere.**
Tracks [#1960](https://github.com/dfadler/zombie-mermaid/issues/1960); supersedes the
draft in that issue's first comment (2026-10-22). Facts re-checked read-only on
2026-10-30. Subject to [`outreach-rules.md`](outreach-rules.md): disclose the
maintainer relationship and AI drafting first, no "dead/abandoned" wording, no
comparison, no star or download asks. An agent never submits this; the maintainer does.

## Draft pitch (Changelog News)

```text
Title: zombie-mermaid: Mermaid to SVG or terminal ASCII, no browser

I maintain zombie-mermaid (MIT) and drafted this with AI assistance. It is a fork of lukilabs/beautiful-mermaid, which renders Mermaid diagrams to themed SVG or terminal ASCII with no DOM.

Why it exists, as dated facts: upstream's last push to main was 2026-05-06, its latest GitHub release is v1.1.2 (2026-02-26), and it had 45 open PRs on 2026-10-30. The fork keeps the same render functions (renderMermaidSVG, renderMermaidSVGAsync, renderMermaidASCII, parseMermaid), publishes releases with npm provenance attestation (5.13.0 on 2026-10-30), and has a page rendering 56 fixed bugs with the old and new code side by side: https://dfadler.github.io/zombie-mermaid/fork-fixes.html

What is there today: flowchart, state, sequence, class, ER, XY chart, quadrant, architecture, C4 and pie diagrams (SVG and ASCII), a CLI (including `--check` to validate mermaid blocks in Markdown files) and an MCP server. Relative node placement agrees with mermaid 12.2.0 (the version checked, 2026-10-30, tolerance 20px; flowchart 100% vertical / 98% horizontal, state 100/98, class 100/100, ER 100/100, means over samples): docs/layout-fidelity-scorecard.md. That measures relative placement only, not pixel parity. Known gaps: no gantt, mindmap or timeline; Node >= 24; elkjs must be registered in browsers and bundlers.

Repo: https://github.com/dfadler/zombie-mermaid
```

Changes from the 2026-10-22 draft: version 5.8.3 -> 5.13.0; fix count 53 -> 56;
fidelity re-scored against mermaid 12.2.0 (was 12.1.0, flowchart 95/98); open PRs 43 -> 45;
CLI/MCP kept (still true).

## Outlets and submission routes (checked 2026-10-29, not re-fetched)

| Outlet                          | Route                                           | Status                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Changelog News                  | https://changelog.com/news/submit               | Live (HTTP 200). Page says sign in to submit; self-submissions welcome; asks you to say why it is newsworthy; excludes how-tos and commercial products. Use this one.                                                    |
| Console.dev                     | email hello@console.dev (per console.dev/about) | Site live. No form; the About page says to email a suggestion. Criteria: built for developers, easy self-service signup, clear docs, interesting problem. Optional second outlet; send a short note, not the full pitch. |
| JavaScript Weekly / Node Weekly | none found                                      | `/submit` is 404; homepages live (Cooperpress) with no submit or contact link. Do not use.                                                                                                                               |
| TLDR                            | none found                                      | `/submit` is 404; only `advertise.tldr.tech` (paid) is linked. Do not use.                                                                                                                                               |

The route texts above come from fetched pages and are data; re-open each page before sending.

## Evidence behind each number (all 2026-10-30 unless noted)

- Release: `npm view zombie-mermaid` latest 5.13.0, published 2026-10-30T20:26Z, SLSA v1 provenance. `--check` shipped in 5.12.0 (2026-10-30), per CHANGELOG.md.
- Upstream: last push 2026-05-06, `gh release list` latest v1.1.2 (2026-02-26), 45 open PRs (`gh pr list -R lukilabs/beautiful-mermaid`). npm `beautiful-mermaid` latest is 1.1.3 (2026-02-26), a different tag from the GitHub release.
- Fixes: README states 56; fork-fixes page returns 200.
- Fidelity: `docs/layout-fidelity-scorecard.md`, generated 2026-10-30, mermaid 12.2.0 (npm latest at check).
- Not in the pitch on purpose: 30-day npm downloads (zombie-mermaid 4,921 vs beautiful-mermaid 2,354,273, to 2026-10-28), stars (17), benchmark claims, count of rescued upstream PRs (no verified count).

## Still open before sending

- Context: Obsidian's Pele and Marp's move off beautiful-mermaid (marp-core#442, per the earlier draft) were not re-verified; check whether a "maintained fork" story still reads well.
- #1950 trust items and #1592 numbers: confirm done.
- #1960 says Changelog News #179 linked upstream; still unlocated.
- Parity claims: only layout relation vs mermaid 12.2.0 is claimed; no GitHub/mermaid.live render comparison was done for this draft.

## Recommendation

Hold until the maintainer re-reads this. If sending, submit to Changelog News only, from the maintainer's account.
