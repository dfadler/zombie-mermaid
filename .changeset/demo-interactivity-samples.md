---
'zombie-mermaid': patch
---

Demo-site only, plus one generator fix.

**Interactivity samples.** The demo now has an `Interactivity` category covering `click` links and tooltips, curve styles via `%%{init: ...}%%`, and an animated edge. These features shipped in #208 but nothing on the site exercised them, so the only way to see them working was a video attached to a merged PR.

They earn their place beyond coverage: every sample renders as both SVG and ASCII, side by side, so the pair shows which features survive the trip to a terminal. The animated edge marches in the SVG and is a plain dashed line in the ASCII panel beside it — the degradation is visible rather than asserted.

**Description escaping.** `formatDescription` applied its backtick-to-`<code>` transform to unescaped text, so a description quoting markup emitted real elements into the page. `<title>` was the damaging case: in body position the HTML parser switches to text mode and consumes the rest of the document, including the module script that boots the gallery. The page rendered a permanent loading spinner with an empty console — the script was never parsed, so it never ran and never threw.

Descriptions are now escaped before the transform. The helpers moved to `demo/format.ts` so they can be tested directly, since `index.ts` writes its output at module scope and cannot be imported from a test.
