---
---

No release: replaces the homepage's interactive theme-picker-driven
showcase with a stylish, non-interactive one, ahead of a planned move of
the theme switcher itself into the header. The section now auto-cycles
every ~2.8s through all 15 `THEMES` entries and all 6 supported diagram
types (flowchart/sequence/class/state/er/xy-chart), reusing the real,
already-vetted Mermaid sources from `demo/diagram-pages-data.ts` — an
animated aurora/mesh background, a `:root { --bg/--fg/--accent }` code
panel, and a live diagram card, no interactive control anywhere on the
page.

Two follow-up fixes on top of the initial redesign:

- The diagram card and code panel were sized to their own content, so the
  section reflowed every tick as the cycle swapped between diagram types
  of very different natural aspect ratios. Both now have a pinned height
  (`overflow: hidden` as the clip fallback), with the diagram vertically
  centered and its own `max-height` so a taller diagram shrinks to fit
  instead of forcing the card to grow.
- The container's background already faded via a plain CSS transition,
  but the diagram's own fill/stroke colors were snapping instantly: each
  shape's color derives from `--bg`/`--fg` through an intermediate,
  unregistered custom property (`var(--_node-fill)`, itself a
  `color-mix()` of `--fg`/`--bg`), and Chromium doesn't detect a
  transitionable before/after value across that indirection. Registering
  `--bg`/`--fg` via `@property` would fix it but apply site-wide, since
  those same two names are also the page's own root theme tokens — too
  broad for a fix scoped to this one section. `demo/index-page-client.ts`
  instead hand-tweens the colors across the fade window via
  `requestAnimationFrame`, matching the container's `900ms ease` timing.

Demo-site UI only; nothing here touches the published `zombie-mermaid`
package.
