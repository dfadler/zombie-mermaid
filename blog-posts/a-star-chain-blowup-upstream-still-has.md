---
title: The A* Blowup That Upstream Still Has and the Fork Does Not
date: 2026-10-12
description: A plain 25-edge flowchart chain makes upstream beautiful-mermaid 1.1.3 spend about 19 seconds and then throw "Map maximum size exceeded". The same input renders in milliseconds here. We bisected it to a 12-line iteration cap that has been sitting in an open upstream PR since March.
---

On 2026-10-10 dynaum added a comment to upstream
[lukilabs/beautiful-mermaid#64](https://github.com/lukilabs/beautiful-mermaid/issues/64):
a flowchart that is nothing but a chain of 25 edges makes `renderMermaidASCII`
run for about 12 seconds and then throw `RangeError: Map maximum size
exceeded`. At 24 edges it renders in 0.08 s. The issue was filed in March for
a different input, a dense top-down graph with several fan-in bundles, and this
was a second trigger with no bundles at all.

The generator is short enough to quote:

```ts
const chain = (n: number) =>
  'flowchart TD\n' +
  Array.from({ length: n }, (_, i) => `  N${i} --> N${i + 1}`).join('\n')

renderMermaidASCII(chain(24)) // renders
renderMermaidASCII(chain(25)) // upstream 1.1.3: throws
```

I ran it before deciding what to write. The short version is that it does not
reproduce in this fork, upstream still has it, and the fix is a 12-line change
that was proposed upstream seven months ago.

## What I measured

All of this is one laptop, Node v22.22.1, one run per cell. Single runs, so
differences of a few milliseconds are noise. The upstream column is
`beautiful-mermaid@1.1.3` installed from npm; the fork column is current
`main` (5.0.1).

| Direction | Edges | Upstream 1.1.3                                       | zombie-mermaid 5.0.1 |
| --------- | ----- | ---------------------------------------------------- | -------------------- |
| TD        | 24    | renders, 15 ms                                       | renders, 15 ms       |
| TD        | 25    | `RangeError: Map maximum size exceeded` after 18.7 s | renders, 5 ms        |
| LR        | 24    | renders, 11 ms                                       | renders, 5 ms        |
| LR        | 25    | `RangeError: Map maximum size exceeded` after 20.2 s | renders, 3 ms        |

dynaum measured about 12.5 s for the TD case; mine is slower, with the same
failure. I also ran the fork at 40 and 60 edges in both directions and it
renders each in under 100 ms. I did not run those on upstream.

The cliff at exactly 25 edges is real on upstream, and I do not know why the
threshold lands there. I did not look into the layout to explain it. What I can
say is where it goes away.

## Finding the commit

Rather than guess which of our fixes was responsible, I bisected between
upstream's 1.1.3 and the fork's `main`, with "throws or takes more than 30
seconds" as the old behaviour and "renders cleanly" as the new one. About
eleven steps, no commits skipped. The first commit that renders the chain is
[`bc455262`](https://github.com/dfadler/zombie-mermaid/commit/bc455262db45e5a82f97f3a1a6cd9f2edf7ee5aa),
merged as [#52](https://github.com/dfadler/zombie-mermaid/pull/52) on
2026-08-25:

| Commit                    | Result on the 25-edge TD chain                       |
| ------------------------- | ---------------------------------------------------- |
| upstream 1.1.3            | hit the 30 s kill timer                              |
| a midpoint before the fix | `RangeError: Map maximum size exceeded` after 23.1 s |
| parent of `bc455262`      | hit the 30 s kill timer                              |
| `bc455262`                | renders in 74 ms                                     |
| current `main`            | renders in 15 ms                                     |

The times are longer than the table above because the bisect harness runs the
renderer through `tsx` in a child process, and I only care about the
broken-versus-fixed boundary there, not the absolute numbers.

## What the fix is

The ASCII renderer routes edges with an A* search over a character grid
(`getPath()` in the pathfinder). Before `bc455262` that loop had no bound. If
the destination was not reachable through free cells, the search kept expanding
the open set and its `cameFrom` map until V8's `Map` size limit stopped it,
which is the error in the report.

The change adds a counter to the loop:

```ts
const MAX_ITERATIONS = 50_000
// ...
if (++iterations > MAX_ITERATIONS) {
  return null
}
```

`null` already meant "no path found" to the callers, which fall back to a
simpler route, so no caller changed. The commit also adds a 158-line regression
test for the dense fan-in graph from the original report.

The change is not our idea. It is a port of
[lukilabs/beautiful-mermaid#66](https://github.com/lukilabs/beautiful-mermaid/pull/66)
by [@ktrysmt](https://github.com/ktrysmt), who also filed #64, and whose PR
adds the same `MAX_ITERATIONS = 50_000` guard and a test file. #66 was opened
on 2026-03-18, the same day as the issue. As of 2026-10-12 it is still open,
and so is #64.

## What the cap does not do

The cap is per call. A graph with many edges can still spend up to 50,000
iterations on each of them, which adds up. That is what
[#89](https://github.com/dfadler/zombie-mermaid/pull/89) addressed on
2026-08-26: its description says the per-call cap from #52 could still exhaust
the heap across many calls on a dense graph, and adds a render-wide iteration
budget shared by every `getPath` call, plus a shortcut that skips A* when a
direct route is unobstructed. A later fix,
[#1481](https://github.com/dfadler/zombie-mermaid/pull/1481), makes the search
fail fast when the target cell is sealed instead of flooding the open area up
to the cap.

I have not measured how much each of those matters for the chain case. The
bisect says #52 alone is what moves the 25-edge chain from throwing to
rendering. #89 and #1481 matter for the dense graphs and for speed, and I make
no claim about them here.

I also have not checked the original report's edge-bundle inputs on upstream
with #66 applied. All I tested was the plain chain.

## What this means for someone hitting it

- If you call `renderMermaidASCII` on upstream 1.1.3 with generated or
  user-supplied diagrams, a 25-edge chain is enough to lock the process for
  about 20 seconds and then throw. Terminal tools with a timeout lose the
  whole document. dynaum works around it by drawing in a child process with a
  deadline.
- The fork's `renderMermaidASCII` is the same entry point under the package
  name `zombie-mermaid`. On the inputs above it returns in milliseconds.
- If you find an input that is slow or throws on the fork, open an issue with
  the Mermaid source.

## Corrections

- My first reply to dynaum on #64 said I could not say which change made the
  difference. That was true when I wrote it, before the bisect. A follow-up
  comment on #64 gives the commit and links #66.
