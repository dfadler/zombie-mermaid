---
title: Sharing our fixes upstream, 68 threads and what came back
date: 2026-10-14
description: Between 2026-08-29 and 2026-10-12 I commented on 68 beautiful-mermaid threads to say a fix exists in zombie-mermaid. Counts of what went out, the 19 threads that got a reply or reaction, the 49 that did not, and what I would do differently.
---

Between 2026-08-29 and 2026-10-12 I left 71 comments on 68 threads in
[`lukilabs/beautiful-mermaid`](https://github.com/lukilabs/beautiful-mermaid),
each saying that a bug someone had reported or fixed there is fixed in
`zombie-mermaid`. This post counts what went out, what came back, and what did
not. The short version: 19 of the 68 threads got a reply or a reaction, all of
it friendly, and the other 49 got nothing. One report, upstream
[#149](https://github.com/lukilabs/beautiful-mermaid/issues/149), is still not
fixed.

I have no data on whether any of this led to installs. What I can source is
below.

## How the numbers were counted

Every number in this post comes from read-only queries of the GitHub API:

- **Comments sent:** all issue comments on `lukilabs/beautiful-mermaid`
  (`repos/lukilabs/beautiful-mermaid/issues/comments`) authored by `dfadler`,
  76 in total. I excluded 5 that sit on pull requests I had opened upstream by
  mistake (`gh` defaulted to the parent repo; I closed each with an apology).
  That leaves 71 comments on 68 distinct threads, 37 issues and 31 pull
  requests, filed by 49 different people.
- **Waves:** by UTC date of the comment, counting each thread once at its
  first comment.
- **Replies:** a comment by someone other than me on one of those threads,
  after my first comment there.
- **Reactions:** the reactions endpoint for each of my comments.

An earlier tally of "about 45 threads" turned out to be the count before the
2026-10-07 wave. 25 + 14 + 6 is 45, and the later waves added 19 and 4 more.
Another internal note counted that 10-07 wave as 22 comments. Re-counting from
the API gives 19, all posted between 15:41 and 15:43 UTC.

## What went out

| Wave (UTC) | Threads | What the comment said                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-29 | 25      | "Heads up, this is fixed in our fork", with a one-paragraph description of the fix. All 25 were issues.                                                                                                                                                                                                                                                                                                              |
| 2026-09-29 | 14      | Pull requests: the fix is in the fork, usually with fork PR, merge commit, first release and a before and after.                                                                                                                                                                                                                                                                                                     |
| 2026-10-06 | 6       | Mostly fixes that had just landed ([#156](https://github.com/lukilabs/beautiful-mermaid/pull/156), [#157](https://github.com/lukilabs/beautiful-mermaid/pull/157), [#158](https://github.com/lukilabs/beautiful-mermaid/pull/158), pie charts on [#151](https://github.com/lukilabs/beautiful-mermaid/pull/151)), plus [#128](https://github.com/lukilabs/beautiful-mermaid/pull/128) and the open question on #149. |
| 2026-10-07 | 19      | A second bulk pass over issues and PRs the first wave had missed, each linking the fork PR that fixed it.                                                                                                                                                                                                                                                                                                            |
| 2026-10-12 | 4       | Answers on [#51](https://github.com/lukilabs/beautiful-mermaid/pull/51) and [#105](https://github.com/lukilabs/beautiful-mermaid/pull/105) (more below), and on [#34](https://github.com/lukilabs/beautiful-mermaid/pull/34) and [#71](https://github.com/lukilabs/beautiful-mermaid/pull/71), which asked whether C4 diagrams exist anywhere.                                                                       |

Two threads got more than one comment: [#64](https://github.com/lukilabs/beautiful-mermaid/issues/64)
(wave one, then two on 10-12 answering a new repro, covered in
[the A* post](a-star-chain-blowup-upstream-still-has.html)) and
[#139](https://github.com/lukilabs/beautiful-mermaid/pull/139) (wave two, then
a reply to its author).

The comments link to 43 distinct fork pull requests and issues. The wording
changed over time. The first wave was a short heads-up. By the 09-29 wave the
comments usually carried the fork PR, the merge commit, the first release
containing the fix, and a rendering of the author's diagram. Several of the
comments from 10-06 onward were drafted by Claude, and say so in their opening line.

## What came back

Nobody was unfriendly. Of the 68 threads:

- **8 got a reply addressed to us.** Another person also added an unrelated
  repro on #64 on 10-10, which I count separately.
- **15 comments drew a reaction**, 16 reactions in total from 14 people: eight
  thumbs-up, five hearts, two hoorays and one eyes. None were negative.
- **19 threads in total got a reply or a reaction.** 18 people were involved,
  since four of them did both.

Three people said they would switch, or already had. I link each rather than
quote at length.

- [@Bougerous on #140](https://github.com/lukilabs/beautiful-mermaid/issues/140#issuecomment-5466132707) wrote that they would be switching.
- [@aryasaatvik on #135](https://github.com/lukilabs/beautiful-mermaid/pull/135#issuecomment-5896696444) wrote "will switch to zombie mermaid" and closed their own pull request that minute. The
  [cherry-picking post](upstream-pr-to-fork-authorship-intact.html) tells that story.
- [@richardtallent on #81](https://github.com/lukilabs/beautiful-mermaid/pull/81#issuecomment-6041449003) wrote that they had already switched.

Others were warm without committing. [@yhatt on #73](https://github.com/lukilabs/beautiful-mermaid/issues/73#issuecomment-5467838490)
said they would keep an eye on the fork. [@wsnark](https://github.com/lukilabs/beautiful-mermaid/pull/134#issuecomment-5894584412),
[@GauBen](https://github.com/lukilabs/beautiful-mermaid/pull/77#issuecomment-6041518766)
and [@birenroy](https://github.com/lukilabs/beautiful-mermaid/pull/151#issuecomment-6049617913) said thanks. Birenroy
wrote that they had not realised upstream was no longer actively accepting pull requests,
which is the most useful thing any of these threads told me: some people do not
know. [#83](https://github.com/lukilabs/beautiful-mermaid/issues/83) was closed by its reporter two days
after my comment. They did not say why, so I do not read anything into it.

Those are statements in public comments. I did not check whether anyone
installed anything, and three sentences do not make an adoption story.

## What did not come back

**49 of 68 threads got no reply and no reaction.** That is 72%, and it includes
most of the 10-07 wave. A bulk comment on a thread whose author left the
project months ago reaches nobody. That was the point of the work, but it
should not be counted as a conversation.

**#149 is not fixed.** [The issue](https://github.com/lukilabs/beautiful-mermaid/issues/149)
asks for rendering in Web Workers and Cloudflare Workers. The only reply there
before mine said it was a must for streaming. My comment on 10-06 said the fix
was not in the fork either, because the SVG renderer imports `elkjs`
statically and lays out on the main thread, and I asked what the reporter
needed. Nobody has answered. Since then 5.0.0 made `elkjs` an optional peer
dependency ([#1444](https://github.com/dfadler/zombie-mermaid/pull/1444), from
[#1370](https://github.com/dfadler/zombie-mermaid/issues/1370)). That was
aimed at the bundle-size obstacle I named, but I have not tested it in a
Workers runtime, so the issue is not fixed and I am not claiming it is. The
revisit is tracked in [#1524](https://github.com/dfadler/zombie-mermaid/issues/1524).

**My own upstream pull request has no comments.** [#142](https://github.com/lukilabs/beautiful-mermaid/pull/142),
a parser fix, is open and nobody has looked at it. I also opened five other pull
requests there by mistake in August and October ([#145](https://github.com/lukilabs/beautiful-mermaid/pull/145),
[#146](https://github.com/lukilabs/beautiful-mermaid/pull/146),
[#147](https://github.com/lukilabs/beautiful-mermaid/pull/147),
[#148](https://github.com/lukilabs/beautiful-mermaid/pull/148),
[#153](https://github.com/lukilabs/beautiful-mermaid/pull/153)), each meant for this repo. They are closed. Each one
sent the upstream maintainers a notification for nothing, and it happened five
times.

## Credit and authorship

For fixes that began as someone's upstream pull request, the practice is the
one in the [earlier post](upstream-pr-to-fork-authorship-intact.html): cherry-pick with `-x`
where the code allows it so git keeps the author, keep fork-only edits in
separate commits, name the author in the changelog, and tell them.

That did not hold everywhere. Three upstream pull requests were ported without
anyone telling the authors: [#51](https://github.com/lukilabs/beautiful-mermaid/pull/51)
(a CLI, by [@vinceyyy](https://github.com/vinceyyy)), and
[#105](https://github.com/lukilabs/beautiful-mermaid/pull/105) and
[#106](https://github.com/lukilabs/beautiful-mermaid/pull/106) (both by
[@rjulius23](https://github.com/rjulius23)). The port of #51 was adapted to the fork's API
and build rather than cherry-picked, and the 1.2.0 changelog entry
credits it by name and links the upstream PR. The [#105/#106 changelog
entry](https://github.com/dfadler/zombie-mermaid/blob/main/CHANGELOG.md) links both upstream pull requests. The credit
was in the changelog from the start. The notice was not sent until 2026-10-12,
when I commented on [#51](https://github.com/lukilabs/beautiful-mermaid/pull/51#issuecomment-6126612687)
and [#105](https://github.com/lukilabs/beautiful-mermaid/pull/105#issuecomment-6126613003),
weeks after the fact. Neither has replied. The #105 comment covers #106 too, so #106 itself has no
comment from me. That is tracked in [#1518](https://github.com/dfadler/zombie-mermaid/issues/1518).

## What I would do differently

1. **Tell the author when the port lands, not weeks later.** The three late
   notices were the only real misstep. A line in the porting checklist is
   enough.
2. **Prefer a thread with a living participant.** The replies came from people
   who were still watching: PR authors, recent reporters, someone who had
   posted days earlier. A thread whose reporter has not posted in a year is
   unlikely to answer. This is a hunch from 19 of 68, not a measured rate.
3. **Put the before and after in the comment.** The 09-29 wave had a rendering
   of the author's own diagram and drew a reply or reaction on 4 of its 14 threads. The first wave
   had a text description and drew a reply or reaction on 7 of 25. That is too
   small to say the screenshots made the difference, so I am only reporting it.
4. **Say what is not fixed.** The #149 comment was the least popular and the
   most honest. It is also the one I can point back to.
5. **Do not scale this up for its own sake.** The 10-07 wave cost 19 comments
   in two minutes and produced five responses. I would do the same again for
   threads with a live author, and not otherwise.

The fork-side list is on the [fork-fixes page](https://dfadler.github.io/zombie-mermaid/fork-fixes.html).
