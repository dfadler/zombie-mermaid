# Theme selector: shared state module, Default vs `zinc-light`, ASCII preview

Settles the architecture questions [#685](https://github.com/dfadler/zombie-mermaid/issues/685)
raised, ahead of [#686](https://github.com/dfadler/zombie-mermaid/issues/686)–[#690](https://github.com/dfadler/zombie-mermaid/issues/690)
restoring a global theme selector (tracked in [#684](https://github.com/dfadler/zombie-mermaid/issues/684)).
Full context, rationale, and the recovered pre-#590 implementation this
restores are in
[a comment on #685](https://github.com/dfadler/zombie-mermaid/issues/685)
rather than duplicated here.

## Decisions

1. **Shared state module: `demo/theme-state.ts`** (`getTheme()` /
   `setTheme(themeKey)` / `subscribe(listener) => unsubscribe`, plus
   `THEME_STORAGE_KEY`/`DEFAULT_THEME_KEY`). SSR-safe, cross-tab sync via the
   `storage` event, Default encoded as key absence — matching the old
   `demo/client.ts` behavior this restores. Implemented and tested in this
   PR; not wired into any page yet.
2. **"Default" and `zinc-light` stay distinct options** — not collapsed.
   They render identically on a single-diagram page, but on the interactive
   gallery Default means "preserve each sample's own baked-in colors" while
   `zinc-light` forces a uniform override — a real, working feature that
   collapsing would silently remove.
3. **The ASCII terminal-preview keeps its independent fixed palette** — it
   does not follow the restored global picker, restoring the pre-#590
   rationale: a terminal-preview panel should show what ASCII output looks
   like in practice, governed by the viewer's own terminal palette, not by
   whatever theme a web page has selected.

## Consequences

- #686 builds the shared `ThemeBar`/`ThemePicker` component against
  `demo/theme-state.ts`'s `getTheme()`/`setTheme()`/`subscribe()` — no
  direct `localStorage` access in the new component.
- #687 (wiring the component into every page) inherits the Default-vs-
  `zinc-light` distinction as-is; no migration of stored preferences is
  needed.
- #689 (live re-theme + ASCII decision) implements the "keep ASCII fixed"
  branch of its own acceptance criteria, not the "wire it through
  `diagramColorsToAsciiTheme()`" branch.
- #690, whatever page-specific wiring it covers, can treat both decisions
  above as settled rather than re-litigating them.
- Revisiting either decision later is fine, but should happen as an
  explicit amendment to this ADR (mirroring the convention in
  `docs/decisions/no-script-interactivity.md`), not a silent behavior
  change buried in an unrelated PR.

## Amendment (#688): the Editor's preview-pane theme joins the shared state

This ADR's own scope deliberately left the Editor's independent theme
dropdown (`editor.ts`'s `THEME_LABELS`, `editor/js/init.js`'s
`bm-editor-theme` `localStorage` key) unaddressed — #688 is where that
question was actually decided, since it wasn't obvious from #685 alone.

**Decision: reconciled, not kept separate.** The Editor's preview-pane
theme now reads/writes the same shared `mermaid-theme` key via `demo/
theme-state.ts` (bridged onto `window.__themeState` for `editor/js/*.js`'s
plain, non-module scripts — see `demo/editor-theme-state-bridge.ts`),
replacing the separate `bm-editor-theme` key entirely (one-time migration
in `editor/js/init.js`, mirroring #687's `zm-diagram-page-theme`
migration in `demo/diagram-page-client.ts`).

Rationale: "which of the 15 built-in themes to render a diagram with" is
the same concept everywhere on the site — the Editor is not an exception,
it is one more surface that renders a diagram. Unifying that choice across
every page, the Editor included, is the actual point of the #684
restoration, not a side effect to avoid. This does **not** extend to
`bm-editor-dark` (`editor/js/dark-mode.js`), an unrelated IDE-chrome
light/dark toggle with no analog elsewhere on the site — only the diagram
theme choice is shared.
