---
title: ascii-renderer and svg-renderer are now standalone packages
date: 2026-09-21
description: "@zombie-mermaid/ascii-renderer and @zombie-mermaid/svg-renderer are now documented, supported standalone packages on npm — install just the piece you need instead of the whole umbrella."
---

If all you want from `zombie-mermaid` is terminal output, you no longer need
the SVG half along for the ride. `@zombie-mermaid/ascii-renderer` and
`@zombie-mermaid/svg-renderer` are now documented, supported packages in
their own right — not just internal pieces the umbrella happens to be built
from.

## What's new

Both packages ship a real README with install instructions and usage
examples verified to actually run against the built package, not written
from memory:

```bash
npm install @zombie-mermaid/ascii-renderer
```

```ts
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

renderMermaidASCII('graph LR\n  A --> B')
```

Pure TypeScript, no DOM, no `elkjs`/SVG layout dependency pulled in — the
same renderer behind `zombie-mermaid/ascii`, just without the rest of the
package.

`@zombie-mermaid/svg-renderer` is the lower-level counterpart: the
ELK.js-backed layout engine and per-diagram-type SVG emitters behind
`zombie-mermaid`'s `renderMermaidSVG`. It's aimed at custom integration
work — reusing the layout adapters, or wiring up a different dispatch layer
— rather than at "I just want SVG out," which `zombie-mermaid`'s own
`renderMermaidSVG(text)` already covers more simply. It doesn't yet have its
own single-function front door for parity with `ascii-renderer`; that's
tracked separately in [#1111](https://github.com/dfadler/zombie-mermaid/issues/1111).

## What's not changing

`@zombie-mermaid/core` and `@zombie-mermaid/mermaid-parser` stay
internal-only — they version and publish alongside everything else in this
repo's fixed changeset group, but they're not documented or supported for
standalone use. Same for `@zombie-mermaid/mcp`. Nothing about installing
`zombie-mermaid` itself changes; `renderMermaidSVG` and `zombie-mermaid/ascii`
still pull in the exact same code they always did.

This isn't a breaking change and doesn't need a migration guide — it's a new
way to consume renderers that already existed, for anyone whose bundle size
or dependency graph cares about not pulling in the half they don't use.

## Where this came from

This was a product call, not a technical one: [#622](https://github.com/dfadler/zombie-mermaid/issues/622)
scoped the monorepo's publish strategy, and the repo owner decided
`ascii-renderer` and `svg-renderer` were worth promoting to first-class
public packages while `core`, `mermaid-parser`, and `mcp` stay internal. The
docs landed in [#1112](https://github.com/dfadler/zombie-mermaid/pull/1112).
