# SVG ids are scoped per render

Status: implemented

## Context

Every SVG defined its markers with fixed ids (`arrowhead`, `seq-arrow`,
`cls-*`). With two diagrams inlined in one HTML document, every `url(#arrowhead)`
resolved to the first diagram's marker, and when that one sat in a
`display: none` container all later diagrams lost their arrowheads
([#1397](https://github.com/dfadler/zombie-mermaid/issues/1397)).

## Decision

Rewrite ids once, at the single choke point `renderMermaidSVG`
(`scopeSvgIds` in `packages/svg-renderer/src/index.ts`): every `id="..."`, and
each `url(#...)` and `href="#..."` pointing at it, gets a `zm<hash>-` prefix,
where the hash covers the whole SVG output. Decided and shipped in
[#1405](https://github.com/dfadler/zombie-mermaid/pull/1405) (merged
2026-10-07). Ids already starting `zm-` (aria title and desc, title-gap mask)
are unique already and left alone.

Rejected, per the #1405 description: renaming ids in each renderer separately.
The choke point also covers diagram types added later. Fixed ids were the bug.

## Consequences

- Tests and tooling that match marker ids must tolerate the prefix.
- The hash covers the output, so identical input and options give identical ids
  (`unique-svg-ids-1397.test.ts` asserts determinism); same text with different
  options gets different ids.
- By inspection of the hash, not covered by a test: two byte-identical renders
  inlined in one page share ids, so the #1397 failure could recur if the first
  is hidden. Unverified in a browser.
- An output with no `id` attributes is returned untouched.
