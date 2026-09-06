# Using the self-contained HTML viewer

`zombie-mermaid render diagram.mmd --html` wraps a rendered diagram in a
pan/zoom viewer and writes it as one `.html` file:

```bash
zombie-mermaid render diagram.mmd --html          # writes diagram.html
zombie-mermaid render diagram.mmd --html -o out.html
```

The file has no external references — no CDN scripts, no network fonts, no
server. Open it straight from disk (double-click it, or drag it into a
browser tab) in any modern browser; it works the same over `file://` as it
would served over HTTP, and survives being emailed as a single attachment.
**You do not need to run a dev server, or any server, to use it.**

## Controls

| Action                   | Mouse / trackpad                                | Keyboard                                                  | Touch                                   |
| ------------------------ | ----------------------------------------------- | --------------------------------------------------------- | --------------------------------------- |
| Pan                      | Click-drag                                      | Arrow keys (hold Shift to pan faster)                     | One-finger drag                         |
| Zoom in/out              | Scroll wheel + Ctrl/Cmd, or the `−`/`+` buttons | `+`/`=` and `-`/`_`                                       | Pinch                                   |
| Zoom toward a point      | Ctrl/Cmd-scroll zooms under the cursor          | —                                                         | Pinch zooms around the two touch points |
| Reset zoom               | Double-click (toggles between fit and 2×)       | `0` fits the diagram to the window, `1` sets exactly 100% | —                                       |
| Toggle light/dark chrome | The theme button in the toolbar                 | `T`                                                       | Tap the theme button                    |

A plain scroll (no modifier) pans instead of scrolling the page — the whole
window is the viewer, so there's nothing else to scroll. Keyboard shortcuts
apply once the diagram area has focus, which happens automatically when the
page loads.

## The theme toggle only changes the viewer chrome

The light/dark button in the toolbar switches the _page background and
toolbar_ to follow your choice (it otherwise follows the OS's
`prefers-color-scheme` automatically). It does **not** change the diagram's
own colors — those were baked into the SVG at render time by whatever
`--theme` (or the default) was in effect when you ran `render`. If you want
the diagram itself to look different, re-render with a different
`--theme <name>` (see `zombie-mermaid themes` for the list) rather than
expecting the toolbar toggle to do it.

## Printing

The toolbar is hidden under `@media print`, and the diagram switches from a
fixed, pannable stage to normal document flow — printing (or "Save as PDF")
gives you a clean page with just the diagram, not the viewer UI.

## Where the interactivity lives

This viewer is the one place in the project that ships client-side
JavaScript, and deliberately so: the library's own SVG output stays
permanently script-free (see
[`docs/decisions/no-script-interactivity.md`](../decisions/no-script-interactivity.md)).
The pan/zoom/theme script is a separate CLI artifact wrapping that output —
the embedded SVG itself is byte-for-byte what `renderMermaidSVG` produced.
