---
title: What happened to our package sizes between 2.2.6 and 5.0.1
date: 2026-10-10
description: We re-measured every published zombie-mermaid package on npm, packed and unpacked, at 2.2.6 and 5.0.1. The total dropped about 18% packed and 20% unpacked, three packages got bigger, and two causes account for most of the savings.
---

Between 2.2.6 (2026-09-21) and 5.0.1 (2026-10-10) the six published packages went from about 7.44 MB to about 5.94 MB unpacked. That is the headline number, and it is a little misleading: three of the six packages got bigger. This post lists the measured numbers for every package and explains the two changes behind most of the savings.

## How these numbers were taken

For each package I ran `npm pack --dry-run --json <name>@<version>` against the npm registry from a scratch directory, outside the repo, and read `size` (the packed tarball, which is what a download costs) and `unpackedSize` (what lands in `node_modules`). I did not install anything. Two earlier figures in circulation, from an internal report, were unpacked-only and did not include packed sizes; the packed column below is new.

I'm not reporting gzip numbers from our README badges. Those badges changed definition in this window (they now include dependencies), so an old badge and a new badge don't measure the same thing.

## The numbers

| Package                          | Packed 2.2.6  | Packed 5.0.1  | Unpacked 2.2.6 | Unpacked 5.0.1 | Files    |
| -------------------------------- | ------------- | ------------- | -------------- | -------------- | -------- |
| `zombie-mermaid`                 | 309,513       | 24,148        | 1,253,846      | 74,590         | 109 → 16 |
| `@zombie-mermaid/core`           | 227,901       | 142,952       | 618,569        | 435,761        | 28 → 8   |
| `@zombie-mermaid/mermaid-parser` | 150,164       | 199,747       | 499,820        | 669,228        | 26 → 8   |
| `@zombie-mermaid/svg-renderer`   | 383,658       | 510,232       | 1,468,214      | 1,818,151      | 34 → 9   |
| `@zombie-mermaid/ascii-renderer` | 869,978       | 770,064       | 3,244,612      | 2,819,450      | 233 → 9  |
| `@zombie-mermaid/mcp`            | 96,977        | 25,222        | 355,020        | 120,447        | 17 → 8   |
| **Sum**                          | **2,038,191** | **1,672,365** | **7,440,081**  | **5,937,627**  |          |

All sizes are bytes. The sum is about 18% smaller packed and about 20% smaller unpacked.

One caveat on the sum: `zombie-mermaid` is a thin wrapper that depends on the other five at the exact same version, so installing it pulls in all of them. The umbrella package shrinking by 94% unpacked does not make an install 94% smaller. The column that matches what an install costs for the umbrella is the sum.

## Cause 1: `src/` is no longer published

In 2.2.6 the tarballs shipped both `dist/` and a copy of `src/`. Breaking the 2.2.6 contents down by top-level directory:

- `zombie-mermaid`: 966,469 of 1,253,846 unpacked bytes were `src/` (77%), and 263,323 were `dist/`.
- `@zombie-mermaid/ascii-renderer`: 1,234,877 of 3,244,612 unpacked bytes were `src/` (38%), with 2,005,782 in `dist/`.

In 5.0.1 the umbrella and `ascii-renderer` contain no `src/` at all, which is where most of the file-count drop comes from (233 files down to 9 for `ascii-renderer`). This came from [#1446](https://github.com/dfadler/zombie-mermaid/issues/1446), "drop duplicated src from tarballs, remove unused deps", which merged as part of 5.0.0. `mcp` dropping from 355,020 to 120,447 unpacked bytes fits the same pattern, though I only broke down the umbrella and `ascii-renderer` by directory.

## Cause 2: `elkjs` is an optional peer dependency

`elkjs` is the ELK layout engine, and it is large: the registry reports 8,137,099 unpacked bytes for `elkjs@0.11.0`. In 2.2.6, `@zombie-mermaid/core` listed it as a regular dependency, so every consumer got it, including people who only wanted ASCII output.

In 5.0.1, per the registry manifests:

- `@zombie-mermaid/core` has no dependencies.
- `@zombie-mermaid/ascii-renderer` depends only on `core` and `mermaid-parser`.
- `@zombie-mermaid/svg-renderer` declares `elkjs` as an optional peer dependency (`peerDependenciesMeta.elkjs.optional: true`).

This is [#1444](https://github.com/dfadler/zombie-mermaid/issues/1444), a breaking change in 5.0.0 that adds `registerElk()` so you hand the renderer your own `ELK` instance. The tradeoff is that browser and bundler apps now have to call it once:

```ts
import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk } from 'zombie-mermaid'

registerElk(ELK)
```

The savings here don't show up in the table, because `npm pack` measures only the package's own files, not what it pulls in. They show up in `node_modules`: an ASCII-only install of `@zombie-mermaid/ascii-renderer` no longer brings in the elkjs tree at all. I did not install the packages to measure the resulting `node_modules` size, so I'm not putting a number on that.

One thing worth stating plainly: the umbrella `zombie-mermaid@5.0.1` still lists `elkjs` as a regular dependency, so installing the umbrella still installs it. The opt-out applies to the standalone packages.

## Why three packages got bigger

`@zombie-mermaid/mermaid-parser` grew about 34% unpacked (499,820 to 669,228) and `@zombie-mermaid/svg-renderer` about 24% (1,468,214 to 1,818,151). Both packages gained code in this window; the internal report this post was drafted from puts source growth at roughly 3.7k to 8.2k TypeScript lines for the parser and 9.5k to 17.2k for the SVG renderer. I haven't broken those increases down by feature, so I won't claim which diagram types account for what.

`@zombie-mermaid/ascii-renderer` is the interesting one: it lost its `src/` copy and still only fell about 13% unpacked (3,244,612 to 2,819,450), because its `dist/` grew to absorb the savings. Its TypeScript source reportedly grew from about 31k to 47k lines over the same period.

## What we're not claiming

- Bundle size in your app depends on your bundler and what you import. These numbers are package sizes on npm, not bundle sizes.
- The comparison is exactly two versions. I did not measure the versions in between, so I can't say which release each change landed in beyond what the linked issues say.
- Runtime speed was not part of this measurement.
