---
---

No release: moves the homepage's npm/pnpm/yarn/bun package-manager
selector (zombie-mermaid#719) from the header into the hero, next to the
"npm install zombie-mermaid" pill, so it no longer duplicates what the
hero already showed. Extracts the selector's popover/keyboard/copy state
into a shared `usePackageManagerInstall` hook so the header (every other
page) and the new hero instance run one implementation, and fixes a
layout-shift bug along the way: each manager's install command is a
different length, so switching managers used to resize the pill and
shove whatever sat next to it (most visibly the hero's CTA button) --
both pills now reserve a fixed width sized to the widest command.

Nothing here touches the published `zombie-mermaid` package.
