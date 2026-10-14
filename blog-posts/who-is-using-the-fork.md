---
title: Who Is Using the Fork? What We Can and Cannot See
date: 2026-10-14
description: 18 GitHub stars, about 2,600 npm downloads per package in 20 days, one public benchmark and one vendored copy. What those numbers show, what they do not, and why there is no telemetry.
---

> AI-drafted for owner review. Nothing here is published until the pull request
> is merged.

Since the last post on 2026-09-24 I have been asking a plain question: who is
using this? I can answer part of it from public sources. This post gives those
numbers with their dates, the two outside projects I found, and a list of what
I cannot see. The honest summary is that the numbers are small and I do not
know much about the people behind them.

## GitHub

All of this was read from the GitHub API on 2026-10-14.

| Metric                 | Value |
| ---------------------- | ----- |
| Stars                  | 18    |
| Forks                  | 0     |
| Watchers               | 0     |
| Stars as of 2026-09-24 | 10    |
| Stars added since      | 8     |

The star dates come from the stargazers endpoint with timestamps: the first
star is 2026-08-26, and the eight newest are dated 2026-09-29, 2026-10-02
(three), 2026-10-08 (two), 2026-10-09 and 2026-10-12. The API only lists
accounts that currently star the repository, so anyone who starred and then
removed the star is invisible. Eighteen stars is a small number and I would
not read a trend into it.

## npm

Downloads from the npm downloads API (`api.npmjs.org/downloads/point/`), for
the 20 days from 2026-09-24 to 2026-10-13 inclusive. 2026-10-14 is left out
because the day is not finished.

| Package                          | Downloads, 2026-09-24 to 2026-10-13 | Latest version |
| -------------------------------- | ----------------------------------- | -------------- |
| `zombie-mermaid`                 | 2,587                               | 5.3.0          |
| `@zombie-mermaid/core`           | 2,960                               | 5.3.0          |
| `@zombie-mermaid/svg-renderer`   | 2,615                               | 5.3.0          |
| `@zombie-mermaid/ascii-renderer` | 2,602                               | 5.3.0          |
| `@zombie-mermaid/mermaid-parser` | 2,592                               | 5.3.0          |
| `@zombie-mermaid/mcp`            | 2,348                               | 5.3.0          |

For the week 2026-10-06 to 2026-10-12 the same packages show 1,457 to 1,704
downloads each.

These are not users. Several things push the numbers up without anyone
choosing the package:

- Registry mirrors and security scanners fetch every new version. The
  `zombie-mermaid` package had 14 versions published in the window, and the
  per-package totals are all in the same range (2,348 to 2,960), which fits
  installs and fetches that pull the whole set at once. That is an inference,
  not something the API shows.
- CI runs reinstall dependencies on every job. One project with a busy
  pipeline can add a lot of downloads without adding a single user.
- My own machines and CI may install these packages too. I cannot separate
  those from the totals.

Downloads also say nothing about whether a package was used after it was
installed. I have no earlier baseline to compare against, so I cannot say
whether the numbers are growing.

## Two public mentions

I looked for projects that depend on the fork, using only public sources. On
2026-10-10 I searched GitHub code for `zombie-mermaid` and `@zombie-mermaid`,
and tried the dependents views for the repository and for npm. GitHub's
"Used by" API returned 404 for this repository and I did not find a usable
public npm dependents list. The code search found:

- One project that vendors the ASCII renderer. The
  [claude-rich-terminal](https://github.com/xiaolai/claude-rich-terminal)
  plugin bundles `@zombie-mermaid/ascii-renderer` 4.0.0 (with the core and
  parser packages at 4.0.0) into one vendored file, and its notices file lists
  the licence and a local patch to how entity relationships are drawn in ER
  diagrams. Today's release is 5.3.0. The attribution is correct. I have not
  contacted the project and have not been in touch with its maintainer.
- A first-party plugin of mine, `payload-plugin-mermaid`, which does not count
  as an outside user.
- A catalog entry in a third repository that lists the plugin above. That is a
  listing, not a dependency.

I found no other outside dependents or vendored copies. Code search misses
private repositories, minified bundles, and anything GitHub has not indexed, so
this is a floor and not a count.

## One public benchmark

A public issue,
[adewale/agentic-mermaid#303](https://github.com/adewale/agentic-mermaid/issues/303),
compares how several Mermaid renderers handle invalid colors, and includes
"Zombie Mermaid 2.2.6" among them. It is open as of 2026-10-14. I did not take
part in it and I have not commented on it. Its existence is not an endorsement
of this project by anyone, and I am not claiming one.

The report's gap about us still holds. On 2026-10-10 I re-ran the cases it lists
against `zombie-mermaid` 5.0.1, using a small script of my own that calls
`renderMermaidSVG` and `renderMermaidASCII`. I did not run the benchmark's own
code and I did not render in a browser, so "paints black" below repeats the
issue's description of how browsers treat an invalid color rather than
something I observed.

- An unknown color word in `style`, `classDef` or `linkStyle` is still written
  into the SVG as-is, in 8 of the 9 placements tested. On 2.2.6 it was 7 of 9.
- The one that changed is state diagram `classDef`: 2.2.6 ignored a bad color
  and 5.0.1 emits it. That is the wrong direction, because Mermaid ignores it.
- Bad values in `themeVariables` never reach the SVG. They are dropped without
  an error.
- ASCII output renders every case without throwing.

So the most useful thing that outside report gave me is a list of something
still wrong. I have not decided between ignoring an invalid declaration, as
Mermaid does, and refusing it with a named error. I have not fixed it.

## What we cannot see

- **npm downloads are not users.** See above: mirrors, scanners and CI all
  count. I cannot tell a person from a bot.
- **There is no telemetry.** I have not added any usage reporting to the
  libraries or the CLI. The price is that I learn about use only when
  someone tells me, files an issue or happens to be public.
- **Private use is invisible.** Companies and individuals who install from npm
  and never mention it do not show up anywhere.
- **Stars are a weak signal.** They record interest at one moment. Unstars are
  invisible to me and at least some stargazers also report bugs on the
  upstream project, which suggests they were looking at the fork, not
  committing to it.
- **Silence is not satisfaction.** Most people who hit a problem do not file an
  issue. The reports I get are the ones from the people who were willing to.

I will not guess at who is behind the numbers, and I will not name anyone based
on a download count or a star.

## Why it matters that this is one maintainer

This project is a fork of upstream beautiful-mermaid, and it is maintained by
one person. If
you are deciding whether to depend on it, the relevant facts are public and
checkable. The code is MIT, the history is on GitHub, the packages are on npm
with their versions and dates, and the layout and ASCII work is tested in the
repository. I have an open issue,
[#1954](https://github.com/dfadler/zombie-mermaid/issues/1954), to write a
provenance and continuity statement. It does not exist yet, so I am not
pointing you to one.

If you do depend on the fork, the most useful thing you can do is tell me what
you use it for, in an issue, a discussion or a PR. If you are the vendored copy
above, upgrading from 4.0.0 would pick up everything since, and I would like
to know whether your ER patch is still needed on 5.3.0. I will not hold you to
it, and nothing here asks you to do anything.

## Where this leaves things

18 stars, 0 forks, roughly 2,600 npm downloads per package in 20 days that I
cannot attribute to people, one project vendoring an old version, and one
benchmark that is open and that we do not fully pass. I will revisit these
numbers with the same method and the same ranges in a later post, so that the
comparison is against something.
