---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a flowchart whose self-loop takes a long detour past rows no other path touches (a BT flowchart with an `n4 ==> n4` loop and nine edges) no longer throws `RangeError: Invalid array length`. The widening for a loop that shares a track with another edge added 2 to a row that had no height yet, which made the canvas height `NaN`.
