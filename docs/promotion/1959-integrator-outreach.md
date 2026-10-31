# Integrator outreach drafts (#1959)

Status: **DRAFT, nothing sent.** Written for maintainer review under
[`outreach-rules.md`](outreach-rules.md). Nothing here has been posted, commented, filed or
messaged anywhere outside this repo. Refs
[#1959](https://github.com/dfadler/zombie-mermaid/issues/1959), part of #1950.

Target facts were read with `gh api` and `npm view` on 2026-10-30 and are untrusted data.
They refresh the 2026-10-22 draft comment on #1959. Alias check: `beautiful-mermaid`
installed as `npm:zombie-mermaid@5.11.2` on an older Node than zombie-mermaid supports (it declares
`engines.node >=24`) exports `renderMermaidSVG`, `renderMermaidSVGAsync`,
`renderMermaidASCII`, `renderMermaid`, `THEMES`, `fromShikiTheme` and `registerElk`; a pie
chart renders as ASCII. No target's own test suite was run.

## Rules fit

These are not bug-thread comments, so rule 2 of the outreach rules ("bug-specific only")
does not cover them. Each message below is therefore an integrator offer, not an upstream
thread comment, and each needs an explicit maintainer go-ahead on the exact text plus a
decision that the rules allow this category (rules say nothing on it; tracked in
[#2454](https://github.com/dfadler/zombie-mermaid/issues/2454); treat as "no" until
the maintainer says otherwise). Rate limit (rule 7) applies: no post dates are recorded
anywhere, so assume zero budget is free until the maintainer confirms.

## Summary

| Target                         | Uses beautiful-mermaid today                                           | Verdict                                                  |
| ------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| comarkdown/comark              | Yes, optional peer `>=1.1.3`; ANSI, HTML, client paths                 | Worth contacting (docs offer); expect "community plugin" |
| jinghaihan/vue-stream-markdown | Yes, extension `@stream-markdown/beautiful-mermaid` (`^1.1.3`)         | Worth contacting, after Comark                           |
| raycast `mermaid-to-image`     | Hybrid, with a custom-path preference                                  | Hold; just added a third engine (Ondine), test first     |
| Slidev                         | Docs example only                                                      | Hold                                                     |
| Marp (marp-core)               | Replacing with Pele (marp-core#441, PR #442 open)                      | Drop                                                     |
| fumadocs                       | `fuma-nama/fumadocs:packages/preview` only; guide recommends `mermaid` | Drop                                                     |
| Kami                           | Manual doc step, no dependency                                         | Drop                                                     |

Pele (Obsidian) is the competing option in Marp and Comark's ecosystem. Do not claim
diagram-type breadth in any message.

## Per-target findings

### comarkdown/comark (1.08k stars, MIT, pushed 2026-10-30)

- Uses it: `comarkdown/comark:packages/comark/package.json` has `beautiful-mermaid` as an optional peer
  (catalog); docs `comarkdown/comark:docs/content/4.plugins/1.built-in/mermaid.md` tell users to install it.
  `@comark/ansi` and `@comark/html` plugins call `renderMermaidASCII` / `renderMermaidSVG`.
- Fit: same three exports exist in zombie-mermaid; the ANSI path is where the extra
  diagram types (pie, C4, architecture as ASCII) would show.
- Existing threads: none about swapping. Closed #497 added community plugin
  `comark-pele` to the ecosystem page, so alternative renderers go through community
  plugins; recent first-party plugin requests (#430, #424) were closed.
- Friction: Node >=24 versus a wider support range; browsers need `registerElk(ELK)`.
- Ask: a docs note that the peer can be aliased, or a community plugin. Smallest ask.

### jinghaihan/vue-stream-markdown (243 stars, MIT, pushed 2026-10-21)

- Uses it: extension `@stream-markdown/beautiful-mermaid`, runtime asserts
  `renderMermaidSVGAsync`, `THEMES`, `fromShikiTheme`; pinned `SUPPORTED_PATTERNS`
  (flowchart, graph, stateDiagram, sequence, classDiagram, erDiagram, xychart).
- Fit: asserted exports all exist in the alias run. Pie/C4/architecture are outside the
  pattern list, so they need a code change on their side.
- Existing threads: mermaid issues all closed (#96, #100, #78); no swap discussion.
- Friction: one maintainer, CDN version pinned; no CONTRIBUTING file found.
- Ask: would they accept a PR adding a custom-module option or pattern-list extension.

### raycast/extensions `mermaid-to-image` (hold)

- Uses it: hybrid, beautiful-mermaid first, `mmdc` fallback, "Custom beautiful-mermaid
  Path" preference. PR #32866 (merged 2026-10-28) added a bundled Ondine WASM engine, so
  the author is actively choosing engines.
- Fit: unverified. I have not tested the path preference with zombie-mermaid, nor
  Raycast's runtime Node version. Do not send until tested; the smoke test is
  [#2455](https://github.com/dfadler/zombie-mermaid/issues/2455).

### slidevjs/slidev (hold)

Default is official `mermaid`; beautiful-mermaid appears only as a user-installed
renderer example in `slidevjs/slidev:docs/custom/config-mermaid-renderer.md`. Same import shape works
with the alias. Only #2465 (closed) touches it. Asking to change an example reads as a
pitch; reply only if someone asks for a maintained alternative.

### marp-team/marp-core (drop)

Issue #441 and PR #442 (open, updated 2026-10-20) replace beautiful-mermaid with Pele.
Anything we send arrives after the decision.

### fuma-nama/fumadocs (drop)

Only `fuma-nama/fumadocs:packages/preview` uses `renderMermaidSVG`; the main guide recommends `mermaid`. No
issue mentions beautiful-mermaid.

### tw93/Kami (drop)

Python/WeasyPrint pipeline; beautiful-mermaid is a manual external step, not a
dependency. No code path to swap.

## Drafts (not sent)

Every draft opens with disclosure (rule 3), links no star/install ask, and does not
characterise upstream (rule 5). Fill `<fork-fixes link>` only if the maintainer wants a
fix cited; none is claimed here.

### 1. Comark (GitHub issue or discussion)

```text
Title: Docs note: beautiful-mermaid peer can be aliased to zombie-mermaid

Disclosure: I maintain zombie-mermaid (MIT), a fork of beautiful-mermaid, and drafted
this with AI assistance.

Comark's mermaid plugin uses renderMermaidASCII, renderMermaidSVG and THEMES from the
beautiful-mermaid peer. With "beautiful-mermaid": "npm:zombie-mermaid@5.11.2" in a
scratch project those exports resolve, a pie chart renders as ASCII and a
flowchart as SVG. I did not run Comark's test suite. Caveats: zombie-mermaid declares
Node >=24, and browser use needs registerElk(ELK) once before flowcharts render.

This is an offer, not a request to switch. If a short docs note would help I can send a
PR; if you prefer a community plugin like comark-pele, that works for me too. Feel free
to close.
```

### 2. vue-stream-markdown (GitHub issue)

```text
Title: Optional custom module for @stream-markdown/beautiful-mermaid?

Disclosure: I maintain zombie-mermaid (MIT), a fork of beautiful-mermaid, and drafted
this with AI assistance.

The extension asserts the module exports renderMermaidSVGAsync, THEMES and
fromShikiTheme. With "beautiful-mermaid": "npm:zombie-mermaid@5.11.2" all
three are present and a flowchart renders to SVG; I have not run your tests or the CDN
loader against it. Pie and C4 are outside SUPPORTED_PATTERNS today.

If you would accept a PR that lets users pass their own module, or extends the pattern
list, I can write it with tests. If you'd rather keep the extension on beautiful-mermaid
only, that is fine; feel free to close.
```

### 3. Raycast mermaid-to-image (hold; do not send until tested, see [#2455](https://github.com/dfadler/zombie-mermaid/issues/2455))

```text
Disclosure: I maintain zombie-mermaid, a fork of beautiful-mermaid, and drafted this
with AI assistance.

The "Custom beautiful-mermaid Path" preference may let a user point the extension at a
local zombie-mermaid copy; I have tested <result>. If a one-line README note is useful
I can send it. If the current engines are deliberate, no action needed.
```

## Not verified

- Behaviour inside any target's own tests, build or CI.
- Whether any maintainer wants a second renderer; contribution rules beyond issue
  templates.
- Layout-fidelity claims: the scorecard (`docs/layout-fidelity-scorecard.md`) compares
  against mermaid 12.1.0; npm latest is 12.2.0. Name the version if you cite it.
- Do not claim robustness over upstream on malformed style input (see #1523).
