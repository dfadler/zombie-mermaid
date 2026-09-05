---
'zombie-mermaid': patch
---

Fix `src/ascii/class-diagram.ts` failing to parse on `main` (the merge of #462 onto #463 closed the relationship `forEach` callback at the wrong brace, breaking lint, typecheck, and every test that imports the package), and make #462's per-relationship connection-column offsets and #463's label-territory pass agree: the territory precompute and the label-drawing pass now use the same offset columns as the line-drawing pass, so a reciprocal pair like `View --> Model : reads` / `Model ..> View : notifies` keeps both labels intact instead of truncating them into one mashed `rea……ies`.
