# Slim ASCII entry points: measurements, and why the work moves to the terminal package

Status: not adopted (maintainer, 2026-10-30: no slim subpaths on `ascii-renderer`; size work moves to the terminal package, #2457)

## Decision

- Not adopted: no slim subpaths on `ascii-renderer`; `renderMermaidASCII` stays synchronous and complete.
- Size work moves to the terminal package (#2457, a child of #2144), unscheduled.
- Rationale: a consumer needing one diagram type still ships all eight via the static `asciiRegistry`; the only levers (additive subpaths, opt-in registration) were costed and not planned for this package.
- The measurements and subpath design are kept on the issue as input to the terminal package.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/2086#issuecomment-6884736577
