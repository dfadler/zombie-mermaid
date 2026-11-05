---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: an ASCII class diagram whose fanned relationships run upward past an intermediate class (`D --> B` four times with `B --> C --> D` between) now lays out as Mermaid 12.3.0 does. The intermediate class steps aside beside the fan, on the side its own edge was declared on, the deeper class stays under the shallower one, and the labels sit on one row at the middle of the fan instead of over the intermediate class's rows.
