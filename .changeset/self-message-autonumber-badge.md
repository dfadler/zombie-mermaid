---
'zombie-mermaid': patch
---

ASCII sequence diagrams: a self-message (`A->>A: label`) under an active `autonumber` now draws its sequence-number badge on the loop's top arm (e.g. `├2───┐`), matching the badge already drawn on normal actor-to-actor messages. Previously the counter still advanced correctly but no badge glyph was drawn for a self-message, so a numbered self-message looked identical to an unnumbered one. The loop widens by the badge's digit count only when a sequence number is present — an unnumbered self-message renders unchanged.
