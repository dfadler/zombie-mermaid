---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII class diagrams no longer drop edges from a relationship cycle. A rootless cycle (`B --> C`, `C --> D`, `D --> B`) used to put every class on one row with only the back edge drawn; the cycle now stacks with its back edge running upward, and a class between the ends of that edge steps aside, as in Mermaid.
