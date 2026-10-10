# @zombie-mermaid/mcp

## 5.0.0

### Major Changes

- [#1444](https://github.com/dfadler/zombie-mermaid/pull/1444) [`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1) Thanks [@dfadler](https://github.com/dfadler)! - **BREAKING:** `elkjs` is now an optional peer dependency of `@zombie-mermaid/svg-renderer` (and no longer a dependency of `@zombie-mermaid/core`), and the library no longer imports it. Browser and bundler apps that render flowchart, state, class, ER or architecture diagrams must `npm install elkjs` and call the new `registerElk(ELK)` once (`import ELK from 'elkjs/lib/elk.bundled.js'`); otherwise rendering those diagrams throws `ElkNotRegisteredError`. Under Node and Bun, `elkjs` is auto-loaded when installed, and `zombie-mermaid` and `@zombie-mermaid/mcp` still depend on it, so the CLI and MCP server need no change. Sequence, pie, xychart, C4 and ASCII output never needed it. In exchange, the SVG renderer's browser bundle drops from about 518 KB to 74 KB gzipped (umbrella 576 KB to 130 KB) when elk is not registered, and the published `.d.ts` files no longer import from `elkjs` (the `Elk*` graph types are now exported by `@zombie-mermaid/core`). See `docs/guides/elkjs-optional-peer.md`.

### Patch Changes

- [#1446](https://github.com/dfadler/zombie-mermaid/pull/1446) [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3) Thanks [@dfadler](https://github.com/dfadler)! - Smaller tarballs: stop publishing `src/` (source maps already embed it via `sourcesContent`), and drop the unused `entities` dependency declaration from mcp (refs [#1426](https://github.com/dfadler/zombie-mermaid/issues/1426)).
- Updated dependencies [[`4503879`](https://github.com/dfadler/zombie-mermaid/commit/4503879bc8a8e6278af76d7e2d01169d1818c665), [`a729295`](https://github.com/dfadler/zombie-mermaid/commit/a72929571406147b3676107e2c5d5d6abbd703fc), [`e38848d`](https://github.com/dfadler/zombie-mermaid/commit/e38848dd48e66b732c6fd7f0c667e91643c2840c), [`b7d7c58`](https://github.com/dfadler/zombie-mermaid/commit/b7d7c580281cea1c184bc7e4d0b3aeb77861a098), [`e16dc91`](https://github.com/dfadler/zombie-mermaid/commit/e16dc91291843c52b960efd1f425f0fc33bdb915), [`b4a89b4`](https://github.com/dfadler/zombie-mermaid/commit/b4a89b4434815220373dcaea9c5eb963a3d811b8), [`4d8a9e4`](https://github.com/dfadler/zombie-mermaid/commit/4d8a9e424ba691a45aac4e37bcd6f6d2b5b0292d), [`105f069`](https://github.com/dfadler/zombie-mermaid/commit/105f069435db9ebf1b33a15aff770b2f77b134d8), [`6202ea2`](https://github.com/dfadler/zombie-mermaid/commit/6202ea2667ebefef4e394e9b6856f8ff081dc41f), [`89c25c4`](https://github.com/dfadler/zombie-mermaid/commit/89c25c44f24c2e6ae61c84e217ee1afa22e58e16), [`204487a`](https://github.com/dfadler/zombie-mermaid/commit/204487a85e1eff57ccedf2900d3b4e6f426e5125), [`78df967`](https://github.com/dfadler/zombie-mermaid/commit/78df96703c21c262f7aa8a4285d79f1ae5ebcca2), [`ad232b8`](https://github.com/dfadler/zombie-mermaid/commit/ad232b81d037f045114990f96a406ef554be94a3), [`645fd05`](https://github.com/dfadler/zombie-mermaid/commit/645fd05d8e62ea5acdcb7573fea6d8aba50be6ad), [`5c8967b`](https://github.com/dfadler/zombie-mermaid/commit/5c8967b26c0d290473d27701f0059d30332603c6), [`3be6d07`](https://github.com/dfadler/zombie-mermaid/commit/3be6d07368e5087f1b9da80dbfaa9edb5828f3b2), [`213ae4a`](https://github.com/dfadler/zombie-mermaid/commit/213ae4aa12799ab5d88c2c8234d3fad584b20e82), [`cd6153b`](https://github.com/dfadler/zombie-mermaid/commit/cd6153b0defff666120ec93149a0d3c163d92838), [`36448f7`](https://github.com/dfadler/zombie-mermaid/commit/36448f784cc7de50cfe90d71fcbe5c5eb80f5d1a), [`3b4c0ad`](https://github.com/dfadler/zombie-mermaid/commit/3b4c0adfbaa9f889b3c471d8100af40acc11f11e), [`2b55b7d`](https://github.com/dfadler/zombie-mermaid/commit/2b55b7d066b0b1d06f57e293bcc30ae446a384f1), [`4583ab7`](https://github.com/dfadler/zombie-mermaid/commit/4583ab743e1634ed06c274d62bf674f53086544f), [`5ca72d5`](https://github.com/dfadler/zombie-mermaid/commit/5ca72d5e2bda0a0430f828b708ff0c32630af31f), [`dbedcfc`](https://github.com/dfadler/zombie-mermaid/commit/dbedcfc42dbf08a8d5963ceba3dd6e7f42bb62e3)]:
  - @zombie-mermaid/ascii-renderer@5.0.0
  - @zombie-mermaid/core@5.0.0
  - @zombie-mermaid/mermaid-parser@5.0.0
  - @zombie-mermaid/svg-renderer@5.0.0

## 4.2.3

### Patch Changes

- Updated dependencies [[`3cfd4c0`](https://github.com/dfadler/zombie-mermaid/commit/3cfd4c0d5f1cdf3dae82f4e5fd8a934f6ef8b70b), [`1bfc76e`](https://github.com/dfadler/zombie-mermaid/commit/1bfc76ecd6db50b18d9d6b147863ce60fd65d2e3), [`cfa74cd`](https://github.com/dfadler/zombie-mermaid/commit/cfa74cded88f56b88f228f0f886d5d83689e7eff), [`1f524f8`](https://github.com/dfadler/zombie-mermaid/commit/1f524f8cb074eca81b2c9aedd0bb51788356f48a), [`555cbfb`](https://github.com/dfadler/zombie-mermaid/commit/555cbfbe627df56261d2191a0e3b7286e4d33f0d), [`2a29580`](https://github.com/dfadler/zombie-mermaid/commit/2a295809f975afe7a1f9c00a5f45c46c03d2cc93), [`c0eed80`](https://github.com/dfadler/zombie-mermaid/commit/c0eed80f2abe099733b169ef7a2f348077a2e903), [`a637027`](https://github.com/dfadler/zombie-mermaid/commit/a6370270f9afed0a4e4cdfac6c40a08468344e6b), [`2f9993c`](https://github.com/dfadler/zombie-mermaid/commit/2f9993cf88961c532225a406b6a9f911a401c3bc)]:
  - @zombie-mermaid/ascii-renderer@4.2.3
  - @zombie-mermaid/svg-renderer@4.2.3
  - @zombie-mermaid/core@4.2.3
  - @zombie-mermaid/mermaid-parser@4.2.3

## 4.2.2

### Patch Changes

- Updated dependencies [[`b4091ce`](https://github.com/dfadler/zombie-mermaid/commit/b4091ce0c90c3ea3b5bd1bdf0d2471f22ec1f1f9), [`cb7d2ab`](https://github.com/dfadler/zombie-mermaid/commit/cb7d2ab91d4a7c91e4dabedcfa6ab121450a8c2e)]:
  - @zombie-mermaid/ascii-renderer@4.2.2
  - @zombie-mermaid/svg-renderer@4.2.2
  - @zombie-mermaid/core@4.2.2
  - @zombie-mermaid/mermaid-parser@4.2.2

## 4.2.1

### Patch Changes

- Updated dependencies [[`245e76b`](https://github.com/dfadler/zombie-mermaid/commit/245e76b8c32e4e3234414d68a8bfb7de522f8cc4)]:
  - @zombie-mermaid/ascii-renderer@4.2.1
  - @zombie-mermaid/core@4.2.1
  - @zombie-mermaid/mermaid-parser@4.2.1
  - @zombie-mermaid/svg-renderer@4.2.1

## 4.2.0

### Patch Changes

- [#1371](https://github.com/dfadler/zombie-mermaid/pull/1371) [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7) Thanks [@dfadler](https://github.com/dfadler)! - Pie charts, part 1: parsing and detection. `DiagramType` gains `'pie'`, and `detectDiagramType` routes a `pie` header to it (case-sensitively, as Mermaid does). `@zombie-mermaid/mermaid-parser` adds `parsePieChart` with the `PieChart`/`PieSlice` types (title, accTitle, accDescr, showData, slices in source order). The parser accepts and rejects the same input as Mermaid's own pie grammar: labels must be quoted, negative values are errors, zero is allowed, a repeated label keeps its first value, `showData` is only valid on the header line, and a bare `pie` with no slices is valid. `renderMermaidSVG` and `renderMermaidASCII` route a pie chart to the pie parser (so syntax errors are reported with their line) instead of misrouting it to the flowchart parser; the rendering itself is covered by the separate pie SVG and ASCII renderer changesets. Based on [lukilabs/beautiful-mermaid#151](https://github.com/lukilabs/beautiful-mermaid/pull/151) by @birenroy, with strictness ideas from [lukilabs/beautiful-mermaid#150](https://github.com/lukilabs/beautiful-mermaid/pull/150) by @Daniele-rolli.
- Updated dependencies [[`6f4b53a`](https://github.com/dfadler/zombie-mermaid/commit/6f4b53a8b5610cf09025b32983d53dc3d7ac3aa9), [`c12701b`](https://github.com/dfadler/zombie-mermaid/commit/c12701bef5199ce826bf94d6752f48a641be104a), [`907dfd8`](https://github.com/dfadler/zombie-mermaid/commit/907dfd82a8f28ca97d800dbfd9578d77bd6a3e92), [`d08774b`](https://github.com/dfadler/zombie-mermaid/commit/d08774b6bc50febc270517f590b647e945fdb832), [`9ef5170`](https://github.com/dfadler/zombie-mermaid/commit/9ef5170e2d182e178d278f9babff4f16dc955bcf), [`163971e`](https://github.com/dfadler/zombie-mermaid/commit/163971e94e0a82d8b9b083b10b80883a74b8ad9e), [`e8c1a17`](https://github.com/dfadler/zombie-mermaid/commit/e8c1a17611c522c67bf3c1a2b2b407ef4e245208), [`85b1a50`](https://github.com/dfadler/zombie-mermaid/commit/85b1a50bad3ab93348e65469a5b343ac0a1683b5), [`3e73862`](https://github.com/dfadler/zombie-mermaid/commit/3e73862ebe6b9a72532efc360df773b1818ceca2), [`571a164`](https://github.com/dfadler/zombie-mermaid/commit/571a164cce7189a1bdf5aeabd8c3a0131d999c0f), [`b969f18`](https://github.com/dfadler/zombie-mermaid/commit/b969f185961dff1dc695516676b57db110bdf6c5), [`57105eb`](https://github.com/dfadler/zombie-mermaid/commit/57105eb7412473e1270503b78498aa508a76e7d8), [`cf496ab`](https://github.com/dfadler/zombie-mermaid/commit/cf496ab5bb0ceb39f7399364ac09a07787855e5e), [`700b97b`](https://github.com/dfadler/zombie-mermaid/commit/700b97bcbf5adeec39a438e7257fff71deff6fb6), [`1d80500`](https://github.com/dfadler/zombie-mermaid/commit/1d80500be04273e2abe078e9c1e2c588049adbe2), [`d1e8208`](https://github.com/dfadler/zombie-mermaid/commit/d1e8208919305e90d377783e8975da05fd0f214b), [`0dbcd78`](https://github.com/dfadler/zombie-mermaid/commit/0dbcd78d533411da8605910ff13e03ca169bd7b7), [`70f3c78`](https://github.com/dfadler/zombie-mermaid/commit/70f3c78039c70455c0833bc1f8d12965db41dd64)]:
  - @zombie-mermaid/ascii-renderer@4.2.0
  - @zombie-mermaid/mermaid-parser@4.2.0
  - @zombie-mermaid/core@4.2.0
  - @zombie-mermaid/svg-renderer@4.2.0

## 4.1.0

### Patch Changes

- Updated dependencies [[`ab5ff8f`](https://github.com/dfadler/zombie-mermaid/commit/ab5ff8f6a8000963db021b6a851b6abaea5939d8), [`c392d1a`](https://github.com/dfadler/zombie-mermaid/commit/c392d1a0535dfdc11465114aa1a2c77397fd7c9b), [`ca51046`](https://github.com/dfadler/zombie-mermaid/commit/ca51046c8bc541c1442d7f9551fa9413137b40d0), [`0b2b607`](https://github.com/dfadler/zombie-mermaid/commit/0b2b6075769376cb9909e906591e1ec94eb6edad), [`490de7c`](https://github.com/dfadler/zombie-mermaid/commit/490de7c7d3a0d8074bed3e68c052effd91914016), [`9be4d36`](https://github.com/dfadler/zombie-mermaid/commit/9be4d3692fee826d22b997a4aa5289fadbc8e8bb), [`42e2e0c`](https://github.com/dfadler/zombie-mermaid/commit/42e2e0c576bb61f0bd193977c74d3bc045825d14), [`7ab83e5`](https://github.com/dfadler/zombie-mermaid/commit/7ab83e5a56f03ced457aa310dfb7ce27b3a87fb6), [`68b8a6a`](https://github.com/dfadler/zombie-mermaid/commit/68b8a6a621ea9b3fb7e83aaff8bf29534ae10277), [`2e017dd`](https://github.com/dfadler/zombie-mermaid/commit/2e017dd399688f60689aad1003e4582e2cc21e36)]:
  - @zombie-mermaid/ascii-renderer@4.1.0
  - @zombie-mermaid/svg-renderer@4.1.0
  - @zombie-mermaid/core@4.1.0
  - @zombie-mermaid/mermaid-parser@4.1.0

## 4.0.0

### Patch Changes

- Updated dependencies [[`9d18ee7`](https://github.com/dfadler/zombie-mermaid/commit/9d18ee79afb97e7d360e4314532126c39048280a), [`f6eb9e2`](https://github.com/dfadler/zombie-mermaid/commit/f6eb9e258aa7a51b3155e31e67b2fa712eca9916), [`d1d1ca4`](https://github.com/dfadler/zombie-mermaid/commit/d1d1ca4a3ecc68a41769e0911c98ddca60c90de1), [`4b2e887`](https://github.com/dfadler/zombie-mermaid/commit/4b2e887d6329e6923468a9e7baf80d327fb82891), [`bcdf5aa`](https://github.com/dfadler/zombie-mermaid/commit/bcdf5aa2aca2ed79d3f92fa3fae37ad75b152f23), [`bddc87f`](https://github.com/dfadler/zombie-mermaid/commit/bddc87f2bf9a7e82b3fa33d6a7cd245dfb60639b), [`02b9efb`](https://github.com/dfadler/zombie-mermaid/commit/02b9efba372f288c6f3670fcc69fb11e76015f0a), [`7ae4525`](https://github.com/dfadler/zombie-mermaid/commit/7ae45258a332b07ac546da11d8936946d36949d0), [`43475ff`](https://github.com/dfadler/zombie-mermaid/commit/43475ff759b6f52d41d2c7c2911dae963a6c6ef2), [`6cdacb6`](https://github.com/dfadler/zombie-mermaid/commit/6cdacb6a2dcd857d4328a2890cc29d290274bfe4), [`20db743`](https://github.com/dfadler/zombie-mermaid/commit/20db743be4508a59d57bfe81a97fb916910b2a54), [`f768c85`](https://github.com/dfadler/zombie-mermaid/commit/f768c85ebaeafe720db67ece57c51c26fb2dad28), [`5e42179`](https://github.com/dfadler/zombie-mermaid/commit/5e42179d915ae3a386e7df48314794413ddbd94b), [`618923e`](https://github.com/dfadler/zombie-mermaid/commit/618923e0f51503bff2ba79cae91ddabf2283b035), [`c7d9704`](https://github.com/dfadler/zombie-mermaid/commit/c7d9704c9cbc9f39d3408a0d4cac124e2e1852dc), [`f244b08`](https://github.com/dfadler/zombie-mermaid/commit/f244b089f6fc4c4a24bb25da961d9018077ade03), [`26e2a77`](https://github.com/dfadler/zombie-mermaid/commit/26e2a7753a87f91bd3de6134c59c8e12e4d249a3), [`642a1a9`](https://github.com/dfadler/zombie-mermaid/commit/642a1a9ea83e118e1414a0f05031b71a60289edd), [`89e915f`](https://github.com/dfadler/zombie-mermaid/commit/89e915ff838a140dbac4bc6452e4460cf766693c), [`e894cf0`](https://github.com/dfadler/zombie-mermaid/commit/e894cf060c0fc25254250a9894d39cef0c13a0d2), [`56d3b72`](https://github.com/dfadler/zombie-mermaid/commit/56d3b7287bd7aba20256ad054630635ece2826e1), [`66411fb`](https://github.com/dfadler/zombie-mermaid/commit/66411fb023e7d6eed50957a0fd6e934572254c0a), [`c2980a2`](https://github.com/dfadler/zombie-mermaid/commit/c2980a26503ab5c7a4a38407ee29feec128ba7d6), [`7e4db32`](https://github.com/dfadler/zombie-mermaid/commit/7e4db3206ab61740b54f427003ab3fb248001d66), [`426b6bb`](https://github.com/dfadler/zombie-mermaid/commit/426b6bb6ba868af9e9e4dc295ac64dca4111654d), [`cff9e1f`](https://github.com/dfadler/zombie-mermaid/commit/cff9e1ffb2c78861b14c392d866497cb4995f03a), [`ed7f645`](https://github.com/dfadler/zombie-mermaid/commit/ed7f6458ed983e25d55b0ca2e6c0cae2cfd63d88), [`7b796fa`](https://github.com/dfadler/zombie-mermaid/commit/7b796fac35b99f1e1dcd5fa9f54838c1d1a9dc3e)]:
  - @zombie-mermaid/ascii-renderer@4.0.0
  - @zombie-mermaid/svg-renderer@4.0.0
  - @zombie-mermaid/mermaid-parser@4.0.0
  - @zombie-mermaid/core@4.0.0

## 3.2.0

### Minor Changes

- [#1192](https://github.com/dfadler/zombie-mermaid/pull/1192) [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1) Thanks [@dfadler](https://github.com/dfadler)! - Add C4 diagram support (`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`) in SVG and ASCII with dedicated renderers. `DiagramType` gains `'c4'`, and `detectDiagramType` routes the C4 headers to it. C4 sources are parsed by a new `parseC4Diagram` in `@zombie-mermaid/mermaid-parser`, which records `Rel_U/D/L/R` placement hints. The SVG renderer lays out with ELK (nested boundaries, relationships to boundaries) and draws a person glyph, cylinders, queues, the C4 palette, boundary frames, a title, and relationship labels with a separate `[technology]` line. The ASCII renderer has its own row layout, boxes, boundary frames, and grid router. `Rel_D`/`Rel_U` steer layering; `Rel_R`/`Rel_L` place elements side by side (exact in ASCII, a best-effort nudge in SVG). Prior art: lukilabs/beautiful-mermaid#34 (kristjanakkermann) and [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (devx), both unmerged upstream; nothing was copied from either renderer; the parser and integration fixtures in `c4-upstream-parser.test.ts` and `c4-upstream-integration.test.ts` are ported from [#71](https://github.com/dfadler/zombie-mermaid/issues/71) (adapted, with known gaps marked as skipped). ArchiMate remains open under [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167). Part of [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167).

- [#1179](https://github.com/dfadler/zombie-mermaid/pull/1179) [`f51b9e8`](https://github.com/dfadler/zombie-mermaid/commit/f51b9e8a8610334f0fe498e9b8b219a036e79085) Thanks [@dfadler](https://github.com/dfadler)! - MCP server: when `render_mermaid_svg` or `render_mermaid_ascii` fails on a diagram whose parser reports a line, the error result now carries a second text block with `{"diagnostics":[{"line","sourceLine","message"}]}` (1-based line in the submitted source, the offending line verbatim, and the parser message). The first content block and `isError: true` are unchanged; errors with no line information (for example an empty diagram) return only the plain message. No column is reported because no parser tracks one, and no lines are stripped or partially rendered.

### Patch Changes

- Updated dependencies [[`bd266cb`](https://github.com/dfadler/zombie-mermaid/commit/bd266cb6faeb154a9ac70bd0222f57918736dee9), [`84f70d4`](https://github.com/dfadler/zombie-mermaid/commit/84f70d4f72c8f6951c14ba5ec795247e12cca383), [`ad28261`](https://github.com/dfadler/zombie-mermaid/commit/ad282610307f63bf8782e08534a4a127c6afaacd), [`7e43e46`](https://github.com/dfadler/zombie-mermaid/commit/7e43e46f12cf90680d8dde7df147e73527108462), [`d3f0524`](https://github.com/dfadler/zombie-mermaid/commit/d3f052484f932e902e2c0d64be9621a56a9f17e7), [`77f88b0`](https://github.com/dfadler/zombie-mermaid/commit/77f88b0a3d4fc44942deb6686d726b36435e5d6d), [`502b06b`](https://github.com/dfadler/zombie-mermaid/commit/502b06b111f8d3379287322e5b061585b7fc82e5), [`b742dca`](https://github.com/dfadler/zombie-mermaid/commit/b742dcaf14c5d4d03346a58c1bf4842b745a5279), [`70196e8`](https://github.com/dfadler/zombie-mermaid/commit/70196e80522558ab9b0cfdab503a0d064f7b4ca1), [`54432b6`](https://github.com/dfadler/zombie-mermaid/commit/54432b6206c1af5d2e2d4fdd447256d9bbbcc85b), [`cdd34dd`](https://github.com/dfadler/zombie-mermaid/commit/cdd34dd8c93ec3768320b6b23384f143e2180db5), [`b4903df`](https://github.com/dfadler/zombie-mermaid/commit/b4903df714cefa036f33e54081b97b56f2248cab), [`f01ed87`](https://github.com/dfadler/zombie-mermaid/commit/f01ed8761b156c33d88a3b9fb9bc21c805675085), [`b88c5bc`](https://github.com/dfadler/zombie-mermaid/commit/b88c5bc2e28cff949282516984fba9d47bb46416), [`aea9109`](https://github.com/dfadler/zombie-mermaid/commit/aea9109b754cf231ebc7a4fababf5819487febd0)]:
  - @zombie-mermaid/core@3.2.0
  - @zombie-mermaid/mermaid-parser@3.2.0
  - @zombie-mermaid/svg-renderer@3.2.0
  - @zombie-mermaid/ascii-renderer@3.2.0

## 3.1.0

### Minor Changes

- [#1173](https://github.com/dfadler/zombie-mermaid/pull/1173) [`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e) Thanks [@dfadler](https://github.com/dfadler)! - MCP server: `render_mermaid_svg` gains optional `bg`/`fg` hex color overrides (applied on top of `theme`) and an optional `outputPath` that writes the SVG to a `.svg` file and returns `{ saved, size }`. `outputPath` is path-safe: it must resolve inside the server's working directory, the parent must already exist, and symlinks, `..` traversal, and non-regular files are refused. Because it can write files, `render_mermaid_svg` is now annotated `readOnlyHint: false, destructiveHint: true`. Two new tools, `list_themes` and `list_diagram_types`, list the valid `theme` names and the supported diagram types. `@zombie-mermaid/core` now exports a runtime `DIAGRAM_TYPES` array that `DiagramType` is derived from.

  Adapted by hand (not imported) from upstream lukilabs/beautiful-mermaid#120 (by LordCasser) and [#42](https://github.com/dfadler/zombie-mermaid/issues/42) (by manuareraa), keeping this fork's camelCase inputs and enum theme validation.

### Patch Changes

- Updated dependencies [[`1357207`](https://github.com/dfadler/zombie-mermaid/commit/1357207528b0cfee8fa7fb43513813a5f714a36e), [`14c5945`](https://github.com/dfadler/zombie-mermaid/commit/14c59452176f73e171aa459f69d2cee2ad7e7b34)]:
  - @zombie-mermaid/core@3.1.0
  - @zombie-mermaid/svg-renderer@3.1.0
  - @zombie-mermaid/ascii-renderer@3.1.0
  - @zombie-mermaid/mermaid-parser@3.1.0

## 3.0.0

### Patch Changes

- Updated dependencies [[`508b508`](https://github.com/dfadler/zombie-mermaid/commit/508b5083e74088b1a6163016b24cfc4c32f93ebb), [`451b981`](https://github.com/dfadler/zombie-mermaid/commit/451b98195e3370eb4a3beb66071396d5c616dbad), [`0849aba`](https://github.com/dfadler/zombie-mermaid/commit/0849abafc62e6cd94e38318e9edf6fe27634b49a), [`28698cd`](https://github.com/dfadler/zombie-mermaid/commit/28698cd7d706bb429f56edc0d38a185fde65120e), [`d7777fe`](https://github.com/dfadler/zombie-mermaid/commit/d7777fe87a500c6b402c48b298d096f26ef6e130), [`c2a190d`](https://github.com/dfadler/zombie-mermaid/commit/c2a190df3c86e7b3394e853d437fc3d11b7634e4), [`87f74e4`](https://github.com/dfadler/zombie-mermaid/commit/87f74e42c9cccbdd677ab2af17f4b3c415350948), [`d9e306f`](https://github.com/dfadler/zombie-mermaid/commit/d9e306f91003c9e47da10944833f76c2b87ace22)]:
  - @zombie-mermaid/ascii-renderer@3.0.0
  - @zombie-mermaid/core@3.0.0
  - @zombie-mermaid/mermaid-parser@3.0.0
  - @zombie-mermaid/svg-renderer@3.0.0

## 2.2.6

### Patch Changes

- Updated dependencies []:
  - @zombie-mermaid/ascii-renderer@2.2.6
  - @zombie-mermaid/core@2.2.6
  - @zombie-mermaid/mermaid-parser@2.2.6
  - @zombie-mermaid/svg-renderer@2.2.6

## 2.2.5

### Patch Changes

- Updated dependencies [[`43bac5a`](https://github.com/dfadler/zombie-mermaid/commit/43bac5abfb13064623ad94042b20ca9f4251fdaf)]:
  - @zombie-mermaid/ascii-renderer@2.2.5
  - @zombie-mermaid/core@2.2.5
  - @zombie-mermaid/mermaid-parser@2.2.5
  - @zombie-mermaid/svg-renderer@2.2.5

## 2.2.1

### Patch Changes

- Updated dependencies [[`dc6d5e9`](https://github.com/dfadler/zombie-mermaid/commit/dc6d5e9e4c9a90f06aebb56ff3a41fc47439ae66), [`7b32f48`](https://github.com/dfadler/zombie-mermaid/commit/7b32f48fa2a9488b66a94bdd43ad4be134d74349), [`7500604`](https://github.com/dfadler/zombie-mermaid/commit/750060424601ebe99e72a3d3c65384f96bc1d043)]:
  - @zombie-mermaid/ascii-renderer@2.2.1
  - @zombie-mermaid/core@2.2.1
  - @zombie-mermaid/mermaid-parser@2.2.1
  - @zombie-mermaid/svg-renderer@2.2.1
