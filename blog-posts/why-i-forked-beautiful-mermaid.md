---
title: "zombie-mermaid: why I forked beautiful-mermaid, what I've fixed, and where it's going"
date: 2026-09-10
description: Why I forked a stalled beautiful-mermaid, a tour of what's been fixed and added since, and the process that keeps this fork actually maintained rather than just claiming to be.
---

`beautiful-mermaid` is a genuinely good library. It renders Mermaid diagrams
as fast, beautiful SVGs or plain-terminal ASCII art, with real theming and
zero DOM dependencies — the kind of tool that's obviously well-designed from
the first time you use it. That's exactly why I didn't want to see it die.

## Why I forked it

By the time I forked it, upstream development had stalled: dozens of
[pull requests](https://github.com/lukilabs/beautiful-mermaid/pulls) were
sitting open, some for over half a year, and nothing had merged in months.
By most practical definitions, the project was dead — not abandoned in name,
just abandoned in practice. Good bug fixes were queued up and going nowhere.
Nobody was cutting releases.

So I started `zombie-mermaid`: the fork that won't stay buried. Same MIT
license, same foundation, same credit to the original authors (including the
ASCII rendering engine's origins — see the Attribution section of the
[README](https://github.com/dfadler/zombie-mermaid#attribution)). What's
different is that it actually ships. I pull in fixes that were stuck in the
upstream queue, fix bugs upstream never got to, and cut releases on a real
cadence instead of letting them pile up.

Note for anyone wondering: Craft and Craft Agents aren't part of this
project's process going forward. This is an independently maintained
continuation, on my own time and my own judgment calls about what ships.

## What's actually been fixed

I didn't want "maintained fork" to be a marketing claim I couldn't back up,
so every fix in the project gets rendered through the actual pre-fix and
post-fix code and shown as a before/after — see
[**what this fork fixes**](https://dfadler.github.io/zombie-mermaid/fork-fixes.html)
for the visual evidence, not just a changelog description.

Since the fork started, that's added up to a lot of ground covered. A few
representative examples:

- **`classDef`/`class` styling had several sharp edges** — a trailing
  semicolon on a `class` statement produced a phantom node; `:::className`
  before a node's shape brackets silently dropped the entire label; custom
  classes never made it onto the SVG's `class` attribute, so external CSS
  had nothing to select; and a custom fill with no explicit text color could
  render unreadable. All fixed by v1.3.0.
- **Common syntax that should have "just worked" didn't** — labels
  containing literal `[`/`]`/`(`/`)` inside quotes got truncated at the
  first bracket; `A-->B` with no space around the arrow silently dropped the
  edge; semicolon-separated statements (`sequenceDiagram;A->>B: Hi`) either
  rendered empty or threw outright, depending on diagram type.
- **SVG correctness bugs** — bidirectional/start-pointing arrowheads
  (`A <--> B`) pointed the wrong way in some renderers because a marker's
  polygon points and its `auto-start-reverse` rotation canceled each other
  out.
- **ER diagram cardinality and direction** — the `}o` "zero or more"
  crow's-foot marker on the left side of a relationship was silently
  dropped; the `direction` directive was parsed but never actually applied
  to layout.
- **A long tail of ASCII/Unicode-specific bugs** that never show up in SVG
  output at all: CJK/kana/hangul/fullwidth/emoji characters sized as one
  terminal column instead of two, blowing out box borders; dropped
  `--o`/`--x`/`o--`/`x--` edges; parallel edges between the same node pair
  overwriting each other's labels; edge labels landing on top of box
  borders and erasing them; sibling subgraphs ordered in the wrong
  direction relative to real mermaid.js.

The full list — with exact PR numbers, root causes, and which Mermaid syntax
triggers each one — is in
[`docs/migrating-from-beautiful-mermaid.md`](https://github.com/dfadler/zombie-mermaid/blob/main/docs/migrating-from-beautiful-mermaid.md),
which also ships an audit script so anyone upgrading can check their own
stored diagrams against both versions rather than reading a list and
guessing.

## What's been added, not just fixed

Bug fixes were the starting point, but the fork hasn't stood still on
features either. Since the first release, zombie-mermaid has shipped:

- **A real CLI** (`zombie-mermaid render`) that didn't exist upstream at
  all — SVG, ASCII, and now PNG output (via an optional `@resvg/resvg-js`
  dependency), auto-fit compact spacing for terminal width constraints, and
  a self-contained `render --html` pan/zoom viewer that needs no server or
  network to open.
- **OSC 8 terminal hyperlinks** for ASCII output — `click` directives with
  an http/https/mailto/relative href render as real clickable links in
  terminals that support it (iTerm2, WezTerm, kitty, Windows Terminal).
- **Class diagram notes and full styling support** (`classDef`, `style`,
  `cssClass`, `:::` shorthand) — brought class diagrams up to parity with
  flowchart styling.
- **Strict CSP support** — a `nonce` option and a `styleAttribute: false`
  escape hatch so a host whose `style-src` disallows `'unsafe-inline'` can
  still render themed diagrams correctly.
- **An MCP tool** (`check_mermaid_sequence_activations`) for mechanically
  verifying activation/deactivation balance in sequence diagrams — aimed at
  a specific, measured failure mode in LLM-generated diagrams, not general
  syntax checking that other tools already cover well.
- **Per-diagram-type typed `RenderOptions`** so consumers can see which
  options actually apply to which diagram type instead of one large,
  mostly-inapplicable options bag.

None of this needed to break anything for existing users — the public API
(`renderMermaidSVG`, `renderMermaidASCII`, `parseMermaid`, `RenderOptions`)
has stayed a drop-in replacement for beautiful-mermaid's the whole way, with
exactly one deliberate, well-documented exception so far (the
[2.0.0 click-handler change](/blog/why-v2-breaks-click-handlers.html)).

## How I intend to keep maintaining it

"Maintained" only means something if it's backed by process, not just
intent. A few things that are already in place, not aspirational:

- **A real release cadence.** Eighteen tagged releases since the fork
  started at the end of January 2026 — patches, minors, and one major,
  shipped as they're ready rather than batched and delayed.
- **Every merge to `main` ships through changesets**, so the CHANGELOG and
  version bumps are generated from the same PRs that actually landed, not
  written after the fact from memory.
- **CI-enforced correctness, not just vibes.** Full test suite, Playwright
  visual-regression coverage for rendered SVG output, and — separately,
  because SVG output isn't a valid proxy for terminal fidelity — a weekly
  automated audit that judges whether ASCII/terminal output structurally
  matches real, upstream mermaid.js for the same source, with a verdict
  cache so it only re-judges what actually changed.
- **Accessibility and bundle size are tracked, not assumed.** Every diagram
  type ships a `role`-correct, nameable root `<svg>`, enforced in CI (see
  [`docs/accessibility.md`](https://github.com/dfadler/zombie-mermaid/blob/main/docs/accessibility.md)),
  and the gzipped size of the main entry point is tracked automatically on
  every release via the Bundle Size badge — with a dedicated
  `zombie-mermaid/ascii` subpath that skips the ELK.js layout engine
  entirely for consumers who only need terminal output.
- **Upstream PRs that were stuck get a home here.** Two of the
  SVG-measurement fixes in the 2.0.0-era releases (monospace-font box
  sizing, exact glyph-width edge-label measurement) are cherry-picked,
  authorship-intact ports of PRs that had been open and unreviewed on the
  original repo since mid-2026 — that's the actual point of this fork, not
  just a slogan.

If you're relying on `beautiful-mermaid` and watching its PR queue not move,
or you've already switched and want to know what changed under the hood, the
[README](https://github.com/dfadler/zombie-mermaid#readme) and the
[fork-fixes page](https://dfadler.github.io/zombie-mermaid/fork-fixes.html)
are the two best places to start.
