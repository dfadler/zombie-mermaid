# Self-hosted ASCII/terminal font (#978): don't build one — fix the loading/CSS gaps in what's already chosen

Investigation for [#978](https://github.com/dfadler/zombie-mermaid/issues/978).
Full investigation notes — method, findings, and candidate fonts
considered — are posted on
[the issue](https://github.com/dfadler/zombie-mermaid/issues/978#issuecomment-5649782872)
rather than carried inline here; this doc keeps only the decision and its
consequences.

## Context

#978 asks whether this repo should ship a small, self-hosted, purpose-built
font for every browser-rendered ASCII surface, so the browser's glyph
metrics genuinely match a real terminal's "every wide glyph is exactly two
columns" rule, instead of drifting per-viewer with whatever fallback font
happens to be installed. The issue's own two example bugs — a mockup with
no monospace web font actually loaded, and JetBrains Mono's ligatures
silently fusing a literal `--` in a CLI flag — came from an ad hoc
design-canvas session, not from this repo's shipped pages. Verified against
a real terminal capture (not the HTML approximation — see the issue notes'
"Method" section), both turned out to be live here today, and the actual
scope was wider than either bug description implies:

- **Every live ASCII-rendering page loads zero monospace web fonts** — all
  four real surfaces (home hero, home theme showcase, fork-fixes wells,
  diagram detail/type pages) use the same `.mono` class, which is a pure
  system-font stack with no web font name in it at all.
- **The ligature-fusion bug is real as a browser-side risk, but currently
  masked (not defended against)** everywhere except one rule
  (`.theme-showcase-ascii`) that already sets `font-variant-ligatures: none`.
- **The width-mismatch problem #978 frames as the core issue is already
  solved, independent of font choice** — both ASCII renderers already
  force each wide glyph's box width inline, regardless of what font paints
  it.

Three candidate fonts (JetBrains Mono / JetBrains Mono NL, Iosevka, Sarasa
Gothic/Term) were evaluated against these gaps — full comparison on the
issue.

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
3. Load that self-hosted subset on every ASCII-rendering page —
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
   `Nch`-width forcing in `ascii-html.ts`/`terminal-panel.ts` (see the
   issue's investigation notes) already makes that safe from a
   layout-geometry standpoint, and this
   repo's own real-terminal ground truth (the capture tooling) doesn't
   bundle a CJK font either, so there is no terminal-side expectation of a
   _specific_ CJK glyph shape to match — only of correct column count,
   which is already guaranteed independent of font.

## Consequences

- This PR ships one small, defensive fix: adding
  `font-variant-ligatures: none` to `demo/styles.css`'s vestigial
  `.ascii-output` rule, matching what `.theme-showcase-ascii` already does.
  Per the issue's investigation notes, `.ascii-output` has no live-page consumer today — its only
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
- Self-hosting JetBrains Mono NL and wiring it into every ASCII-rendering
  page (recommendations 1-3) is **not** implemented here — it's a
  font-loading change touching multiple page generators' `<head>`
  composition, exactly the kind of "open-ended font-loading refactor"
  #978's own scope note says this investigation should not undertake.
  Whoever picks this up next should treat this doc's four numbered
  recommendations as the acceptance criteria, and re-verify recommendation
  2's subsetting claim directly (font subset tooling and upstream font
  releases both change over time) rather than trusting this doc's byte
  count indefinitely.
- The stale `mount.ts` comment and the Playwright suite's own font-drift
  exposure (both noted in the issue's investigation notes) are flagged separately rather than
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
