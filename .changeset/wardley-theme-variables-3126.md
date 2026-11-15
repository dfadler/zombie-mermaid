---
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'zombie-mermaid': minor
---

Wardley maps read `themeVariables.wardley` (eleven colours) from a `%%{init}%%` directive or front matter, as mermaid 12.3.0 does (#3126). The ASCII renderer sizes its grid from `size [w, h]` and moves a label by its `[dx, dy]` offset. `InitConfig` gains `wardleyTheme`, `WardleyMap` gains `theme`, and `WARDLEY_THEME_KEYS` is exported. The `wardley-beta` config keys are not read: mermaid 12.3.0 drops them from a directive too.
