---
'zombie-mermaid': minor
---

Sequence diagrams now support `autonumber` (including `autonumber <start> <step>` and `autonumber off`), bidirectional arrows (`<<->>` / `<<-->>`), and multi-word/hyphenated actor names referenced inline without a prior `participant`/`actor` declaration (e.g. `cron job->>customer-notifier: hi`).
