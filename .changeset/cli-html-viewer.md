---
'zombie-mermaid': minor
---

`render --html` writes a self-contained HTML pan/zoom viewer instead of raw SVG — one file, no server, no network, opens straight from disk and survives being emailed. Drag/scroll to pan, ctrl/cmd+scroll or pinch to zoom, `Fit`/`1:1` buttons, keyboard shortcuts, and a light/dark toggle that follows `prefers-color-scheme`. `-o out.html`/`.htm` infers the flag; `-o -` streams it to stdout like `--svg`. Cannot be combined with `--svg` in one invocation (different content, same output slot) — run the command twice for both. This is the one place the project ships client-side JavaScript, and deliberately so: the wrapped viewer chrome, never the library's own SVG output, which stays script-free (see `docs/decisions/no-script-interactivity.md`).
