# No-script interactivity

## Context

`zombie-mermaid` renders Mermaid diagrams to static SVG (plus ASCII/terminal
and rasterized targets). The library has always emitted zero `<script>` tags
— the one existing interactive feature, xychart hover tooltips
(`RenderOptions.interactive`), is implemented entirely as markup and CSS in
`src/xychart/renderer.ts`:

```css
.xychart-bar-group:hover .xychart-tip,
.xychart-dot-group:hover .xychart-tip {
  opacity: 1;
}
```

No JavaScript, anywhere, ever. That is what makes the output safe to inline
into a page the library does not control, safe to hand to a rasterizer, and
meaningful whether it ends up as an SVG file, an embedded page fragment, or a
terminal frame.

This invariant was never written down. [#208](https://github.com/dfadler/zombie-mermaid/pull/208)
added `click` links/tooltips/callbacks, edge animation, and edge IDs, and in
the process emitted `data-click-callback="showDetail(...)"` — an attribute
that records a callback binding without invoking it, which is fine, but is
also the shape a future change could get wrong. Nothing in the codebase said
_why_ that attribute stops at recording rather than dispatching, so the next
person to touch it — human or agent — has no documented reason not to "finish
the job" and wire it up to `new Function()` or an event listener. This ADR is
that reason, written down before it's needed again.

## Decision

**The library emits zero `<script>`, under every render option, for every
diagram type, permanently.** Interactivity is only ever declarative — markup
and CSS — and is scoped into three tiers by how far each mechanism survives
across the library's output targets (SVG file on disk, an SVG inlined
directly into a host page's DOM, an SVG loaded via `<img src>`, a rasterized
PNG/JPEG, and ASCII/terminal text):

| Tier | Mechanism                               | SVG file | Inlined in page | `<img>`  | Rasterized       | ASCII              |
| ---- | --------------------------------------- | -------- | --------------- | -------- | ---------------- | ------------------ |
| 1    | `<title>`, plain text                   | survives | survives        | survives | survives         | survives (as text) |
| 2    | `<a href>`, CSS `:hover`, CSS animation | survives | survives        | inert    | first frame only | absent             |
| 3    | `click ... call fn()`                   | —        | needs host JS   | inert    | absent           | absent             |

- **Tier 1** never depends on a rendering context to mean something — a
  `<title>` reads as a tooltip in a browser, as an accessible name for
  assistive tech, and as literal text if someone greps the SVG source. It is
  the only tier that survives ASCII output.
- **Tier 2** needs an interactive SVG renderer to do anything. It survives as
  a standalone `.svg` file and when inlined into a page's DOM, because both
  contexts execute the SVG's own CSS. It goes inert under `<img>`, because
  browsers render an `<img>`-loaded SVG in _secure static mode_ — links don't
  navigate, `:hover` doesn't fire. A rasterizer captures one frame of a CSS
  animation and then stops, so animation becomes indistinguishable from a
  plain static line. ASCII output has no markup or CSS to carry it, so tier 2
  disappears entirely there — with one opt-in exception: `renderMermaidASCII`'s
  `hyperlinks: true` (CLI `--hyperlinks`) wraps `click` hrefs in OSC 8
  terminal-hyperlink escapes, still declarative and still zero script, so a
  link is the one tier-2 mechanism that can survive every target, terminal
  included, when the caller asks for it ([#216](https://github.com/dfadler/zombie-mermaid/issues/216)).
- **Tier 3** is the one this library refuses to implement, at any render
  option, for any diagram. `click A call fn()` is parsed and exposed as data
  (`NodeInteraction.callback`, and the `interactions` map from
  `parseMermaid()`) but is never executed by this library. A host application
  that trusts its diagram source can bind that data to real behavior itself
  — that is a decision only the host is positioned to make, because only the
  host knows whether its diagram source is trusted input or arbitrary text
  from an untrusted user.

`RenderOptions.interactivity` (`'none' | 'static' | 'full'`, see
`src/types.ts`) is the caller-facing knob for how much of tiers 1–2 render,
because the _caller_ — not the diagram author — knows which output target a
render is headed for (a live embedded page vs. a PNG for a slide deck vs. a
terminal). See that option's TSDoc for exactly what each level does and does
not gate.

## Consequences

- **No client-side runtime by default.** The `zombie-mermaid` package itself
  ships zero bundled JS — a hydration step, a `zombie-mermaid/react`
  interactive component, or any script shipped alongside the SVG is off the
  table for the default output. A diagram is a self-contained asset, and
  that property isn't up for trading away implicitly. An explicitly opt-in,
  clearly-separate runtime is a different question, left open (not decided
  either way) in [#236](https://github.com/dfadler/zombie-mermaid/issues/236)
  — it does not change what today's default import does or doesn't execute.
- **`interactions.callback` (and its `data-click-callback` predecessor) is
  never executed under any current or future option.** A `full` interactivity
  level does not mean "run diagram-supplied code" — it only
  ever means "render more of tiers 1–2." Anyone re-proposing callback
  execution needs to argue against this ADR explicitly, not just against the
  current option surface.
- **`<img>`-embedding silently loses tier 2.** This is inherent to how
  browsers sandbox `<img>`-loaded SVGs and is not something this library can
  work around from the SVG side. It is also why the React integration guide
  (`docs/react-integration.md`) recommends `dangerouslySetInnerHTML` over an
  `<img src="data:image/svg+xml,...">` approach — inlining is what keeps
  links and hover working. That recommendation predates this ADR and wasn't
  previously justified in the doc itself; a one-line note pointing back here
  has been added alongside it.
- **Rasterizing loses motion, not meaning.** A PNG/JPEG render of an animated
  edge is not broken — it is tier 2 doing exactly what the table above says
  it does under that output target. `interactivity: 'none'` exists so a
  caller heading for print/raster can ask for the still frame up front
  instead of getting it as an accidental side effect of the output format.
- **A future change that makes tier 3 do something at runtime is not a bug
  fix or an enhancement — it is a reversal of this decision** and needs its
  own ADR (or an explicit amendment to this one), not a quiet PR.
