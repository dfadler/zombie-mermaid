---
title: Why Terminal Rendering Is Secretly About Unicode, Not ASCII Art
date: 2026-09-06
description: The hardest recurring bug in zombie-mermaid's ASCII renderer wasn't diagram layout, it was column-width math, and it came back four times in a week wearing a different costume each time.
---

If you'd asked me to guess where zombie-mermaid's ASCII renderer would accumulate the most bugs, I'd have guessed layout: pathfinding around dense graphs, edge bundling, grid placement for deeply nested subgraphs. That guess would have been wrong. The single bug category that came back the most times in the space of about a week wasn't any of that. It was the question of how wide a piece of text is.

That sounds like it should have one obvious answer. It doesn't, and this post is the story of finding that out the hard way, four times, in four different corners of the same codebase.

## The assumption that seems obviously true

Somewhere in an ASCII box-drawing renderer, you need to answer: "if I'm about to print this label, how many terminal columns will it take up, so I know how wide to draw the box around it?"

The tempting answer is `label.length`. In JavaScript, `.length` counts UTF-16 code units, and for plain ASCII text that number is also the code-point count, the grapheme count, and the terminal column count: all four measures agree. It's easy to write and test a box-drawing renderer entirely against ASCII input, watch every row line up, and conclude the width math is done.

It isn't done. It's only been tested against the one case where all four notions of "how long is this string" happen to coincide. The moment real-world text enters the picture (the language of the diagram's own domain, not just its plumbing), those four numbers come apart, and each way they come apart produces a different bug.

## Case 1: CJK characters take two columns, not one (#66)

The first crack showed up in [#66](https://github.com/dfadler/zombie-mermaid/issues/66). A flowchart with Japanese labels:

```
flowchart TD
    A[日本語テスト] --> B[終了]
```

rendered as:

```
┌────────┐
│        │
│ 日本語テスト │
│        │
└────┬───┘
     │
     ▼
┌────────┐
│        │
│   終了   │
│        │
└────────┘
```

Every row of that box reports `.length === 10` in JavaScript. But `日本語テスト` is six fullwidth glyphs, and a real monospace terminal draws each of them across *two* columns, not one. So the label row is actually 16 terminal columns wide against borders sized for 10. The box visibly overflows itself the moment you look at it in an actual terminal instead of at its character count.

The root cause, per the issue and confirmed in the code (`src/ascii/multiline-utils.ts` at the time): box width was computed as `Math.max(...lines.map(l => l.length))`, a code-unit count. The fix, landed in PR #94, introduced `src/ascii/display-width.ts` with a `displayWidth()` function that classifies each character as wide or narrow (via `isWideChar()` in `src/text-metrics.ts`, which already existed for measuring SVG text) and counts wide characters as 2. The single-box drawing path, `drawBoxWithGridDimensions` in `src/ascii/draw-boxes.ts`, was updated to measure and write text through this new helper instead of raw `.length` indexing.

That should have been the end of the CJK-width story. It wasn't, because "the ASCII renderer" is not one code path. It's several, and the fix touched exactly one of them.

## Case 2: the same bug, in the box the first fix didn't reach (#182)

A day later, [#182](https://github.com/dfadler/zombie-mermaid/issues/182) reported the identical symptom (CJK text overflowing a box's borders), this time in class and ER diagrams:

```
classDiagram
  class A { +名前 x }
```

The issue was found during review of an unrelated PR (#180, a canvas `write()` primitive refactor), and its description is unambiguous about what had happened: `drawMultiBox`, the function `class-diagram.ts` and `er-diagram.ts` use to render multi-compartment boxes (header, attributes, methods), measured text with `line.length` and indexed characters with `line[i]`, the exact code-unit approach #66 had just fixed everywhere else. It was, in the issue's own words, "the same bug class as #66, which fixed the single-box path... but missed this one."

I went back and checked this claim against the actual code, rather than taking the issue's word for it, because it's the load-bearing claim of this whole post. It holds up. PR #94 (the #66 fix) touched `src/ascii/draw-boxes.ts`, but only the code path serving `drawBoxWithGridDimensions`: single, uniform boxes, used by flowchart/state/other simple node shapes. `drawMultiBox`, a separate function in the same file for the multi-compartment boxes class and ER diagrams need, was untouched. Its own `.length`-based width math kept working right through #94's merge, because nothing in that PR's diff or tests ever exercised it. `drawMultiBox` isn't reachable from a flowchart. The bug wasn't *reintroduced*; it had simply never been fixed, because the class of input that would trigger it (a class or ER diagram with a wide-character label) was never part of #66's repro or test suite.

That's the hook this whole post is built around: a fix that is completely correct for the code path it touches can still leave the identical bug alive one file away, because "the renderer" is a plural noun. The fix for #182 (PR #203) had to update `drawMultiBox` itself *and* the two callers that pre-compute box dimensions before calling it (`class-diagram.ts`'s `classBoxW`/`classBoxH`, `er-diagram.ts`'s equivalent), because those callers had also each written their own copy of the same `.length`-based sizing arithmetic. Fixing only `drawMultiBox` would have desynced the space reserved for a box from the box actually drawn into it, producing a different kind of misalignment than the one being fixed.

`src/ascii/draw-boxes.ts` today shows the aftermath of that lesson directly: `measureMultiBox()` exists as one function both `class-diagram.ts` and `er-diagram.ts` call to reserve layout space, instead of each diagram type recomputing the same math independently. Its doc comment says exactly why:

> Class and ER diagrams both need these dimensions *before* drawing, to reserve grid space for the box during layout. Deriving them here — rather than each caller re-implementing the same arithmetic — keeps the reserved space and the drawn box in lockstep. When the two disagree (as they did while the callers measured `line.length` and this module measured display width), wide-character boxes overlap their neighbours.

That comment is describing #182's exact failure mode, written into the code that replaced it.

## Case 3: some characters take zero columns (#205)

Two days after #182 shipped, [#205](https://github.com/dfadler/zombie-mermaid/issues/205) found the opposite kind of error in the very helper that had just fixed the first two bugs. `displayWidth()` (the function introduced in #66's fix) added one column for every code point that wasn't wide. That's correct for ordinary text, but wrong for combining marks: Unicode's `Mn`/`Me` categories, the diacritics that attach to a preceding base character rather than occupying a column of their own.

The repro is a decomposed "é": the letter `e` followed by U+0301 COMBINING ACUTE ACCENT, rather than the single precomposed `é` code point:

```
flowchart TD
  A[café] --> B[ok]
```

`displayWidth('café')` returned 5 (four base letters plus one combining mark counted as a full column), while a real terminal renders it in 4 columns. The precomposed form rendered correctly; the decomposed form, visually identical but represented differently, did not. Same visible string, different bug, purely as a function of which Unicode normalization form produced it.

The fix had to teach `charDisplayWidth()` that a combining mark contributes zero columns, and, just as importantly, that `toDisplayCells()` (the companion function that splits a string into grid cells for writing) has to keep its cell count in lockstep with the column count `displayWidth()` reports. A combining mark can't get its own grid cell if it doesn't get its own column; it has to share the cell of the base character before it, or box-width math and box-drawing would disagree with each other again, the same category of drift that broke #182, just one level lower in the same module.

## Case 4: some characters need more than one code point to mean one column (#214)

The same day, a fourth report: [#214](https://github.com/dfadler/zombie-mermaid/issues/214). This time the error ran the other direction from #205: not too many columns credited to one code point, but too many code points credited as separate columns for what a person sees as a single character. A composed emoji sequence (a ZWJ family emoji, a flag built from two regional-indicator code points, a skin-tone modifier) is several JavaScript code points that render as *one* glyph occupying at most two terminal columns:

| Input | Code points | `displayWidth` (before fix) | Terminal columns |
|---|---|---|---|
| 👨‍👩‍👧 (ZWJ family) | 5 | 8 | 2 |
| 🇺🇸 (regional indicators) | 2 | 4 | 2 |
| 👍🏽 (skin-tone modifier) | 2 | 4 | 2 |
| 日本 (plain CJK, for comparison) | 2 | 4 | 4 ✅ |

Plain CJK was fine: two wide characters really do take four columns. The composed sequences weren't, because `displayWidth` and `toDisplayCells` were iterating **code points**, and a code point is not the right unit of "one visible character" once you're past plain CJK and into anything requiring a joiner or modifier.

The fix (landed in the same PR as #205's fix, #232, since both are defects in the identical shared helper) replaced code-point iteration with `Intl.Segmenter`'s grapheme-cluster segmentation, the actual Unicode definition of "one user-perceived character," which already knows how to keep a ZWJ sequence, a regional-indicator pair, or a base-plus-modifier together as one cluster. Each cluster is then measured once: two columns if any code point inside it is wide, one otherwise (or zero, for a cluster made entirely of combining marks with no base, the degenerate case #205 needed).

That single change is why `src/ascii/display-width.ts` today measures in grapheme clusters rather than code points or code units. It's the one unit of measurement that gets both #205 and #214 right at once, because they're really the same bug (the wrong unit of iteration) pulling in opposite directions.

There's a fifth wrinkle buried in the same module that's worth naming, because it shows the boundary of what "wide" even means: U+FE0F VARIATION SELECTOR-16 explicitly requests emoji presentation for the character before it, overriding that character's own default. ▶ (U+25B6) is a narrow, single-column glyph on its own (it's in the same Geometric Shapes block this renderer uses for arrowheads in sequence diagrams), but ▶️ (▶ followed by VS16) renders as a wide emoji. `isWideChar()`, shared with the SVG text-measurement path, only ever looks at one isolated code point and has no way to know a VS16 is coming next. Only cluster-level code can see that, which is exactly why this had to be handled in `display-width.ts` rather than pushed down into the single-code-point helper it reuses.

## Case 5: the same root cause, a third renderer (#334)

By this point the pattern should be obvious, and sure enough it reappeared exactly where the earlier fixes hadn't reached: sequence diagrams. [#334](https://github.com/dfadler/zombie-mermaid/issues/334), filed a few days after the display-width fixes, reported that participant boxes and message labels misaligned with CJK names:

```
sequenceDiagram
  participant A as アリス
  participant B as ボブ
  A->>B: こんにちは
```

```
┌────────┐       ┌──────┐   
│  アリス   │       │  ボブ  │   
└────┬───┘       └───┬──┘   
```

Measured directly: the border line is 28 terminal columns wide; the content line, once each katakana character is counted at its real width of 2, is 33, a 5-column gap. The issue's own diagnosis, confirmed by grepping the file, was that `src/sequence/renderer.ts` and `src/sequence/layout.ts` never referenced the display-width helpers at all. They had their own independent string-length/padding logic that had simply never been touched by any of the three fixes above, for the same structural reason #182 had been missed: sequence diagrams are a separate code path, with their own layout module, that nothing in #66/#182/#205/#214 happened to exercise. The fix (PR #379) routed `src/ascii/sequence.ts`'s box and label sizing through the same `displayWidth`/`toDisplayCells` functions everywhere else already used.

Four fixes in, the shape of the actual problem was no longer "a Unicode width edge case." It was: this codebase has multiple independent places that draw a box around text, and a correct width function sitting in one file protects nothing until every one of those places is calling it.

## The twist: not every disguise is the same bug

There's a sixth issue in this family worth walking through precisely because it *isn't* a sixth instance of the same fix, and getting that distinction right matters more than padding the case-study count. [#344](https://github.com/dfadler/zombie-mermaid/issues/344) reported that the demo/editor's browser-rendered ASCII panel displayed CJK characters at roughly 1.66x the width of a Latin character instead of 2x, because the panel's font stack (`JetBrains Mono`, `Fira Code`, `Cascadia Code`, `monospace`) has no CJK glyphs, so the browser substitutes a fallback font, and nothing guarantees that fallback's glyph width is exactly double the primary font's.

That's a real, measurable fact about font metrics. But when this got investigated, it turned out the alignment problem it predicts had *already* been fixed, by a commit that landed on `main` (06b15a0, "Give wide glyphs their terminal width in browser-rendered ASCII") four days before the issue was even filed. And the fix wasn't a variation on `displayWidth()` at all. It couldn't be: `displayWidth()` computes a number of terminal columns for a *string*; it has no way to reach into how a browser lays out a *font*. The actual fix, in `demo/client.ts`'s `applyWideCharWidths()`, walks the rendered DOM after the ASCII string is generated and wraps every wide grapheme cluster in a `<span class="ascii-wide" style="width: 2ch">`, forcing the layout box to be exactly two character widths regardless of what the substituted font's own glyph metrics happen to be. Measured directly in a real browser: the raw CJK glyph's own bounding box is 11.2px against a 6.75px Latin baseline (the 1.66x the issue reported, still true and still unavoidable as a font fact), but the `.ascii-wide` span wrapped around it measures 13.48px, within rounding of the true 2x target. The font never got fixed; the layout stopped depending on the font.

Two things are true at once here, and the post would be lying by omission to collapse them into one: the *symptom*, "CJK text misaligns in this renderer, same as everywhere else," really was the same shape as #66/#182/#334. But the *fix* wasn't another display-width patch, because this renderer's failure mode lived one layer up, in font substitution the string-width math can't see at all. Same disease, different organ. The general lesson below still applies (this was still a case of one renderer's box-drawing having its own, previously-unverified width-correctness story), but "test every renderer" doesn't mean "apply the same patch everywhere." It means checking, per renderer, what actually determines its column width, and #344 is proof that isn't always the same answer.

## The lesson

Six issues, four real recurrences of one bug, one look-alike that turned out to need a different fix entirely. The shared root cause is worth stating plainly:

**Display width is not string length, not code-point count, and not even always grapheme count.** It's a property that has to be computed deliberately, and every one of these bugs happened at a boundary where that computation was implicit instead: a `.length` here, a `for...of` code-point loop there, an assumption that a font's fallback glyph would be exactly twice as wide as its primary glyph.

Two concrete practices come out of tracing all six of these end to end:

1. **Use a real grapheme-aware width library, and centralize it.** `src/ascii/display-width.ts` earned the comment at its own top calling itself "the single source of truth for how many terminal columns this text occupies... across the ASCII renderer." That sentence was only true after four fixes taught it what "renderer" actually needed to mean. `Intl.Segmenter` with `granularity: 'grapheme'` is the correct unit (available in Node without a fallback since v16); measuring anything narrower than a full grapheme cluster reintroduces #205 or #214 the moment real text arrives.
2. **Test every renderer that draws a box, not just the first one you fixed.** #66's fix was correct and complete for the code path it covered. It just didn't cover four other code paths that also draw boxes around text, and each one had to fail on its own before anyone noticed it needed the same treatment. A shared width helper is necessary but not sufficient. It only protects code that actually calls it, and this codebase had (at the time) at least five places that didn't.

That second point is the more durable one, and it's why this bug pattern connects to a separate, ongoing thread in this repo: issue #173 proposes sharing one box-drawing seam across the class, ER, and sequence ASCII renderers, instead of three renderers that each reimplement box-drawing and each get to independently forget to call the width helper. A shared *measurement* function, called from five different call sites that can each still drift, is a weaker guarantee than one *box-drawing* function with correct measurement built in, called from everywhere. The four real recurrences above are the evidence for why that refactor is worth doing before, not after, the next renderer gets added.
