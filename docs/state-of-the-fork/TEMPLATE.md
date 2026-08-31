# State of the fork — YYYY-MM

Period covered: `YYYY-MM-DD` to `YYYY-MM-DD`.

<!--
  Fill in every section below using the command shown in its comment. Run the
  command yourself and copy the real result — don't estimate, round up, or
  carry a number forward from a previous report without re-checking it. If a
  category has nothing to report for the period, say "none this period"
  rather than deleting the section.
-->

## Releases shipped

<!-- gh release list --repo dfadler/zombie-mermaid --limit 10
     Filter to releases whose date falls in the period. -->

- vX.Y.Z (YYYY-MM-DD) — one line on what it shipped, from CHANGELOG.md

## Fixes traced to upstream issues

<!-- grep -oP "upstreamIssues:\s*\[\K[^\]]+" demo/fork-fixes-data.ts | tr ',' '\n' | tr -d ' ' | sort -nu
     Compare against last report's list; report only what's new this period.
     demo/fork-fixes-data.ts is the source of truth for "confirmed fixed, and
     commented on upstream" — see its ForkFix.upstreamIssues field. -->

- N new fixes this period, tracing to upstream issue(s) #___, #___, ...
- Running total: N distinct upstream issues resolved by this fork to date

## PR-rescue progress

<!-- This tracks issue #258 (cherry-picking/rebasing upstream's stale PRs
     into this fork, credited to the original author) — it is a distinct
     activity from "fixes traced to upstream issues" above, which covers
     bugs independently found and fixed in this fork's own code. Report
     honestly if the campaign hasn't produced anything yet, rather than
     conflating the two. -->

- N upstream PRs rescued this period (cherry-picked or rebased in, original
  author credited) — or "none yet; tracked in #258"

## Activity snapshot

<!-- Merged PRs in the period:
       gh pr list --repo dfadler/zombie-mermaid --state merged --limit 400 \
         --json number,mergedAt | jq '[.[] | select(.mergedAt >= "<start>" and .mergedAt <= "<end>")] | length'
     Issues closed in the period: same idea with `gh issue list --state closed`
     Commits in the period: git log --since=<start> --until=<end> --oneline | wc -l
     Contributors in the period: git log --since=<start> --until=<end> --format='%an' | sort -u -->

- N PRs merged, N issues closed, N commits
- Contributors: names (note if solo-maintained)

## Vs. upstream

<!-- gh pr list --repo lukilabs/beautiful-mermaid --state open --limit 100 --json number,createdAt
       | jq 'sort_by(.createdAt) | .[0]'   # oldest open PR
     gh pr list --repo lukilabs/beautiful-mermaid --state merged --limit 5 --json mergedAt
       | jq '.[0].mergedAt'                # most recent upstream merge -->

- Upstream open PR count: N (oldest dated YYYY-MM-DD)
- Upstream's most recent merge: YYYY-MM-DD

## Notes

Anything that doesn't fit the categories above, or a caveat on a number
(e.g. "commit count includes an imported pre-fork history, not just this
period's work").
