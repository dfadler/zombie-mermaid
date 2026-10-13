---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII color auto-detection now honors `NO_COLOR` and `FORCE_COLOR` (`FORCE_COLOR` wins), and `TERM=dumb` now beats `COLORTERM`. Fixes [#1863](https://github.com/dfadler/zombie-mermaid/issues/1863).
