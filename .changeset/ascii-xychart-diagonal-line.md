---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII xychart `line` series follow the diagonal between data points as a fine staircase, one small `╭─╯` step per category row or column, instead of one large right-angle jump between points. A peak or trough now turns at its tip instead of leaving a stub. Horizontal and vertical charts, Unicode and `useAscii` output all change.
