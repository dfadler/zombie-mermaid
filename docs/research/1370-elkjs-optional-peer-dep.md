# Research: `elkjs` as an optional peer dependency vs. the async-entry plan

As of: 2026-10-22, reviewed against `main` @ `bd0a701c`. The measurements below were taken on `0d61de15` and not re-run; paths were re-checked. Re-run `pnpm run build` and the size commands before quoting a number as current.

Status: **answered; recommendation below.** Written for
[#1370](https://github.com/dfadler/zombie-mermaid/issues/1370) (reduce the cost of bundling
`elkjs`, ~1.6 MB `elkjs/lib/elk.bundled.js`). Compares the issue's async-entry proposal
(`zombie-mermaid/async`, injected ELK constructor, retry on a "need layout" signal) against making
`elkjs` an optional peer dependency. Measured on `main` @ `0d61de15`, Node 24, `pnpm run build`.

## Conclusion

- Make `elkjs` an optional peer dependency with `registerElk()` plus Node auto-load; do not build the async entry now.
- Published `dist/` already leaves `elkjs` external; the cost is paid by the consumer's bundler or `node_modules`.
- Measured (esbuild, minified, gzip, browser): `svg-renderer` 516 KB to 74 KB; umbrella (svg + ascii) 573 KB to 129 KB.
- Sync `renderMermaidSVG` keeps working under the peer design (needs a registered constructor, not an async load).
- Breaking for browser-bundler and TypeScript consumers, so it needs a major; the softer variant is a `zombie-mermaid/no-elk` subpath.
- Reconsider a worker/async variant only if users ask, as a separate additive issue.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/1370#issuecomment-6884737747
