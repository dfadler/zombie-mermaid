---
'zombie-mermaid': patch
---

Add `docs/decisions/self-hosted-runner-docker-cache.md`, a no-go decision on evaluating a self-hosted GitHub Actions runner for a warm Docker cache (#738): the ~92s/run savings don't justify the operational burden and, more decisively, GitHub's own security guidance says self-hosted runners "should almost never be used for public repositories" since any PR can compromise the host — and `zombie-mermaid` is public. Docs-only, no workflow changes.
