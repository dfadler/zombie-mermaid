---
title: Why zombie-mermaid 2.0 breaks click handlers on purpose
date: 2026-09-10
description: A deliberate, narrowly-scoped breaking change in v2.0.0 removed the inert data-click-callback DOM attribute in favor of a structured parseMermaid().interactions map — here's why it was worth a major version.
---

If you upgraded to `zombie-mermaid@2.0.0` and noticed your `click A call fn()`
bindings stopped firing, this post is for you. It's a deliberate breaking
change, it's small in scope, and it's easy to fix — but it deserves an
explanation, not just a changelog bullet.

## What actually broke

Before 2.0, every flowchart/state node group and every class-diagram class
box carried a `data-click-callback` attribute whenever the diagram source
used Mermaid's `click A call fn()` syntax. It was inert — zombie-mermaid has
never executed anything a diagram supplies, and it still doesn't — but some
consumers were reading that attribute directly off the rendered DOM and using
it to wire up their own click behavior.

As of 2.0.0, that attribute is gone. The `click` directive still parses
correctly, but the callback expression now only shows up as data, through
`parseMermaid(source).interactions` — a `Map<string, NodeInteraction>` keyed
by node id. `NodeInteraction` is now exported from the package root, so it's
a first-class part of the public API rather than something you'd fish out of
the DOM.

If you were relying on `data-click-callback`, the fix is: read the
interaction from the map instead, and bind your own click handler to the
node's existing `data-id` attribute. There's a worked example in the
flowchart Interactions section of [`docs/diagrams.md`](https://github.com/dfadler/zombie-mermaid/blob/main/docs/diagrams.md).

## Why this was worth a major version

Two things pushed this into "major," not "minor":

**It's an observable, breaking API change.** Anything reading
`data-click-callback` off rendered SVG stops working the moment you upgrade.
That's the textbook definition of a breaking change under semver, regardless
of how few people we expected it to affect.

**The old shape encouraged the wrong pattern.** Emitting a raw callback
_expression_ as a DOM attribute nudges a consumer toward `eval`-adjacent
tricks to make it "do something" — exactly the kind of footgun this project
has deliberately avoided since day one (see
[`docs/decisions/no-script-interactivity.md`](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/no-script-interactivity.md):
zombie-mermaid's SVG output stays script-free, full stop). The `interactions`
map keeps the same information available, but as structured data the host is
expected to interpret and act on itself — not something that looks
executable sitting in the markup.

## Where this came from

The change shipped in
[#497](https://github.com/dfadler/zombie-mermaid/pull/497), tracked against
[#216](https://github.com/dfadler/zombie-mermaid/issues/216). It rode along
with a batch of genuinely nice minor additions in the same 2.0.0 release —
OSC 8 terminal hyperlinks for ASCII output, class diagram notes and styling
support, a self-contained `render --html` pan/zoom viewer, strict CSP
support via `nonce`/`styleAttribute`, and a handful of ASCII layout fixes.
None of those forced the major bump; the click-handler change did, on its
own, because it changes behavior for anyone depending on the old attribute.

## If you haven't upgraded yet

This is a one-line audit: search your codebase for `data-click-callback`. If
nothing matches, 2.0.0 is a safe drop-in upgrade. If something does, swap it
for `parseMermaid(...).interactions` and you're done — the underlying data
hasn't gone anywhere, it just moved somewhere safer to consume.
