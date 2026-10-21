# @zombie-mermaid/mcp

## 5.8.1

### Patch Changes

- [#2222](https://github.com/dfadler/zombie-mermaid/pull/2222) [`0d4348f`](https://github.com/dfadler/zombie-mermaid/commit/0d4348fe48d22f6b4983b6093deadd2a9424737d) Thanks [@dfadler](https://github.com/dfadler)! - Raise the `@modelcontextprotocol/sdk` floor to `^1.32.1` so installs pick up the patched `hono`, `proxy-addr`, `ip-address` and `fast-uri` transitive dependencies.

- [#2227](https://github.com/dfadler/zombie-mermaid/pull/2227) [`611736e`](https://github.com/dfadler/zombie-mermaid/commit/611736e43dc3371525f7d0a6573e74495f5b30d2) Thanks [@dfadler](https://github.com/dfadler)! - Add npm keywords and a "maintained continuation of beautiful-mermaid" line to each published sub-package's description so they are findable on npm.
- Updated dependencies [[`69f5734`](https://github.com/dfadler/zombie-mermaid/commit/69f5734c8190c1327d0c695e67437442c6e75b84), [`611736e`](https://github.com/dfadler/zombie-mermaid/commit/611736e43dc3371525f7d0a6573e74495f5b30d2)]:
  - @zombie-mermaid/svg-renderer@5.8.1
  - @zombie-mermaid/core@5.8.1
  - @zombie-mermaid/ascii-renderer@5.8.1
  - @zombie-mermaid/mermaid-parser@5.8.1

## 5.8.0

### Patch Changes

- [#2205](https://github.com/dfadler/zombie-mermaid/pull/2205) [`9d4c816`](https://github.com/dfadler/zombie-mermaid/commit/9d4c8165af383219b4ff76493f3b47193b986e53) Thanks [@dfadler](https://github.com/dfadler)! - Package ESM output (`dist/index.js`) is now minified: tabs, newlines and comments are removed, and `@zombie-mermaid/mcp` gets identifier mangling too. About 20.7 KB less gzip across the five packages. Behavior and exports are unchanged; stack traces from the ESM build are harder to read, and the `/* @__PURE__ */` annotations are no longer in the shipped ESM (a one-export consumer bundle was the same size). Refs [#2198](https://github.com/dfadler/zombie-mermaid/issues/2198).

- [#2200](https://github.com/dfadler/zombie-mermaid/pull/2200) [`2ef78c5`](https://github.com/dfadler/zombie-mermaid/commit/2ef78c5d4fd07e3aa486929a5037a1bbf77b0cfb) Thanks [@dfadler](https://github.com/dfadler)! - The published tarballs no longer contain `*.map` files, and the built `.js`/`.cjs` no longer end with a `//# sourceMappingURL=` comment (so a bundler does not warn about a missing map). The maps had no `sourcesContent` and pointed at `../src/*.ts` files that are not in the tarball, so no debugger could use them; they were 46% of the unpacked bytes (1,261,680 of 2,761,290 B across the six packages), and the packed size across the six drops from 751,731 B to 464,791 B. Runtime JS (apart from that comment), types, SVG and ASCII output are unchanged. Refs [#2195](https://github.com/dfadler/zombie-mermaid/issues/2195).

  Level: patch. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, source maps are tarball contents nobody can import through `exports`, so removing them is not breaking; no API, option or output changes.

- Updated dependencies [[`4839c72`](https://github.com/dfadler/zombie-mermaid/commit/4839c726bc5e0a7438948e1046022eb3dc4fb267), [`e5d95aa`](https://github.com/dfadler/zombie-mermaid/commit/e5d95aa6f0cd01acc2fb2ba7f59cbfea685ecd03), [`7c23dec`](https://github.com/dfadler/zombie-mermaid/commit/7c23dec0f3d87499eaff0452a0dea520a160b4de), [`20367fc`](https://github.com/dfadler/zombie-mermaid/commit/20367fc79c05a5275487c7dc7ecbe463d19deb5b), [`2ec3f0b`](https://github.com/dfadler/zombie-mermaid/commit/2ec3f0b91990ca6fb4d8fcf6565889bd5683f9ce), [`12c90fa`](https://github.com/dfadler/zombie-mermaid/commit/12c90faaccfbb3d97359c4488212cc5cd4edb4cf), [`9d4c816`](https://github.com/dfadler/zombie-mermaid/commit/9d4c8165af383219b4ff76493f3b47193b986e53), [`a6ab920`](https://github.com/dfadler/zombie-mermaid/commit/a6ab92064dc024f80c31aa532a409c9b5ff547b5), [`2ef78c5`](https://github.com/dfadler/zombie-mermaid/commit/2ef78c5d4fd07e3aa486929a5037a1bbf77b0cfb), [`d6c1297`](https://github.com/dfadler/zombie-mermaid/commit/d6c1297b43e6acfb74c945518015dc0615e74074), [`423ce40`](https://github.com/dfadler/zombie-mermaid/commit/423ce401a2f9ffaad3ecfdb3241e0615d2c9bc1c)]:
  - @zombie-mermaid/ascii-renderer@5.8.0
  - @zombie-mermaid/svg-renderer@5.8.0
  - @zombie-mermaid/mermaid-parser@5.8.0
  - @zombie-mermaid/core@5.8.0

## 5.7.1

### Patch Changes

- Updated dependencies [[`8a8c482`](https://github.com/dfadler/zombie-mermaid/commit/8a8c482cd45570fb76c7757986236d1170b0d301), [`b55b7fa`](https://github.com/dfadler/zombie-mermaid/commit/b55b7fae2b576173e6b438094d21238119947ace), [`f5e5454`](https://github.com/dfadler/zombie-mermaid/commit/f5e5454136070993bb1552dec3616c2750a6f15f), [`d88b061`](https://github.com/dfadler/zombie-mermaid/commit/d88b0619fd0d5cd5f7e8c59abb0ad1dc2029eec1)]:
  - @zombie-mermaid/ascii-renderer@5.7.1
  - @zombie-mermaid/core@5.7.1
  - @zombie-mermaid/svg-renderer@5.7.1
  - @zombie-mermaid/mermaid-parser@5.7.1

## 5.7.0

### Patch Changes

- Updated dependencies [[`3dea4e8`](https://github.com/dfadler/zombie-mermaid/commit/3dea4e87ad6f4f3d285368ca3d460396e51e6fba), [`1629a93`](https://github.com/dfadler/zombie-mermaid/commit/1629a93b59f74df129350aa69985039f2cc70cda), [`b33cbc4`](https://github.com/dfadler/zombie-mermaid/commit/b33cbc41334219850ffea7d5a9b04702426c8903), [`90e2fdc`](https://github.com/dfadler/zombie-mermaid/commit/90e2fdc0527bab025bda9126ea525c6edca06259)]:
  - @zombie-mermaid/ascii-renderer@5.7.0
  - @zombie-mermaid/core@5.7.0
  - @zombie-mermaid/mermaid-parser@5.7.0
  - @zombie-mermaid/svg-renderer@5.7.0

## 5.6.1

### Patch Changes

- Updated dependencies [[`972abd4`](https://github.com/dfadler/zombie-mermaid/commit/972abd4fa57bb73e071f04981f32cd9da7801543)]:
  - @zombie-mermaid/ascii-renderer@5.6.1
  - @zombie-mermaid/core@5.6.1
  - @zombie-mermaid/mermaid-parser@5.6.1
  - @zombie-mermaid/svg-renderer@5.6.1

## 5.6.0

### Minor Changes

- [#2095](https://github.com/dfadler/zombie-mermaid/pull/2095) [`16f3fdb`](https://github.com/dfadler/zombie-mermaid/commit/16f3fdbaee19310de884fa1a31d3b722d2ad0148) Thanks [@dfadler](https://github.com/dfadler)! - MCP server: `render_mermaid_svg` and `render_mermaid_ascii` now render in a long-lived worker thread. A render that runs longer than 15 s, or exceeds 512 MB of heap, is stopped and returns the usual `isError` result ("render timed out ..." / "render ran out of memory ..."); the server stays responsive and the next request gets a fresh worker. Previously such a render stalled every request or killed the stdio server. Rendered output is byte-identical, and no tool name, schema or result shape changes. The package now ships `dist/render-worker.js` next to its entry files.

### Patch Changes

- Updated dependencies [[`0d940f6`](https://github.com/dfadler/zombie-mermaid/commit/0d940f68a55f6f6812c5a243c53b7f94bcb1ad39)]:
  - @zombie-mermaid/ascii-renderer@5.6.0
  - @zombie-mermaid/core@5.6.0
  - @zombie-mermaid/mermaid-parser@5.6.0
  - @zombie-mermaid/svg-renderer@5.6.0

## 5.5.0

### Patch Changes

- Updated dependencies [[`50c39dc`](https://github.com/dfadler/zombie-mermaid/commit/50c39dcbb149519e92225d464cf99e46799bed6f), [`df88acb`](https://github.com/dfadler/zombie-mermaid/commit/df88acb864e45a6876b1744385c5db863a402176), [`b8f3e39`](https://github.com/dfadler/zombie-mermaid/commit/b8f3e39e83ee256cf80b885dd6201686d3196e6a), [`ffdc68e`](https://github.com/dfadler/zombie-mermaid/commit/ffdc68e2e8a19332ea8f075ca709b0e65df67814), [`ec37506`](https://github.com/dfadler/zombie-mermaid/commit/ec3750657f88ec2466344e556b77d6f2a147319a), [`242335c`](https://github.com/dfadler/zombie-mermaid/commit/242335c43afd4d50894435c49993abf69d7f017c), [`cf53ce5`](https://github.com/dfadler/zombie-mermaid/commit/cf53ce5b38fef7d10be32edd8112904deeda89c7), [`4a29ac5`](https://github.com/dfadler/zombie-mermaid/commit/4a29ac5939409c08bf89d6fecf913cbb2719b8f2), [`0a493e2`](https://github.com/dfadler/zombie-mermaid/commit/0a493e21c78e6d259996bb2b65dbd63ae689ab3c), [`efb2ade`](https://github.com/dfadler/zombie-mermaid/commit/efb2ade09c6bfbe05b49ea5b7f3961b1d5794fb6), [`e21b993`](https://github.com/dfadler/zombie-mermaid/commit/e21b993aec9aa7b3c6f3e747aeb0e98bdf9ac08b)]:
  - @zombie-mermaid/ascii-renderer@5.5.0
  - @zombie-mermaid/svg-renderer@5.5.0
  - @zombie-mermaid/core@5.5.0
  - @zombie-mermaid/mermaid-parser@5.5.0

## 5.4.0

### Minor Changes

- [#2047](https://github.com/dfadler/zombie-mermaid/pull/2047) [`d28ff6c`](https://github.com/dfadler/zombie-mermaid/commit/d28ff6cb0005069901b65db005919b26af1c80db) Thanks [@dfadler](https://github.com/dfadler)! - Expose the ASCII `profile: 'markdown'` preset through the CLI (`render --ascii --profile markdown`) and the MCP `render_mermaid_ascii` tool (`profile`).

### Patch Changes

- [#2013](https://github.com/dfadler/zombie-mermaid/pull/2013) [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8) Thanks [@dfadler](https://github.com/dfadler)! - Republish with `dist/` included. 5.1.0 and 5.2.0 of every package shipped without build output because the release job (split from the test job in [#1596](https://github.com/dfadler/zombie-mermaid/issues/1596)) never ran the build before `changeset publish`; imports of `zombie-mermaid` and the `@zombie-mermaid/*` packages failed to resolve. The release job now builds first and fails before publishing if any tarball lacks its entry files. Closes [#1991](https://github.com/dfadler/zombie-mermaid/issues/1991).
- Updated dependencies [[`d1b2d9a`](https://github.com/dfadler/zombie-mermaid/commit/d1b2d9a524e9e46fa1b4252cdb2952f48166742d), [`520c6b1`](https://github.com/dfadler/zombie-mermaid/commit/520c6b1ceaddbb8c3817e528b4704b88740b6ee5), [`10f4259`](https://github.com/dfadler/zombie-mermaid/commit/10f425979fca1b6150ebc1139d5fc9bf9f3971e3), [`344431e`](https://github.com/dfadler/zombie-mermaid/commit/344431ec91d52753988a6bce3b380c394a401c33), [`0f89a9d`](https://github.com/dfadler/zombie-mermaid/commit/0f89a9db354f32fa14aa55455e28be0376d284ac), [`b7314ed`](https://github.com/dfadler/zombie-mermaid/commit/b7314ed0e47b0392573b36d6863036e0a05d2b4d), [`0c2b6d3`](https://github.com/dfadler/zombie-mermaid/commit/0c2b6d3ec38fb97bcc927573b82de06fd83c9492), [`36f8c04`](https://github.com/dfadler/zombie-mermaid/commit/36f8c049eb94c3eef47c4a07a61ea7231c837d57), [`c4c8d4f`](https://github.com/dfadler/zombie-mermaid/commit/c4c8d4fd0440e41eba62f43bc26f887d6160eba8), [`adf9f32`](https://github.com/dfadler/zombie-mermaid/commit/adf9f32494a78701c37894dfcb6c4a96344b7447), [`782eaa0`](https://github.com/dfadler/zombie-mermaid/commit/782eaa00d9e8d0a8503bc2c4039c5ab4a22467a6), [`38e2b3c`](https://github.com/dfadler/zombie-mermaid/commit/38e2b3c00efe238bb9afe8683f6758a6f23a0996)]:
  - @zombie-mermaid/core@5.4.0
  - @zombie-mermaid/svg-renderer@5.4.0
  - @zombie-mermaid/ascii-renderer@5.4.0
  - @zombie-mermaid/mermaid-parser@5.4.0

## 5.3.0

### Minor Changes

- [#1963](https://github.com/dfadler/zombie-mermaid/pull/1963) [`ea05f88`](https://github.com/dfadler/zombie-mermaid/commit/ea05f88dc9622a9414cd40c4b94842b664dedb7e) Thanks [@dfadler](https://github.com/dfadler)! - The MCP JSON tools (`validate_mermaid`, `check_mermaid_sequence_activations`, `fix_mermaid_sequence_activations`, `list_themes`, `list_diagram_types`) now declare an `outputSchema` and return matching `structuredContent`, alongside the existing JSON text block. Fixes [#1857](https://github.com/dfadler/zombie-mermaid/issues/1857).

- [#1984](https://github.com/dfadler/zombie-mermaid/pull/1984) [`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a) Thanks [@dfadler](https://github.com/dfadler)! - Add `limits` to `renderMermaidSVG` and `renderMermaidASCII`: `maxInputLength`, `maxNodes`, `maxEdges` (and `maxCanvasCells` for ASCII) are checked before layout and throw `LimitExceededError` (`code: 'LIMIT_EXCEEDED'`). Defaults are 100,000 characters, 400 nodes, 600 edges and 2,000,000 canvas cells, so a flowchart above 400 nodes or 600 edges now throws unless you raise the limit (`Infinity` disables one). The MCP render tools use tighter limits (50,000 / 150 / 300 / 1,000,000). See the API reference.

### Patch Changes

- [#1967](https://github.com/dfadler/zombie-mermaid/pull/1967) [`88bf8a5`](https://github.com/dfadler/zombie-mermaid/commit/88bf8a5abed27d76a775ca5269605090311c34d5) Thanks [@dfadler](https://github.com/dfadler)! - Add `MermaidParseError` (`line`, `column`, `diagramType`, `code`, all optional) to `@zombie-mermaid/core`. Line-prefixed parser errors now throw it with the message unchanged, and the MCP parse diagnostics read `line` from it before falling back to the `Line N:` message prefix. Closes [#1855](https://github.com/dfadler/zombie-mermaid/issues/1855).

- [#2005](https://github.com/dfadler/zombie-mermaid/pull/2005) [`8360227`](https://github.com/dfadler/zombie-mermaid/commit/8360227eb337146a923e14781a87bc63ce74f44d) Thanks [@dfadler](https://github.com/dfadler)! - Every parser failure is now a `MermaidParseError` with `diagramType` set (and `line` where the parser knows it, now including C4 and architecture statement errors); the pie parser also sets `column`. Messages are unchanged. The MCP diagnostics read the typed `line` instead of parsing the message, so C4 and architecture errors now get a source-line diagnostic. `ElkNotRegisteredError` stays a plain `Error`: it is a missing-peer-dependency error, not a problem in the diagram. Closes [#1979](https://github.com/dfadler/zombie-mermaid/issues/1979).
- Updated dependencies [[`d028603`](https://github.com/dfadler/zombie-mermaid/commit/d028603dbe31376e1e1b26c05749f8719445a7a5), [`ef0f872`](https://github.com/dfadler/zombie-mermaid/commit/ef0f872d83bf76fa65cbcf1ff630700dc5470d4e), [`8daa5ee`](https://github.com/dfadler/zombie-mermaid/commit/8daa5ee7f10ac14bf161ba48e1cd54dd0155b077), [`fa02ffe`](https://github.com/dfadler/zombie-mermaid/commit/fa02ffe3ab869d1d92d87ce67d82b2e8ce4ff1f9), [`e63ed98`](https://github.com/dfadler/zombie-mermaid/commit/e63ed989d8179d428149d1f48e31e78a87f261f3), [`2fe4e00`](https://github.com/dfadler/zombie-mermaid/commit/2fe4e0006481a32fdd37faf45f9ee584d4d1696a), [`858a8ba`](https://github.com/dfadler/zombie-mermaid/commit/858a8ba39898b95678c300120590130835f7445d), [`315dcb8`](https://github.com/dfadler/zombie-mermaid/commit/315dcb86ecb4688248c8c1ef35df90e50da303ce), [`5e4a9a7`](https://github.com/dfadler/zombie-mermaid/commit/5e4a9a71b2f07c8eceaed50dc764504525065675), [`88bf8a5`](https://github.com/dfadler/zombie-mermaid/commit/88bf8a5abed27d76a775ca5269605090311c34d5), [`8360227`](https://github.com/dfadler/zombie-mermaid/commit/8360227eb337146a923e14781a87bc63ce74f44d)]:
  - @zombie-mermaid/ascii-renderer@5.3.0
  - @zombie-mermaid/svg-renderer@5.3.0
  - @zombie-mermaid/core@5.3.0
  - @zombie-mermaid/mermaid-parser@5.3.0

## 5.2.0

### Patch Changes

- Updated dependencies [[`fda110d`](https://github.com/dfadler/zombie-mermaid/commit/fda110dd94834fc268a8b49e3b2b0df56bd873ba), [`87336e0`](https://github.com/dfadler/zombie-mermaid/commit/87336e06a1ceb86b1695b807803962ed2a095ce2), [`3861e50`](https://github.com/dfadler/zombie-mermaid/commit/3861e50dfc8bd7de17a00b8b9939c257482aead1), [`a278cf9`](https://github.com/dfadler/zombie-mermaid/commit/a278cf967874ab86cf74f7744e0756f340d83ae9), [`bffcc09`](https://github.com/dfadler/zombie-mermaid/commit/bffcc096592ae7de0565cc67511fc0bbd0060bef), [`ebdd12f`](https://github.com/dfadler/zombie-mermaid/commit/ebdd12f58f7379dddfa9c93541543349bba5612a)]:
  - @zombie-mermaid/svg-renderer@5.2.0
  - @zombie-mermaid/mermaid-parser@5.2.0
  - @zombie-mermaid/ascii-renderer@5.2.0
  - @zombie-mermaid/core@5.2.0

## 5.1.0

### Minor Changes

- [#1727](https://github.com/dfadler/zombie-mermaid/pull/1727) [`ce29689`](https://github.com/dfadler/zombie-mermaid/commit/ce2968907a79cbbb0f81f50eb70ce80b4f0e2da1) Thanks [@dfadler](https://github.com/dfadler)! - Add a `validate_mermaid` MCP tool and a `zombie-mermaid validate [file]` CLI command (parse only, line diagnostics, exit 1 when invalid). Failed `render` runs now print the offending source line too. New `validateMermaid()` export.

### Patch Changes

- [#1629](https://github.com/dfadler/zombie-mermaid/pull/1629) [`192bb09`](https://github.com/dfadler/zombie-mermaid/commit/192bb093ac050c8b20feacf4daf3701d479a68e7) Thanks [@dfadler](https://github.com/dfadler)! - `render_svg` no longer leaks filesystem details in `outputPath` write errors; the MCP threat model is now documented.

- [#1620](https://github.com/dfadler/zombie-mermaid/pull/1620) [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931) Thanks [@dfadler](https://github.com/dfadler)! - Fix package README inaccuracies and add missing `package.json` metadata ([#1545](https://github.com/dfadler/zombie-mermaid/issues/1545)).
- Updated dependencies [[`ce29689`](https://github.com/dfadler/zombie-mermaid/commit/ce2968907a79cbbb0f81f50eb70ce80b4f0e2da1), [`7104031`](https://github.com/dfadler/zombie-mermaid/commit/71040311cdca8de5f3c3ce41c6d9a54209ed8b8f), [`3ec564e`](https://github.com/dfadler/zombie-mermaid/commit/3ec564ea51616fceb6facb37709313e15fb8b7d6), [`fd1367f`](https://github.com/dfadler/zombie-mermaid/commit/fd1367fda8a8d7759e3883af1fada45e282a0903), [`0d6711c`](https://github.com/dfadler/zombie-mermaid/commit/0d6711c1c51a57e25ede4c11e360c208ea4b9278), [`ab0b6c9`](https://github.com/dfadler/zombie-mermaid/commit/ab0b6c9278bbef10949cd353a1088e2b02596931)]:
  - @zombie-mermaid/svg-renderer@5.1.0
  - @zombie-mermaid/ascii-renderer@5.1.0
  - @zombie-mermaid/mermaid-parser@5.1.0
  - @zombie-mermaid/core@5.1.0

## 5.0.1

### Patch Changes

- Updated dependencies [[`23007f5`](https://github.com/dfadler/zombie-mermaid/commit/23007f5b3356f3531b2a25aebab3aa9974836015), [`000bea2`](https://github.com/dfadler/zombie-mermaid/commit/000bea2eefcf178646f6a90d2e364b603d191954), [`2e01fc8`](https://github.com/dfadler/zombie-mermaid/commit/2e01fc855e13681f808cbbd8331763cfc677508f)]:
  - @zombie-mermaid/ascii-renderer@5.0.1
  - @zombie-mermaid/core@5.0.1
  - @zombie-mermaid/mermaid-parser@5.0.1
  - @zombie-mermaid/svg-renderer@5.0.1

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
