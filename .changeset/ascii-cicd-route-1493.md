---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: the CI/CD Pipeline sample's `Build Image --> Deploy Staging` edge now takes the A*-routed path (up and over the `Tests Pass?` row) instead of a direct-path fallback. The #1474 sealed-target guard stops sealed-target searches draining the render-wide path budget, so the edge's real search is no longer starved. This is an intentional output change; the #1474 note that output is unchanged was wrong for this diagram (#1493).
