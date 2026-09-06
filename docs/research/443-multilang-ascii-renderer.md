# Research: single-source, multi-language (Rust/Go) ASCII renderer

Status: **research spike, not a decision.** Written for [#443](https://github.com/dfadler/zombie-mermaid/issues/443).
Answers the five open questions the issue lists. No code under `src/ascii/**`
was changed to produce this — the "friendly subset" section below is a static
grep/read spike over the existing source, not a working transpiler or port.

## TL;DR / recommendation

**Not worth pursuing as a from-scratch TS→native transpiler right now.** The
two open questions that would have to justify the cost — real user demand,
and an efficient compile-outward path — land weaker than the issue's framing
assumed:

- User demand *does* exist, but it surfaced **after** #443 was filed, as a
  separate, non-AI-authored proposal (#495) plus two AI-assisted follow-ups
  (#536, #540) — see [Q4](#q4-is-there-actual-user-demand). Those three issues
  already converge on a **different, better-precedented architecture** (Go/Rust
  core + thin per-language bindings, "Temporal-style") than the two directions
  #443 poses (compile the whole core outward, or transpile TS source itself).
  That makes most of #443's framing moot rather than answered — see the
  recommendation detail below.
- The "compile TS outward to Rust/Go *source*" direction has real prior art
  (CCXT's `ast-transpiler`, in production for years) — stronger precedent than
  the issue assumed — but CCXT's own experience shows it demands a
  cross-language-compatible *style discipline* on the source the whole team
  writes in, not just a subset-checker run once. That is a standing tax, not a
  one-time migration cost.
- The "compile core outward via WASM" direction is bundle-size-negative for
  this specific package: a Rust→WASM binary alone typically lands at
  50–300 KB before gzip ([nickb.dev](https://nickb.dev/blog/results-of-authoring-a-js-library-with-rust-and-wasm/),
  [dev.to WASM 2026 deep dive](https://dev.to/dataformathub/rust-wasm-in-2026-a-deep-dive-into-high-performance-web-apps-20c6)),
  against the current pure-TS ASCII entry point's **66,560-byte *gzip* budget**
  (`bundle-size-budget.json`, `dist/ascii.js`/`dist/ascii.cjs`) — i.e. the
  uncompressed WASM payload alone can exceed today's entire compressed budget,
  before JS glue, before the loader, before any C-ABI/native-binding surface
  for Go/Python/etc.
- The "friendly TS subset" spike (below) came back **more favorable than
  expected** — the algorithmic core is unusually restricted-dialect-friendly
  already (zero `any`, zero async, `strict: true`, no generators, minimal
  regex, only 3 trivial classes) — but that finding argues for the
  *shared-assertion-corpus* piece of #443 independent of any compile decision,
  not for building a transpiler.

If anything from this spike is worth doing next, it's the low-cost, direction-
agnostic piece: extracting the ASCII test corpus into a language-neutral
fixture format (Q5). That has value regardless of whether #495/#536/#540 ever
ship a Go/Rust core, and it's cheap. Everything else here should stay parked
until one of #495/#536/#540 produces an actual proof-of-concept binary to
react to.

---

## Q1: Is there prior art beyond AssemblyScript for a TS-subset-to-native-source transpiler?

**Yes — stronger prior art than the issue assumed, but with an important
caveat about what "prior art" buys you.**

- **[CCXT's `ast-transpiler`](https://github.com/ccxt/ast-transpiler)** is a
  real, in-production precedent: [ccxt](https://github.com/ccxt/ccxt) (100+
  exchange integrations) writes a single TypeScript source and transpiles it —
  via TS's own AST/type-checker, not regex — to **PHP, Python, C#, Go, Java,
  and Rust** source. This is exactly the "direction 2" shape #443 describes as
  having "no mature transpiler," and it's been running for years at real
  scale. It is the single strongest counter-example to the issue's framing.
  - The catch: CCXT's docs are explicit that the source has to be written in a
    "cross-language-compatible way" with "detailed code style requirements,"
    that untyped/ambiguous numeric code causes int/float ambiguity across
    targets, that some comments are lost, and that import/export statements
    aren't touched by the tool (handled by a separate build step). This is a
    *style discipline the whole team lives under continuously*, not a
    subset-checker run once at project start — much closer in spirit to
    AssemblyScript's restricted dialect than to "write normal TS and get Go
    out."
  - No public evidence of a **shared conformance suite verifying identical
    output** across CCXT's transpiled targets was found — the repo has Jest
    tests and benchmarks, but nothing surfaced describing cross-language
    output-identity assertions specifically.
- **Toy/experimental variants exist but aren't viable precedent**: `ts2rust`
  and `ts2go` are explicitly labeled experimental/"extremely limited subset,"
  aimed at small CLI-shaped programs, not a rendering engine's algorithmic
  core.
- **A related but distinct precedent — manual, disciplined porting with a
  shared conformance suite, not automated transpilation**: Microsoft's
  TypeScript 7 compiler rewrite in Go. The team hand-ported the checker
  "structurally identical" to the JS version and validated against ~20,000
  existing conformance tests, matching behavior in all but 74 cases
  ([morello.dev](https://morello.dev/blog/typescript-7-is-here)). This is
  the strongest real-world evidence for **Q5** (a shared-assertion corpus is a
  proven, load-bearing technique for verifying cross-language identity) — but
  it argues for *manual porting plus a shared test corpus*, not for building a
  transpiler.
- **The "core + thin per-language bindings" pattern** (what #495/#536/#540
  actually propose, independent of #443) has its own strong precedent:
  Temporal's Rust `sdk-core` with per-language bindings (Neon for TS/JS, PyO3
  for Python, direct C bindings for .NET) — cited directly in #536/#540 — and
  [Oso](https://www.osohq.com/post/cross-platform-rust-libraries), a Rust core
  shipping idiomatic Python/Ruby/Java/JS/Go/Rust libraries. This is the
  well-trodden path; it's a different shape of problem than #443's two
  directions (it doesn't require a TS→native transpiler *or* a WASM-outward
  build — the core is written once in the systems language and each language
  gets a hand-written idiomatic wrapper over an FFI/WASM boundary).

**Bottom line for Q1**: prior art for TS-subset-to-native-source transpilation
exists and works in production (CCXT), stronger than "no mature transpiler
exists." But the realistic cost model isn't "run a subset-checker once" — it's
"adopt a permanent style discipline," and no example found (CCXT included)
demonstrates the "verified-identical conformance suite across languages"
property #443's differentiation question is actually chasing.

## Q2: What fraction of `src/ascii/**` would fall inside a "friendly" restricted TS subset today?

Spike method: grepped all 37 files / 15,274 lines under `src/ascii/**` for
constructs known to be hard for an AssemblyScript-like restricted dialect —
`any`, async/Promise, classes with inheritance, regex, generators, complex
generics/mapped/conditional types, dynamic property access, exotic string
methods, private fields. This is a static-grep spike, not a real
`typescript`-AST run (that would be the natural next step if this line is
pursued further — see Q2 recommendation).

Findings:

| Construct | Result |
|---|---|
| `any` (real usage, not in comments) | **0** — both grep hits were inside prose comments |
| `strict` mode | `true` in `tsconfig.json` already |
| `async`/`await`/`Promise` | **0** real usage — the only hit was a comment ("Synchronous — no async layout engine needed") |
| Classes | **3** files (`hyperlinks.ts`'s `LinkRunTracker`, `pathfinder.ts`'s `MinHeap`, `grid-occupancy.ts`'s `Grid`) — all small, no inheritance, no decorators |
| `extends` (inheritance) | **0** — the only grep hits were in prose comments |
| Generators (`function*`/`yield`) | **0** |
| ES2022 private fields (`#field`) | **1** (`Grid.#cells`) — used deliberately over TS `private` to get true runtime privacy (see the file's own comment); would need to become plain TS `private` for a dialect without JS-native private-field support |
| Regex | **5** files (`draw.ts`, `hyperlinks.ts`, `canvas.ts`, `draw-boxes.ts`, `ansi.ts`) — all simple, static character-class tests (e.g. `/^[┌┐└┘├┤┬┴┼│─╭╮╰╯+\-|.':]$/.test(c)`), no dynamic pattern construction, no backreferences/lookaround |
| Complex/mapped/conditional generics (`[K in ...]`, `extends infer`, `keyof`) | **0** |
| Interfaces vs. classes | 28 interfaces vs. 3 classes — the codebase is data/function-oriented, not OO |
| `Map`/`Set`/`Record` | Used across ~12 files — idiomatic, not exotic (all `Map<K,V>`/`Set<T>` with concrete key/value types) |
| Exotic string methods (`padStart`, `repeat`, `normalize`, `codePointAt`, `matchAll`, `localeCompare`) | Only `padStart` (1 file) and `repeat` (1 file) — both supported by AssemblyScript's stdlib |
| Object destructuring / spread | 9 destructuring sites, 61 spread sites — common, would need per-site review under a real restricted dialect but nothing algorithmically unusual |
| `for...of` over `Map`/`Set` | 162 sites — heavy reliance on this idiom |

**Estimate: roughly 90–95% of `src/ascii/**` by line count looks compatible
with an AssemblyScript-like restricted TS dialect with only mechanical
changes**, concentrated almost entirely in two places:

1. **The 5 regex files** — all trivially rewritable as manual character-set
   checks (they're already effectively that; the regex is closer to
   documentation than to real pattern matching) or covered by a community
   shim. [AssemblyScript still has no native `RegExp`](https://github.com/AssemblyScript/assemblyscript/issues/1188)
   as of this writing — this is a real gap, not a spike artifact, though a
   community package (`assemblyscript-regex`) exists.
2. **The 3 class files** — trivial rewrites (drop the one `#`-private field
   to `private`; the classes have no inheritance to reconcile).

**What the spike does *not* resolve** — and what the issue itself already
flags as the real hard spot, independent of "subset friendliness": Unicode
width handling (`display-width.ts` and the CJK/combining-mark test files).
This isn't a restricted-dialect problem — even a hand-written, non-transpiled
Rust/Go port has to replicate JS's UTF-16-code-unit iteration and width-table
semantics exactly, or the shared conformance suite (Q5) will catch daily
divergence. That's a genuine, nontrivial porting cost regardless of which
compile direction is chosen, and the spike doesn't reduce it.

**Caveat on the estimate**: this was a grep-based spike, not a real
`typescript` AST walk. It will under-count subtler issues a checker would
catch — e.g. specific numeric-type ambiguity (TS has one `number` type;
Rust/Go don't — CCXT calls this out explicitly as a live pain point), or
overload resolution differences. If this direction is ever pursued seriously,
running the actual `typescript` compiler API over `src/ascii/**` and
classifying every node (the issue's own suggestion) is the right next step —
this spike is a fast, cheap upper-bound estimate, not a replacement for that.

## Q3: WASM bundle size / cold-start cost vs. current pure-TS, for this renderer specifically

No project ships a directly comparable "ASCII diagram renderer, Rust-core,
WASM-outward" package to measure, so this is an estimate from general
Rust→WASM data applied to this project's actual current numbers, not a
direct benchmark.

- **Current baseline (real, measured, CI-enforced)**: `bundle-size-budget.json`
  budgets `dist/ascii.js` / `dist/ascii.cjs` (the ASCII-only entry point,
  `zombie-mermaid/ascii`) at **66,560 bytes gzipped** (65 KB); the full
  `dist/index.js` (SVG + ASCII + ELK.js) is budgeted at 112,640 bytes and
  currently measures **87.9 KB gzipped** per `badges/bundle-size.json`.
- **General Rust→WASM data**: minimum WASM-binary-plus-glue overhead is
  commonly cited around 40–50 KB, with `wasm-bindgen`/`wasm-pack` output
  "typically 50–300 KB after `wasm-opt`" for real (non-trivial) modules
  ([dev.to WASM 2026 deep dive](https://dev.to/dataformathub/rust-wasm-in-2026-a-deep-dive-into-high-performance-web-apps-20c6),
  [nickb.dev](https://nickb.dev/blog/results-of-authoring-a-js-library-with-rust-and-wasm/)).
  These figures are typically **pre-gzip**; gzip helps but WASM binaries
  compress less well than equivalent minified JS because they're already
  denser binary encoding, not text.
- **Read-through for this project**: a Rust-core WASM build of just the ASCII
  renderer would plausibly land somewhere in the same 50–300 KB range *before*
  compression and *before* the JS glue/loader code `wasm-bindgen` generates —
  i.e. plausibly at-or-above the entire current 65 KB **gzipped** budget for
  the whole ASCII feature, once glue and instantiation code are counted. This
  is a real risk to the "Zero DOM dependencies" / bundle-size-conscious
  positioning the project's own README already calls out as a tracked,
  valued property (`docs/../README.md`'s Bundle Size section, the dedicated
  `zombie-mermaid/ascii` entry point that exists specifically to dodge
  ELK.js's weight).
- **Cold start**: WASM module instantiation is asynchronous by default in
  most toolchains — a real tension with the project's stated "Synchronous
  rendering... works with React `useMemo()`" feature, already flagged as an
  open risk in #495 itself, not new information from this spike.
- **Caveat**: this is directional, not a measured number for this codebase.
  Getting a real number is a half-day spike (write a minimal Rust WASM stub
  that echoes back one hardcoded render and measure `wasm-pack build --release`
  output + gzip), not a research-doc-level estimate — worth doing only once
  #495/#536/#540 actually produce a proof-of-concept core to measure against.

## Q4: Is there actual user demand for a Rust/Go native package, or is this speculative?

**#443 itself says no ("No existing issue/discussion currently asks for
one") — that was true at the time #443 was filed (2026-09-03), but is no
longer true.** Three related issues now exist, all filed *after* #443:

- **[#495](https://github.com/dfadler/zombie-mermaid/issues/495) — "Proposal:
  rewrite core renderer in Go with TypeScript bindings"** (2026-09-05,
  `enhancement`/`refactor`). Unlike #443, this one is **not** flagged as an
  AI-drafted conversational capture — it reads as the repo owner's own
  proposal. This is the clearest signal of real (if still early/unscoped)
  demand: a scoped proposal for a Go core + idiomatic per-language interfaces
  (Go native, TypeScript required, room for more later), explicitly citing
  bundle-size and synchronous-rendering risk as open questions to resolve
  before any implementation branch opens.
- **[#536](https://github.com/dfadler/zombie-mermaid/issues/536) — "Long-term
  considerations: diagram-tooling landscape, layout architecture,
  multi-language core"** (2026-09-06, AI-drafted research pass, marked as
  such). Cites the Temporal Rust-core-plus-thin-bindings pattern as "a working
  precedent worth modeling" and recommends, as one of five ordered next steps,
  prototyping "a core-plus-bindings split for one non-TS target... as the
  lowest-risk proof."
- **[#540](https://github.com/dfadler/zombie-mermaid/issues/540) — "Prototype
  a core-plus-bindings split for multi-language support"** (2026-09-06,
  AI-drafted, split from #536). A concrete, scoped task: pick Rust or Go,
  prototype one diagram type's parse+layout in that language, wrap it with a
  thin TypeScript binding, and produce output equivalent to the current
  pure-TS path for that one diagram type. Also notes real prior art *in this
  exact niche*: `mermaid-ascii` (Go) and `mermaid-ascii-diagrams` (Python)
  already reach non-JS ecosystems — "Competitors reached multi-language
  before zombie-mermaid did, albeit in a narrower scope."

**Read on demand**: real, but for a **different architecture** than either of
#443's two directions. #495/#536/#540 converge on "Rust/Go core, thin
per-language bindings via FFI/WASM" (the Temporal/Oso pattern) — not
"transpile the TS core outward to Rust/Go source" (#443's direction 2, the
CCXT-shaped path) and not "compile a Rust/Go core to a WASM+native-bindings
bundle that's still meant to be the *only* implementation" in quite the way
#443's direction 1 frames it either, since #495 explicitly wants a Go-native
idiomatic API as a first-class target, not just an FFI wrapper around a
foreign-feeling core.

Practical implication: **most of #443's remaining open questions are now
best answered by whatever #540's prototype produces**, not by further
research-only spikes. A real one-diagram-type proof of concept will surface
actual bundle-size/cold-start numbers (resolving Q3 for real), a real
regex/Unicode porting cost (sharpening Q2), and a real answer to "is a
verified-identical conformance suite even the right differentiator" (Q1's
open differentiation question) — all better than more desk research could.

## Q5: What would shared-assertion corpus extraction cost as standalone work, independent of any compile-target decision?

This is the one piece of #443 that stands on its own regardless of what
#495/#536/#540 decide.

- **Current shape**: `src/__tests__/ascii-*.test.ts` already is, per the
  issue's own framing, `(mermaid source, options) → expected ASCII string`
  fixture data asserted by exact string equality. Extracting this into
  language-neutral fixture files (e.g. one JSON/YAML file per test case:
  input source + options + expected output string) is mechanical — a script
  that walks the existing `.test.ts` files and serializes each case's
  input/expected pair, not a rewrite of the tests themselves.
- **Precedent for the *shape* of this approach**: Test262 (ECMAScript),
  the WASM spec's `.wast` test corpus, SQLite's SQL logic tests, and — most
  relevantly — TypeScript's own ~20,000-case conformance suite that Microsoft
  reused to verify the Go port's behavior matched the JS checker
  ([morello.dev](https://morello.dev/blog/typescript-7-is-here)). All are the
  same pattern: a language-neutral fixture corpus plus a thin per-consumer
  runner/comparator.
- **Cost estimate**: low, and decomposable into two independently-shippable
  pieces:
  1. *Extraction* — write the fixtures out once, keep existing `.test.ts`
     files as the "TS reference" consumer of the same corpus (so nothing
     about today's CI changes). This is the low-risk, low-cost half — likely
     a small script plus a follow-up PR reorganizing the existing ASCII test
     files to read from the extracted corpus instead of inline literals.
  2. *A second consumer* — only relevant once a second implementation (WASM
     build, native binary, or otherwise) exists to test against; this half's
     cost is entirely dependent on what #540's prototype produces (shelling
     out to a binary and diffing stdout, per the issue's own suggestion, is
     the cheapest option for a standalone native binary; an in-process
     `describe.each(['ts','wasm'])` swap is cheaper still if the target loads
     inside Node).
- **Recommendation**: worth doing as a hedge against test drift **only** once
  there's an actual second consumer to run it against (#540's prototype, if
  it proceeds) — extracting a shared corpus with no second implementation to
  compare against is process for its own sake. Doing it opportunistically
  *alongside* #540's prototype (extract the fixtures for whichever one
  diagram type #540 targets, rather than all six up front) is the
  right-sized version of this work.

## Overall recommendation

Park #443 as answered-by-research; don't start a transpiler or a full port.
Concretely:

1. **Don't build a TS→Rust/Go transpiler.** Real prior art exists (CCXT) but
   it's a permanent style-discipline tax, not a one-time subset migration, and
   nothing in this codebase's actual shape (Q2's spike) demands that level of
   investment when a friendlier pattern (Q4) already has three issues behind
   it.
2. **Don't build a WASM-outward core package yet.** The bundle-size math (Q3)
   is unfavorable at this project's current scale and the async-instantiation
   tension with synchronous rendering is a real, unresolved risk #495 already
   flags.
3. **Let #540 answer the questions this research can't.** #495/#536/#540
   already propose the better-precedented architecture (Go/Rust core + thin
   per-language bindings) and #540 is scoped as a single-diagram-type
   prototype — the right size to get real numbers instead of more estimates.
   This issue's remaining open questions (real bundle size, real cold-start,
   real Unicode-porting cost, whether "provably identical across languages"
   is actually something users select for) are better answered by that
   prototype's output than by another research pass.
4. **The only standalone-worthwhile piece of #443 is Q5** (shared-assertion
   corpus extraction), and only as a small, opportunistic side-effect of
   #540's prototype (extract fixtures for the one diagram type #540 targets),
   not as separate up-front work.
5. **Close or re-scope #443** once #540 has a prototype outcome to point to —
   at that point #443's open questions either have real answers or are
   superseded by whatever #540 and #536 settle. That's a call for a human,
   not something to do as part of this research pass.

## Sources

- [CCXT `ast-transpiler`](https://github.com/ccxt/ast-transpiler)
- [CCXT `CONTRIBUTING.md`](https://github.com/ccxt/ccxt/blob/master/CONTRIBUTING.md)
- [`ts2rust`](https://github.com/vedantroy/ts2rust), [`ts2go`](https://github.com/leona/ts2go) — experimental, limited-subset transpilers
- [TypeScript 7 Is Here: The Go Compiler Rewrite — morello.dev](https://morello.dev/blog/typescript-7-is-here)
- [AssemblyScript RegExp support tracking issue #1188](https://github.com/AssemblyScript/assemblyscript/issues/1188)
- [AssemblyScript implementation status](https://www.assemblyscript.org/status.html)
- [Results of Authoring a JS Library with Rust and Wasm — nickb.dev](https://nickb.dev/blog/results-of-authoring-a-js-library-with-rust-and-wasm/)
- [Rust & WASM in 2026: A Deep Dive — dev.to](https://dev.to/dataformathub/rust-wasm-in-2026-a-deep-dive-into-high-performance-web-apps-20c6)
- [Oso: How We Built a Cross-Platform Library with Rust](https://www.osohq.com/post/cross-platform-rust-libraries)
- [Temporal `sdk-core` ARCHITECTURE.md](https://github.com/temporalio/sdk-rust/blob/main/ARCHITECTURE.md)
- [`mermaid-ascii` (Go)](https://github.com/AlexanderGrooff/mermaid-ascii), [`mermaid-ascii-diagrams` (Python, PyPI)](https://pypi.org/project/mermaid-ascii-diagrams/)
- Repo-internal: `bundle-size-budget.json`, `badges/bundle-size.json`, `tsconfig.json`, `src/ascii/**` (grep spike, see Q2)
- [#495](https://github.com/dfadler/zombie-mermaid/issues/495), [#536](https://github.com/dfadler/zombie-mermaid/issues/536), [#540](https://github.com/dfadler/zombie-mermaid/issues/540)
