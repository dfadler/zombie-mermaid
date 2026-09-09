---
'zombie-mermaid': patch
---

The class-diagram parser now detects and throws on malformed constructs instead of silently dropping or mis-parsing them: a dangling relationship arrow with no target (e.g. `Animal <|--`), an unsupported arrow shape, an unclosed `class X { ... }` body, an unclosed `(` in a method signature, and a malformed `<<...>>` annotation. Errors report a 1-based source line number (building on the position tracking added for #760). Scoped the same way #722 scoped the ER and xychart-beta parsers: only lines that already look like an attempt at one of these constructs throw — genuinely unrelated syntax still falls through silently. No behavior change for valid input.
