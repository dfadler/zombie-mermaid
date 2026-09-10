---
'zombie-mermaid': patch
---

Fix ASCII sequence-diagram `Note left of`/`Note right of` boxes colliding with lifelines (#953 cases 3-5). Notes are now sized into the lifeline layout up front (mirroring how message labels already widen lifeline gaps) instead of only clamping the note's x-position after the fact, so a wide note no longer overwrites its own actor's lifeline, a neighboring actor's lifeline, or overflows into the next lifeline gap.
