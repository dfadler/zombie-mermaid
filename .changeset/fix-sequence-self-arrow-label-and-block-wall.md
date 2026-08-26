---
'zombie-mermaid': patch
---

Fix two bugs in the ASCII sequence-diagram renderer's handling of self-arrows (`A->>A: ...`):

- A `<br/>` in a self-arrow label was written character-by-character onto a single canvas row with no newline handling, so the embedded `\n` corrupted every column to the right for the rest of the diagram. Self-arrow labels now split on `<br/>`/newlines the same way ordinary message labels, notes, and actor labels already do, giving each line its own correctly-indented row.
- A self-arrow inside an `alt`/`loop`/`opt` block could be drawn outside the block's wall, because the wall's width was computed from lifeline positions only and ignored the self-arrow's loop glyphs (`├──┐` … `◀──┘`) and label extent. The block wall now also accounts for any self-arrow within its message range, so the header, loop corners, and label no longer get clipped or overwritten.
