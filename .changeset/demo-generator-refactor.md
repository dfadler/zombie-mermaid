---
---

Demo site only: split the demo page generator out of one 1775-line function. The inline stylesheet moves to `demo/styles.css`, the inline client script to a bundled `demo/client.ts`, and the sidebar and theme picker become composable functions. No published package change; the generated page is behaviorally identical.
