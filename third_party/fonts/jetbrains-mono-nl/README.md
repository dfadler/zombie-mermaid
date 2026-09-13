# JetBrains Mono NL (vendored source)

`JetBrainsMonoNL-Regular.ttf` is the unmodified "No Ligatures" build from
JetBrains's own [JetBrainsMono releases](https://github.com/JetBrains/JetBrainsMono/releases),
version `v2.304` (`fonts/ttf/JetBrainsMonoNL-Regular.ttf` inside that
release's zip). The "NL" build ships with no `GSUB` ligature table at all —
chosen over the default JetBrains Mono specifically so this repo's ASCII
output can never suffer the ligature-fusion bug
([#978](https://github.com/dfadler/zombie-mermaid/issues/978)) by
construction, rather than depending on every ASCII-rendering CSS rule
remembering `font-variant-ligatures: none`.

Licensed under the [SIL Open Font License 1.1](./OFL.txt) (see also
`AUTHORS.txt`).

This file is a **build input**, not something any page serves directly —
`scripts/build-mono-font-subset.ts` subsets it down to just the glyphs the
site's ASCII output needs (Basic Latin, Latin-1 Supplement, Box Drawing,
Block Elements) and embeds the result as a base64 `woff2` in
`demo/components/generated/mono-font-subset.ts` and `demo/styles.css`. See `docs/decisions/ascii-browser-font-investigation-978.md` (introduced by
[#1044](https://github.com/dfadler/zombie-mermaid/pull/1044)) for why
self-hosting this font (over Google Fonts' CDN copy, or a purpose-built/
CJK-merged alternative) was the right call.

To update to a newer JetBrains Mono NL release: replace this `.ttf` with
the new version's copy, update the version noted above, then re-run
`pnpm run build:mono-font`.
