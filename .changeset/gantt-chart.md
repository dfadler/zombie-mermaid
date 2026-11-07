---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Gantt charts. `gantt` diagrams now parse and render to SVG and ASCII/Unicode text ([#2835](https://github.com/dfadler/zombie-mermaid/issues/2835), under [#2085](https://github.com/dfadler/zombie-mermaid/issues/2085)). `DiagramType` gains `'gantt'` and `detectDiagramType` routes a `gantt` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseGantt` with the `GanttChart` and `Positioned*` types and the date helpers it is built on (`parseDayjs`, `formatDayjs`, `formatD3Time`, `timeTicks`): `dateFormat`, `axisFormat`, `tickInterval`, `excludes` / `includes`, `weekday` / `weekend`, `inclusiveEndDates`, `todayMarker`, `topAxis`, sections, the `active` / `done` / `crit` / `milestone` / `vert` tags, `after` / `until` references and durations, `click`, and the `gantt` keys of `%%{init}%%` and front matter that change what is drawn. The SVG uses Mermaid's geometry and d3 time axis, checked against mermaid 12.3.0 by the new `pnpm run gantt:oracle` (rows, bars, shaded days, ticks and labels match exactly), and the theme's colour variables. The ASCII output is this library's own design: a 60-column timeline with distinct glyphs per task state. Dates are UTC and the frame is a fixed 1200px wide; `topAxis` works here although mermaid 12.3.0 fails on that statement; see `docs/known-differences.md`.
