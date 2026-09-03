---
'zombie-mermaid': patch
---

ASCII backend: fixed the "one"/"zero-or-one" crow's-foot marker on a horizontal ER relationship fusing with the entity border it sits against (issue #413) — flush placement worked for every marker whose border-adjacent glyph differs from the box border, but `│`/`|` markers are the exact same character as the vertical border glyph, so they read as a doubled border wall instead of a marker touching one. The fix restores a 1-cell gap, but only for a marker whose edge glyph actually collides with the border character; markers that never collided (`many`/`zero-many`) stay flush, matching standard ER notation. Vertical relationships are unaffected — their border glyph (`─`) never collides with any marker glyph in the first place.
