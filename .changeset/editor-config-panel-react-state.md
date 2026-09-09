---
---

No release: moves the live editor's color picker, font picker, and config
panel onto React state (`demo/components/editor-app.tsx`'s reducer,
extended; `demo/components/editor-config.tsx`'s new `ConfigPanel`/
`useEditorConfig`), replacing `editor/js/config-panel.ts`, `color-picker.ts`,
and `font-picker.ts` (deleted) and their module-level mutable state
(`cfgColors`, `cfgFont`, `cfgPadding`, `cfgEdgeStroke`, `cfgNodeStroke`) —
the third of five editor sub-issues (#806-#810) in the #797 hydration
epic, building on #806/#807's hydration shell and viewport state.
`editor/js/rendering.ts` (not ported to React until #810) still needs the
merged color/font/padding overrides and the edge/node stroke multipliers
after every render; it now reaches them through a new
`window.__editorConfigState` bridge, following this repo's existing
`window.__mermaid`/`window.__themeState`/`window.__editorViewportState`
convention. A color field with no override shows the active theme's own
color as a placeholder, which needed the *reverse* direction of bridge
(legacy writes, React reads): a `zm-editor-theme-changed` window event,
dispatched by a new `setEditorTheme()` in `editor/js/state.ts` (now the
only place `state.theme` is written), since `state.theme` genuinely
diverges from the shared `window.__themeState`'s persisted preference
during dark-mode's auto-theme selection and URL-hash-restored themes,
both of which deliberately bypass that shared bridge.

One real bug surfaced only by live-browser (CDP) interaction testing:
picking a color/font or dragging the padding slider updated
`window.__editorConfigState` and the config panel's own UI correctly, but
the diagram preview itself never re-rendered — the deleted legacy modules
called `editor/js/rendering.ts`'s `scheduleRender()` directly after every
change, and this React port dropped that call entirely. Fixed with a
second, reverse-direction bridge (`window.__editorRenderTrigger`,
registered by `rendering.ts` itself) that `ConfigPanel` calls with the
same per-source debounce delays the deleted modules used. Edge/node
stroke changes don't go through this bridge at all — they're applied
directly to the currently-rendered SVG (mirroring the deleted
`makeStrokeSetter()`'s behavior), via a dedicated effect in
`useEditorConfig`.

No behavior change otherwise: color/font/padding/stroke value ranges and
clamping, popup open/close mechanics, outside-click dismissal, and the
theme-default color placeholder are pixel/interaction-identical to before —
verified with matching before/after screenshots (including the regression
bug above, both fixed and confirmed against the unmodified legacy code),
live interaction in a real browser (color/font/padding/stroke pickers all
actually exercised via CDP and the embedded browser tool, clean console, no
hydration warnings), sabotage-checked new RTL interaction tests under
`__tests__/dom/editor-config.test.ts` (replacing most of
`editor/__tests__/config.test.ts`, which keeps only its legacy
`state.theme`/`window.__themeState` coverage), and `editor/__tests__/*`'s
remaining suite (adjusted only for the new `window.__editorConfigState`
harness stub, otherwise unchanged and still passing). Closes #808. Nothing
here touches the published `zombie-mermaid` package.
