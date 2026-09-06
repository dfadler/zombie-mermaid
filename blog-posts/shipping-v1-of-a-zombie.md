---
title: Shipping v1 of a Zombie
date: 2026-09-06
description: The unglamorous last mile between a patched fork and an npm-installable package — deploy target, attribution, branding, and the release itself — verified against the actual issues, PRs, and tags, not the plan.
---

By 2026-08-27, `zombie-mermaid` had been through a bug audit, a recurring
Unicode fix pattern, and a coverage backlog. None of that makes a package
installable. What was still true that morning: the demo site deployed to a
Cloudflare Pages project named `craft-agents-mermaid`, `package.json` listed
`Craft Docs` as the author, the live demo still said "Beautiful Mermaid by
Craft" in the header, and `registry.npmjs.org/zombie-mermaid` returned a
404. Fixing rendering bugs doesn't touch any of that. This post is about the
nine issues that did, filed and closed inside a single day, and what they
actually decided rather than what they proposed.

## The hosting question comes first, because it blocks a naming decision

The obvious move for the Cloudflare Pages project name
([#184](https://github.com/dfadler/zombie-mermaid/issues/184)) is to rename
`craft-agents-mermaid` to something with `zombie` in it. The issue itself
flags the problem with that: Cloudflare Pages project renames typically mean
creating a new project, which changes the deployed URL. So before touching
the name, a second issue
([#192](https://github.com/dfadler/zombie-mermaid/issues/192)) asked a
question that made the first one moot — does this even need to be
Cloudflare Pages at all?

The answer was no. `pnpm run build:site` produces fully static output:
`index.ts`/`editor.ts` render `index.html`/`editor.html`, plus static assets
copied from `public/`. No server-side rendering, no edge middleware, no KV
or D1 bindings — `wrangler.toml` was three lines with no `functions`
directory. A public repo gets GitHub Pages for free, with the build living
next to the code instead of behind a separate account. #192 explicitly
blocked #184 on this finding, and the PR that actually closed #184
([#193](https://github.com/dfadler/zombie-mermaid/pull/193)) didn't rename
anything — it deleted `wrangler.toml` and moved hosting to GitHub Pages.
The demo now lives at `dfadler.github.io/zombie-mermaid`, and the README's
demo link is that URL, not a Cloudflare one. Sometimes the checklist item
you filed isn't the one that needs solving.

## Attribution: author flips, contributor stays

`package.json` had `"author": "Craft Docs"` with the fork maintainer buried
in a `contributors` array — accurate for a library still labeled as
somebody else's abandoned project, wrong for one about to publish under a
new maintainer's name.
[#185](https://github.com/dfadler/zombie-mermaid/issues/185) laid out the
actual question: does `author` flip now that this fork is the one being
published, and does `LICENSE`'s copyright line need to change too. The
license answer was no — MIT requires keeping `Copyright (c) 2026 Craft
Docs` intact regardless of what `package.json` says, since that's still
their code. The PR that closed the issue
([#191](https://github.com/dfadler/zombie-mermaid/pull/191), titled "Flip
package.json author to fork maintainer") did exactly that: `package.json`
now reads `"author": "Dustin Fadler"` with `"contributors": ["Craft Docs
(original author)"]` — the two fields swapped roles rather than one being
deleted.

## Branding: drop the Craft chrome, keep the credit

The generated demo page carried real Craft-specific branding: a hero titled
"Beautiful Mermaid," a badge linking to `agents.craft.do`, a footer reading
`© 2026 Craft Docs Limited, Inc.`, and a "Use in Craft Agents" call-to-action
button.
[#186](https://github.com/dfadler/zombie-mermaid/issues/186) framed this
correctly as a judgment call, not a bug — the stale/broken links (npm
package name, GitHub org) had already been fixed separately; what was left
was whether the site should keep presenting itself as a Craft product with
a fork footnote, or become `zombie-mermaid`'s own site outright. The closing
PR ([#190](https://github.com/dfadler/zombie-mermaid/pull/190), "Rebrand
demo site as zombie-mermaid, fix stale links") went with the second option.
The README's own "Why This Fork Exists" section states the same call in
prose: "Craft and Craft Agents aren't part of this project's process going
forward; this is an independently maintained continuation" — while keeping
a dedicated Attribution section crediting both `beautiful-mermaid` and the
`mermaid-ascii` engine it's ported from. Rebranding the demo and keeping the
credit are two different decisions, made independently.

## The release: nine changesets became seventy-eight

[#187](https://github.com/dfadler/zombie-mermaid/issues/187) is a
pre-flight checklist, and its most concrete finding wasn't about code: nine
of the previous ten `Release` workflow runs had failed with `GitHub Actions
is not permitted to create or approve pull requests`, because a repo
setting (**Workflow permissions → "Allow GitHub Actions to create and
approve pull requests"**) was off. That's the kind of failure that looks
like a code problem and is actually an off switch nobody had flipped. The
issue also called for linking an npm Trusted Publisher for the
`publish.yml` workflow before the first `pnpm changeset publish` could
succeed at all.

[#188](https://github.com/dfadler/zombie-mermaid/issues/188) then walked
through actually cutting the release: merge the pending Version PR
(`#183`), let that push to `main` trigger the publish workflow, and confirm
the package lands on npm with provenance attached. The Version PR bundled
around 78 pending changeset entries — accumulated across the whole bug-fix
and refactor waves that came before this one, never released because
nothing had shipped yet. That's why the version that actually went out
wasn't `1.0.0`. Checking `package.json` at the merge commit shows
`"version": "1.2.0"`, and `gh release list` confirms it: `v1.2.0`,
published 2026-08-27T18:20:59Z, is the earliest release in this repo's
GitHub Releases — there's no `v1.0.0` or `v1.1.0` entry before it. (Git
tags `v1.0.0` through `v1.1.1` do exist in this repository's history, but
they're dated February 2026, months before the fork's own rebrand commit —
leftovers from whatever came before, not part of this release.) Two minor
version bumps' worth of changesets had queued up waiting for a release
pipeline that could actually run.

## Proving the fork was worth it, then linking to it

Two smaller issues rounded out the release.
[#189](https://github.com/dfadler/zombie-mermaid/issues/189) asked for a
demo page making the fork's case with renders instead of README prose —
paired before/after examples of diagrams that used to fail against
upstream and now don't. The closing PR
([#211](https://github.com/dfadler/zombie-mermaid/pull/211), "Add a 'What
this fork fixes' before/after demo page") shipped that page by rendering
the same Mermaid source against the pre-fix commit and current `main`,
rather than hand-describing what the bug looked like.
[#194](https://github.com/dfadler/zombie-mermaid/issues/194) then added the
GitHub Pages link to the README once #193's deploy was confirmed live
([#196](https://github.com/dfadler/zombie-mermaid/pull/196), "Add live demo
link to README") — the badge near the top of the README today points at
`dfadler.github.io/zombie-mermaid`, not the retired Cloudflare URL.

## Even the demo site accumulated tech debt this fast

Here's the part that surprised me most, reviewing this after the fact.
While issue #189 was still open, `index.ts` — the script that generates
that demo page — had already grown into a single 1775-line file, and
essentially the entire thing was one function.
[#195](https://github.com/dfadler/zombie-mermaid/issues/195) caught it: an
`async function generateHtml()` starting at line 64 ran nearly to the end
of the file, with roughly 880 lines of CSS and 500 lines of hand-written
browser JavaScript both living as JS template-literal strings inside it —
no stylelint, no type-checking, no editor support for either.

I checked that 1775-line number against git history rather than taking the
issue's word for it, and it holds up exactly: `index.ts` at commit
`efba4fa` — the state of the file when #195 was filed on the morning of
2026-08-27 — is 1775 lines by `wc -l`, function body running from line 64
to line 1768. (By the time the fix actually merged that evening, a
different PR had landed in between and grown the file to 2132 lines; the
issue's number describes the file as it stood when someone actually looked
at it, which is the right thing for an issue to describe.) The fix
([#210](https://github.com/dfadler/zombie-mermaid/pull/210)) split the
single function into `demo/client.ts` (878 lines, now a real TypeScript
file bundled with esbuild the same way `src/browser.ts` already was) and
`demo/styles.css` (1069 lines, now linted like any other stylesheet),
leaving `index.ts` itself at 542 lines of templating and orchestration.
Three files, each doing one job, replacing one file doing three.

The lesson isn't really about this specific function. It's that "the demo
site" was never a side project exempt from the standards applied to the
rendering engine. A generator script accumulated the same kind of
undifferentiated one-function sprawl that a parser or a renderer would,
inside a project that had, by this same week, already shipped a coverage
gate and a lint config for its actual library code. Tech debt doesn't check
whether the file it's accumulating in is "the important part."

## The order, not just the list

None of this happened before the fork had earned it. The
[bug audit](https://github.com/dfadler/zombie-mermaid/issues/519) came
first and produced the fifteen fixes the before/after demo page shows off.
The refactor waves came next. Only then did branding, attribution, and a
release make sense to spend a day on — a demo site worth linking to and a
package worth publishing, not a placeholder for either. Nine issues, one
calendar day, and the actual output is boring in the way release
engineering should be: a project that says what it is, credits what it's
built on, and answers `npm install zombie-mermaid` with a real package
instead of a 404.
