---
'zombie-mermaid': patch
---

The sequence-diagram parser now detects syntactic errors in addition to its existing semantic checks: a malformed arrow (e.g. `Alice->>>Bob: Hello`, which previously silently created an actor literally named `">Bob"` instead of erroring) now throws instead of absorbing the malformed portion into an actor id; an `end` with nothing open to close now throws instead of being silently ignored; and a `loop`/`alt`/`opt`/`par`/`critical`/`break`/`rect`/`box` left unclosed at the end of the diagram now throws instead of being silently accepted as closed. Errors report a 1-based source line number (building on the position tracking added for #760). No behavior change for valid input.
