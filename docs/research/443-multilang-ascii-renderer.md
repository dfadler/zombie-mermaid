# Research: single-source, multi-language (Rust/Go) ASCII renderer

Status: **research spike, not a decision.** Written for
[#443](https://github.com/dfadler/zombie-mermaid/issues/443).

The full write-up — prior-art research (CCXT's `ast-transpiler`), the friendly-subset spike
over `src/ascii/**`, WASM bundle-size/cold-start analysis, the demand read-through across
#495/#536/#540, the shared-assertion-corpus cost estimate, and sources — lives on the issue
instead of in this repo, since it answers the issue's own open questions rather than
documenting something future readers need committed alongside the code:
[#443's research comment](https://github.com/dfadler/zombie-mermaid/issues/443#issuecomment-5572062423).
This page is a condensed summary of the same findings.

## TL;DR / recommendation

**Not worth pursuing as a from-scratch TS→native transpiler right now.**

- User demand for multi-language reach _does_ exist, but it surfaced **after** #443 was
  filed — #495 (a non-AI-authored proposal) plus two AI-assisted follow-ups (#536, #540).
  All three converge on a **different, better-precedented architecture** (Go/Rust core +
  thin per-language bindings, the Temporal/Oso pattern) than either of #443's own two
  directions (transpile TS source outward, or compile a core outward via WASM).
- The "compile TS outward to Rust/Go source" direction has real prior art — CCXT's
  `ast-transpiler`, in production for years, transpiling one TS source to PHP/Python/C#/
  Go/Java/Rust — stronger precedent than #443 assumed. But CCXT's own experience shows it
  demands a permanent cross-language-compatible coding style across the whole team, not a
  one-time subset check.
- The "compile a Rust/Go core outward via WASM" direction is bundle-size-negative for this
  package: a Rust→WASM binary alone commonly runs 50–300 KB before gzip, against the
  current ASCII-only entry point's 66,560-byte **gzipped** budget — i.e. the uncompressed
  WASM payload alone can exceed today's entire compressed budget, before any JS glue.
- The "friendly TS subset" spike came back more favorable than expected — roughly 90–95%
  of `src/ascii/**` looks compatible with an AssemblyScript-like restricted dialect (zero
  real `any`, zero async, `strict: true`, only 3 trivial classes, 5 files with simple
  regex) — but that finding argues only for the shared-assertion-corpus piece of #443
  (extracting the ASCII test fixtures into a language-neutral format), independent of any
  transpiler or WASM-outward decision.

## What this means for #495/#536/#540

Park #443 as answered-by-research rather than building a transpiler or a WASM-outward core
now. The one standalone-worthwhile piece of #443 — shared-assertion corpus extraction — is
only worth doing opportunistically alongside #540's prototype, once there's a second
implementation to test against, not as separate up-front work. #443's remaining open
questions (real bundle size, real cold-start, real Unicode-porting cost, whether "provably
identical across languages" is something users actually select for) are better answered by
#540's prototype output than by another research pass — #443 itself should close or
re-scope once that prototype exists.
