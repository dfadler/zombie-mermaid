# Self-hosted ASCII/terminal font (#978): don't build one — fix the loading/CSS gaps in what's already chosen

Investigation for [#978](https://github.com/dfadler/zombie-mermaid/issues/978).

## Context

#978 asks whether this repo should ship a small, self-hosted, purpose-built
font for every browser-rendered ASCII surface, so the browser's glyph
metrics genuinely match a real terminal's "every wide glyph is exactly two
columns" rule, instead of drifting per-viewer with whatever fallback font
happens to be installed. The issue's own two example bugs — a mockup with
no monospace web font actually loaded, and JetBrains Mono's ligatures
silently fusing a literal `--` in a CLI flag — came from an ad hoc design-canvas
session, not from this repo's shipped pages, so the first question this
investigation had to answer was: are either of those bugs _actually_ live
here today, or were they specific to that one-off mockup?

Both are live, and the actual scope turned out wider than either bug
description implies — see "Findings" below.

## Method: verified against a real terminal, not the HTML approximation

Per this repo's own `verify-ascii-terminal` skill and CLAUDE.md rule, every
claim about "what a real terminal does" below was checked with
`scripts/ascii-terminal-capture.sh` (real PTY, `asciinema` + `agg`), not
inferred from `ascii-html.ts`/`terminal-panel.ts`'s HTML approximation. Two
captures were run, both against this repo's own `renderMermaidASCII`:

1. `stateDiagram-v2` with CJK state names (`空闲`/`处理中`/`错误`/`完成`, the
   same content as `samples-data.ts`'s "State: CJK State Names" sample) —
   to check box-drawing junction quality and wide-glyph geometry.
2. A small flowchart with node labels containing literal `--ascii`, `!=`,
   and `->` — mirroring the exact CLI-flag scenario #978 cites — to check
   whether the real-terminal rendering path ever fuses those into ligature
   glyphs.

Both captures ran through `agg`'s local rasterizer with JetBrains Mono
installed (the same font this repo's capture tooling already prefers —
`scripts/ascii-terminal-capture.sh`'s own `--font-family` fallback list
puts it first, and its header comment documents Menlo's box-drawing
"notch" artifact as the failure mode of _not_ having it installed).

**Result 1 (box drawing / CJK):** clean junctions, no notch artifacts, and
Chinese characters read at a consistent double-width relative to Latin
text and box-drawing borders.

**Result 2 (ligatures):** `--ascii`, `!=`, and `->` all rendered as their
literal, unfused glyphs — `agg` does no OpenType contextual-substitution
(`calt`) shaping at all; it maps codepoints to glyphs directly. **This means
the ligature-fusion bug #978 describes cannot happen in this repo's actual
real-terminal ground truth, regardless of font choice** — it is strictly a
browser-text-shaping-engine phenomenon. That doesn't make it unimportant
(the browser approximation is still wrong when it happens), but it does
mean the fix belongs entirely in browser CSS, and there's no terminal-side
regression risk to weigh against making that CSS change.

## Findings

**Finding 1 — every live page that renders browser ASCII output loads zero
monospace web fonts, full stop. This is broader than #978's own bug #1
frames it, and broader than two earlier drafts of this doc scoped it** —
each correction here came from checking a specific claim directly rather
than trusting the previous pass, exactly the failure mode #977 flags.
First correction: not two pages but three actually render ASCII (checking
which font-link component each of the six page generators renders, instead
of assuming `GOOGLE_FONTS_HREF` was in wider use than it is). Second
correction: the diagram detail/type page's real ASCII output isn't styled
by `.ascii-output` at all — grepping every `.tsx` file for a live consumer
of that class (`className="ascii-output"` or equivalent) returns nothing;
the actual markup (`diagram-detail-app.tsx`'s `DetailOutputPanel`,
`diagram-type-app.tsx`) renders `asciiHtml` into an element with
`className="mono"`, same as everywhere else. So:

| Surface                   | Page (generator)                                                               | CSS class rendering ASCII output | Font declared      |
| ------------------------- | ------------------------------------------------------------------------------ | -------------------------------- | ------------------ |
| Home hero panel           | `index-page.tsx`/`index-app.tsx` (`hero-output-panel.tsx`'s `HeroOutputPanel`) | `.mono`                          | `var(--font-mono)` |
| Home theme showcase       | `index-page.tsx`                                                               | `.theme-showcase-ascii.mono`     | `var(--font-mono)` |
| Fork-fixes ASCII wells    | `fork-fixes-page.tsx`/`fork-fixes-app.tsx`                                     | `.fix-ascii.mono`                | `var(--font-mono)` |
| Diagram detail/type pages | `diagram-detail-app.tsx`, `diagram-type-app.tsx`                               | `.mono`                          | `var(--font-mono)` |

Every real ASCII surface in this repo uses the _same_ class, `.mono`
(`primitives.module.css`: `font-family: var(--font-mono)`), which
`tokens.tsx`'s `FONTS.mono` publishes as a pure system stack —
`'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace` — no web
font name appears in it at all, by design. `demo/styles.css`'s
`.ascii-output`/`.ascii-panel`/`.terminal-window` rules (the ones that
_do_ name `'JetBrains Mono', 'Fira Code', 'Cascadia Code'`) are **vestigial
CSS with no live consumer** — leftover from the pre-#590 demo
`terminal-panel.ts`'s own header comment already documents as removed in
#716 and never replaced. Their only real consumer today is that same
`terminal-panel.ts`, which builds its own synthetic `.terminal-window`/
`.ascii-output` DOM purely for the Playwright visual-regression suite (see
below) — not any page a visitor loads.

Checking each page's own `<head>` composition (every page generator passes
its own font-link component through `Document`'s `head` prop — see that
file's own header comment) against the two link components this repo
defines:

- `GOOGLE_FONTS_HREF` (`site-head.tsx`, rendered via `site-chrome.tsx`'s
  `<FontLinks />`) — Geist + **JetBrains Mono**.
- `DESIGN_FONTS_HREF` (`tokens.tsx`, rendered via `<DesignFontLinks />`) —
  Space Grotesk + Plus Jakarta Sans. **No monospace family at all.**

`grep -rl '<FontLinks'` across every `.tsx` in the repo returns exactly one
file: `editor-page.tsx`. Every other page generator —
`dashboard-page.tsx`, `fork-fixes-page.tsx`, `diagram-page.tsx`,
`index-page.tsx`, `blog-page.tsx` — renders `<DesignFontLinks />` instead.
And `editor-page.tsx`/`editor-app.tsx` never render ASCII output at all (no
`asciiHtml` prop, no `.mono`/`renderMermaidASCII` usage in either file).
So the one page that loads a monospace web font never uses it for ASCII,
and every page that _does_ render ASCII output loads no monospace web font
whatsoever. Every visitor sees whatever monospace the CSS's own fallback
chain resolves to on their OS/browser — the un-pinned, drift-prone
rendering #978 is asking this repo to stop relying on, confirmed on 100%
of today's live browser ASCII surfaces, with no exceptions.

**The Playwright visual-regression baseline has a version of the same
gap, one level removed.** `__tests__/visual/helpers/mount.ts` injects
`demo/styles.css` directly into the test DOM — so, unlike any live page,
its synthetic `terminal-panel.ts` markup _does_ use the vestigial
`.ascii-output` rule and _does_ get a real font name (`'JetBrains Mono',
'Fira Code', 'Cascadia Code'`) — but `mount.ts` never adds a font `<link>`
or `@font-face` (checked by grepping the file for `link`/`fonts.googleapis`
and finding neither). That file's own comment claims the wait-for-fonts
logic covers "JetBrains Mono, from the injected demo stylesheet" — checked
directly against the stylesheet: it only sets `font-family`, it fetches
nothing, so the comment overstates what the injected CSS does. Nothing in
`.github/workflows/` installs JetBrains Mono as a system font for the CI
runner either (checked via grep), so whether the suite's baselines render
with JetBrains Mono or a CI-image-dependent fallback comes down to
whatever happens to already be on the runner — not fixed in this PR, see
"Consequences" below.

**Finding 2 — the "ligatures fuse literal text" bug is real (strictly as a
browser-side risk — see "Method" above), but currently masked everywhere
by Finding 1, not defended against.** Only `index-page.tsx`'s
`.theme-showcase-ascii` rule (line 496) sets
`font-variant-ligatures: none`; `.mono`, `.fix-ascii.mono`, and the
vestigial `.ascii-output` do not. Since Finding 1 means no live surface
actually has a `calt`-bearing font loaded today, this specific fusion
can't fire on any current page — but that's a coincidence of Finding 1
being unfixed, not a real defense. Whichever surface recommendation 3
(below) reaches first would reintroduce exactly this bug the moment a real
font with ligatures loads, unless the ligature rule ships in the same
change.

**Finding 3 — the width-mismatch problem `#978` frames as the core issue is
already solved, independent of font choice.** Both browser-side ASCII
renderers (`ascii-html.ts`'s `asciiToHtml()` and
`terminal-panel.ts`/formerly `demo/client.ts`'s `applyWideCharWidths()`)
already wrap every wide grapheme cluster in a span with an explicit
`width:Nch` inline style, forcing the box width the renderer laid the
diagram out for — regardless of what font, or what fallback font, actually
paints that glyph. This means a "purpose-built font with guaranteed 2x
wide-glyph metrics" would not fix a geometry bug that still exists today —
the geometry is already pinned. What a font choice _can_ still affect,
independent of that width-forcing:

- Whether box-drawing glyphs are present and visually clean (glyph
  _shape_, not layout width) — checked directly against JetBrains Mono's
  own documented character set
  ([JetBrains/JetBrainsMono wiki, "List of supported symbols"](https://github.com/JetBrains/JetBrainsMono/wiki/List-of-supported-symbols)),
  which explicitly lists the Box Drawing block
  (`┌└┐┘┼┬┴├┤─│...`) and Block Elements (`▁▂▃▄▅▆▇█...`), and confirmed
  visually clean in this investigation's own real-terminal capture above.
- Whether ligatures fire at all (Finding 2).
- Whether a web font is loaded at all (Finding 1).

None of those three is a font-_design_ problem needing a new typeface —
they're loading and CSS gaps in how this repo uses the font(s) it already
has.

## Candidates considered

- **JetBrains Mono** (already named in CSS here, though not actually
  loaded anywhere per Finding 1; OFL-1.1). Has documented
  box-drawing/block-elements coverage (Finding 3) and this repo's own
  ground-truth capture tooling already prefers it. Ships ligatures via
  `calt`, but JetBrains also publishes a separate **JetBrains Mono NL**
  build — per the project's own README, an alternate version with the
  ligature data left out entirely, meant for tools without OpenType
  support — rather than requiring a CSS opt-out on every consumer. No
  CJK/wide-glyph coverage.
- **Iosevka** (OFL-1.1). Purpose-built with a documented, exact
  narrow/wide advance ratio (every letter exactly `1/2 em`) and dedicated
  `Term`/`Fixed` spacing variants aimed at terminal use. Ships ligatures
  via `calt` (optional, buildable without). Explicitly has **no CJK
  glyphs** — Iosevka's own docs point CJK users to a separate project
  (below) instead.
- **Sarasa Gothic / Sarasa Term** (OFL-1.1). A composite that merges
  Iosevka's Latin/Greek/Cyrillic glyphs with Source Han Sans's CJK glyphs
  into one font file, specifically so CJK characters land at exactly 2x
  the Latin advance. This is the closest existing thing to "a purpose-built
  font with guaranteed wide-glyph metrics, CJK included" — but it ships as
  a genuinely large file (Source Han Sans's CJK glyph count is in the
  thousands per style) and building/subsetting it is a nontrivial pipeline
  in its own right (the project's own build docs call for Node.js, AFDKO,
  and `ttfautohint`).

None of these is a reason to build a font from scratch — #978 itself names
that as the fallback hypothesis to disprove, and it's disproved: every gap
found above is a loading/CSS problem, not a missing typeface.

## Decision

**Don't build or adopt a new purpose-built font, and don't bundle a
CJK-capable font (Sarasa Term or similar) either.** Recommend, as follow-up
work (not implemented in this PR — see "Consequences" below):

1. **Self-host JetBrains Mono NL** (the ligature-free build) instead of
   pulling `GOOGLE_FONTS_HREF` from Google's CDN — closes the "third-party
   CDN metrics can drift" concern #978 raises, and removes the
   ligature-fusion risk by construction (no GSUB ligature data in the file
   at all) rather than relying on every ASCII-output rule remembering
   `font-variant-ligatures: none`.
2. Build (or verify a maintained upstream) subset that explicitly includes
   Basic Latin, Latin-1 Supplement, Box Drawing (U+2500–U+257F), and Block
   Elements (U+2580–U+259F) — checked directly, because at least one common
   self-hosting shortcut doesn't include this for free: Fontsource's
   pre-split `@fontsource/jetbrains-mono` "latin" subset (21,168 bytes,
   woff2, weight 400 — confirmed via its published file listing) follows
   Google Fonts' own `latin` `unicode-range` definition, which does not
   cover the box-drawing block. A custom `pyftsubset`-style pass with an
   explicit `--unicodes=` list (or an upstream request/PR against
   JetBrains Mono's own subsetting, if one exists) is needed rather than
   assuming any off-the-shelf per-language file already covers it.
3. Load that self-hosted subset on every page in Finding 1's table —
   `index-page.tsx`, `fork-fixes-page.tsx`, and the `diagram-page.tsx`-generated
   pages that hydrate `diagram-detail-app.tsx`/`diagram-type-app.tsx` — without
   requiring any of them to adopt the unrelated Geist/JetBrains-Mono-CDN
   pairing `editor-page.tsx` uses today. Since every one of these surfaces
   already reads `.mono`/`var(--font-mono)`, the simplest path is making
   `FONTS.mono`/`--font-mono` (`tokens.tsx`) point at the self-hosted
   family plus a font link added to `DesignFontLinks` (or wherever each
   page's `<head>` composition already goes through) — one change, not
   four separate ones. `demo/styles.css`'s vestigial `.ascii-output`/
   `.ascii-panel`/`.terminal-window` rules should either be deleted (no
   live page uses them) or pointed at the same `var(--font-mono)`, purely
   so the Playwright suite's synthetic terminal keeps matching whatever
   real pages actually do — not because any production page depends on it.
4. Leave CJK/wide-glyph rendering to system font fallback, as today — the
   `Nch`-width forcing in `ascii-html.ts`/`terminal-panel.ts` (Finding 3)
   already makes that safe from a layout-geometry standpoint, and this
   repo's own real-terminal ground truth (the capture tooling) doesn't
   bundle a CJK font either, so there is no terminal-side expectation of a
   _specific_ CJK glyph shape to match — only of correct column count,
   which is already guaranteed independent of font.

## Consequences

- This PR ships one small, defensive fix: adding
  `font-variant-ligatures: none` to `demo/styles.css`'s vestigial
  `.ascii-output` rule, matching what `.theme-showcase-ascii` already does.
  Per Finding 1, `.ascii-output` has no live-page consumer today — its only
  reader is the Playwright suite's synthetic `terminal-panel.ts` markup —
  so this has **no observable effect on any current rendering**, live or
  test. It's included anyway because it's a one-line, zero-risk guard
  against the exact bug #978 opened with, on the one piece of CSS in this
  repo that already names a ligature-bearing font; per "Method" above it
  also carries no real-terminal regression risk (the real-terminal path
  never exhibited the bug, so there's nothing for this change to diverge
  further from). Because nothing currently visible changes, it needs no
  before/after screenshot under this repo's visual-verification rule —
  there is no "after" to show.
- Self-hosting JetBrains Mono NL and wiring it into every page in Finding
  1's table (recommendations 1-3) is **not** implemented here — it's a
  font-loading change touching multiple page generators' `<head>`
  composition, exactly the kind of "open-ended font-loading refactor"
  #978's own scope note says this investigation should not undertake.
  Whoever picks this up next should treat this doc's four numbered
  recommendations as the acceptance criteria, and re-verify recommendation
  2's subsetting claim directly (font subset tooling and upstream font
  releases both change over time) rather than trusting this doc's byte
  count indefinitely.
- The stale `mount.ts` comment and the Playwright suite's own font-drift
  exposure (both noted under Finding 1) are flagged separately rather than
  fixed in this PR — neither is part of #978's own scope, and fixing the
  suite's font exposure really wants to land together with recommendation
  3's actual font change, not before it.
- Building or adopting Sarasa Term (or any CJK-inclusive merged font) is
  ruled out, not deferred — revisiting it would need a concrete case where
  the existing `Nch`-width forcing is insufficient (none was found here),
  not just a general desire for "more accurate" CJK glyphs.
- `theme-selector-shared-state.md`'s decision that ASCII previews keep a
  fixed palette independent of the page theme is unaffected — this
  investigation is about font _metrics_, not color.
