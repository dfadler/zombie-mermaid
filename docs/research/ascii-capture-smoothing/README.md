# Spike: smoothing the lines in real-PTY ASCII captures

Context: on #1278 the PR screenshots (`scripts/ascii-terminal-capture.sh`, asciinema + agg) show a
horizontal edge stepping up by 1-2px where it crosses a frame wall (`├──┼─┼─►`). Question: is that
the renderer's output, agg's rasteriser, or the font, and can the capture be made smooth?

## Findings

1. **The renderer's output is fine.** The row is `├ ─ ─ ┼ ─ ┼ ─ ►` (`U+251C U+2500 U+2500 U+253C
U+2500 U+253C U+2500 U+25BA`), all standard box-drawing characters. `main` emits the same.
2. **agg is the cause.** Feeding `├──┼─┼─►` alone to agg 1.9.0 reproduces the step. Measured bar rows
   (text row 0, `plain` = `─`, `junc` = the arm of `┼`/`├`), JetBrains Mono, line-height 1.4:

   | size | plain `─` | junction |
   | ---- | --------- | -------- |
   | 14   | y 19      | y 18-19  |
   | 16   | y 21      | y 20-21  |
   | 18   | y 25      | y 23-24  |
   | 24   | y 33-34   | y 31-32  |
   | 32   | y 43-44   | y 40-43  |
   | 40   | y 55-56   | y 51-54  |

   The mismatch grows with size, so it is not a rounding issue a font size can fix.

3. **agg options don't fix it.** Across JetBrains Mono, JetBrains Mono NL, Menlo, Monaco, Courier New
   and Andale Mono at 14-32px, the bars line up only by coincidence (Andale Mono at 14/16, Menlo at
   24, Monaco at 18). There is no setting that is correct in general.
4. **Chromium draws the same glyphs aligned.** The same two rows rendered as HTML text in headless
   Chromium (JetBrains Mono and Menlo, 14/16/18px, device scale 1x and 2x): the plain and junction
   bars have identical rows in all 12 cases.

## Implementation

`scripts/ascii-cast-to-png.mjs` replays the real-PTY `.cast` through `@xterm/headless` (the terminal
emulation is still real) and rasterises the cell grid with Chromium, one absolutely positioned cell
per glyph. `scripts/ascii-terminal-capture.sh` runs it when `ASCII_RASTERISER=chromium` is set (agg
stays the default):

```bash
ASCII_RASTERISER=chromium scripts/ascii-terminal-capture.sh ./src/index.ts 12 /tmp/after
```

On the #1278 captures the crossings are smooth (no step at `┼`/`├`). Wide glyphs get two cells
(checked on a Japanese flowchart: the box walls stay aligned). The PNG is rendered at 2x with agg's github-dark colours.

## Not done / open

- **Real terminals (GUI):** not checked here, since driving one would steal focus. Terminals that
  draw box characters themselves (iTerm, kitty, Alacritty) normally line these up; the Chromium
  result is the closest evidence we have.
- **Policy:** CLAUDE.md requires real-PTY captures, not the HTML mockup, for ASCII PR screenshots.
  This pipeline keeps the real PTY and terminal emulation and only swaps the glyph rasteriser, but
  the policy text should say so if it is adopted.
- **Colours:** ANSI-palette colours are mapped to a github-dark-style table, but no capture so far
  has used them (the recordings are uncoloured), so that path is untested.
- **Renderer-side option (not needed):** drawing frame-wall crossings with plain `─`/`│` would hide
  the artefact but lose the crossing cue, and it would change goldens. Finding 1 shows the output
  isn't broken, so I'd not do it.
- **Next step:** compare the two rasterisers on a few more samples (sequence, state) before
  considering making Chromium the default.
