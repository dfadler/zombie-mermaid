---
'zombie-mermaid': minor
---

Finish the tier-2 gating for `RenderOptions.interactivity` left as follow-up in [#233](https://github.com/dfadler/zombie-mermaid/pull/233) (closes [#231](https://github.com/dfadler/zombie-mermaid/issues/231)):

- Flowchart/state-diagram edge animation (`e1@{ animate: true }`) now only renders under `interactivity: 'full'`. Previously it rendered under both the default (`'static'`) and `'full'` — CSS animation is tier-2 *motion*, which the stricter `'static'` reading (tier 1 + tier 2 minus motion) should exclude. **This is a breaking change**: a diagram opting into `e1@{ animate: true }` without passing `interactivity: 'full'` now renders as a still line instead of animating.
- `click`-based links (`<a href>`) and `<title>` tooltips are now stripped under `interactivity: 'none'`, alongside the animation it already stripped — `'none'` is meant for print/rasterized output, where a link is meaningless. `'static'` and `'full'` are unaffected; both still render links/tooltips as before.

See `docs/decisions/no-script-interactivity.md` for the tier model, and the `interactivity` TSDoc in `src/types.ts` for exactly what each level gates now.
