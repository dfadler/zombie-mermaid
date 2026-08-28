---
'zombie-mermaid': minor
---

Support the interactivity and configuration rows of the flowchart syntax audit (#198): `click`, `%%{init:...}%%` directives, edge curve styles, edge IDs with animation, and Mermaid's backtick markdown-string form.

**`click` interactions.** `click A "url" "tooltip" _target` and `click A call fn()` now parse. An href becomes a real SVG `<a>` link and a tooltip becomes a `<title>`, both working without script. Only `http`/`https`/`mailto` and relative or fragment references are emitted — a `javascript:` or `data:` href is dropped, since diagram text may be untrusted and an executable href would make any page that inlines the SVG vulnerable. An href containing a C0 control character is rejected outright: the URL parser strips tab and newline from anywhere in a URL, so `java<TAB>script:` would otherwise pass the scheme check as a relative reference and still reach the browser as `javascript:`. A callback is recorded as `data-click-callback` and never invoked; this renderer executes nothing a diagram supplies.

**`%%{init: ...}%%` directives.** Mermaid's relaxed JSON (unquoted keys, single quotes) is parsed, and a malformed directive is ignored rather than fatal. A directive supplies a default and never overrides an explicit render option. Keys that are parsed but deliberately not acted on — `securityLevel`, `defaultRenderer`, `fontFamily`, `htmlLabels`, `maxTextSize` — are reported with a reason rather than vanishing silently.

**Edge curve styles.** `flowchart.curve` accepts `linear`, `basis`, `natural`, `step`, `stepBefore`, and `stepAfter`. The default `linear` still emits `<polyline class="edge">`, so existing selectors keep working; only a non-linear curve switches to `<path>`. `basis` is a direct port of d3's `curveBasis`, verified to match its output exactly, so a curved edge traces the path Mermaid would draw. `natural` is deliberately _not_ d3's natural spline — see the note in `src/edge-curves.ts`.

**Edge IDs and animation.** `A e1@--> B` assigns an edge id, emitted as `data-id`, and `e1@{ animate: true }` renders a marching-ants dash via CSS keyframes, guarded by `prefers-reduced-motion`. Keyframes are emitted only when a diagram animates an edge.

**Markdown strings.** Mermaid's backtick-delimited form (``A["`**bold**`"]``) now has its backticks stripped; they previously rendered as literal characters. The `**bold**` / `*italic*` / `~~strike~~` conversions themselves already worked.
