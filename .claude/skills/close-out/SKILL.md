---
name: close-out
description: |
  Close-out checklist for a PR, run at PR-open and again at merge: make sure
  every "follow-up" in the PR body is a filed issue, and that external
  reporters of the issues the PR closes get a closing comment naming the
  release version. Use when opening a PR, when asked to merge or close an
  issue, or when asked to "close out" a PR/issue. Draft-only: it never files
  an issue, posts a comment, closes an issue, or merges on its own; every
  publish goes through gh-publish-guide and the user's explicit yes.
---

# close-out

Background: PR bodies said "follow-up" without filing one (#1558), and external
reporters got no closing comment (#1555, #1557). This skill catches both. It
only drafts and reports; the user approves each publish.

Use `gh-untrusted` to read issue/PR text written by others.

## 1. Follow-ups are filed issues (PR-open and merge)

1. Scan the PR body (and the commit messages) for deferred work:
   `gh pr view <N> --json body -q .body | grep -inE 'follow-?up|todo|later|deferred'`
2. Each hit must cite a filed issue number (`#NNNN`) on the same line. A hit
   with no number is an unfiled follow-up (a hit that is not a real deferral,
   e.g. "later in this doc", is fine; say so).
3. For each unfiled one, draft the issue: Write the body to a file in your
   scratchpad, show title + body, and on approval (gh-publish-guide) run
   `gh issue create --title ... --body-file <file>`. Never a heredoc inside
   `$()`. Then edit the PR body to cite the new number.

## 2. External reporters get a closing comment (merge)

1. List the issues the PR closes: `gh pr view <N> --json closingIssuesReferences`.
   If the PR resolves an issue without a `Closes #N` keyword, say so and add
   the keyword rather than closing by hand.
2. For each, get the author:
   `gh issue view <I> --json author,authorAssociation`. External means the
   author is not the repo owner (`authorAssociation` other than `OWNER`) and
   not a bot (`author.is_bot`, or a login ending in `[bot]`).
3. For external-authored issues, find the version it ships in:
   - Not yet released: a pending `.changeset/*.md` means the version is not
     assigned until the Version Packages PR merges; say "the next release".
   - Already released: `gh release list --limit 5`, or
     `git tag --contains <merge-sha>`.
4. Draft a short comment: thanks, what changed (link the PR), and
   "Fixed in vX.Y.Z" (or "will ship in the next release"). Show it and post
   only after approval via gh-publish-guide; write it with a body file.
5. Do not run `gh issue close` on an external-authored issue until its comment
   is posted. Merging a PR with `Closes #N` closes it automatically, so post
   (or at least get approval for) the comment first.

## Report

End with one line per item: follow-ups (filed / unfiled / n/a) and external
issues (comment posted / drafted, awaiting approval / n/a). Never touch
version bumps or CHANGELOG.
