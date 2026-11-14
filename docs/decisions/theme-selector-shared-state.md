# Theme selector: shared state module, Default vs `zinc-light`, ASCII preview

Status: implemented

## Decision

Decisions (see the full write-up for the amendments):

1. Shared state module `demo/theme-state.ts` (`getTheme()`, `setTheme(themeKey)`, `subscribe(listener)`), SSR-safe, cross-tab sync via the `storage` event, Default encoded as key absence.
2. "Default" and `zinc-light` stay distinct options: Default keeps each gallery sample's baked-in colors, `zinc-light` forces a uniform override.
3. The ASCII terminal preview keeps its independent fixed palette and does not follow the global picker.
4. Revisiting either decision happens as an explicit amendment to this ADR, not a silent behavior change.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/685#issuecomment-6884745738
