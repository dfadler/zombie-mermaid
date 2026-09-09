---
---

Removed `demo/client.ts`, the pre-#598 sample-gallery script (SVG/ASCII toggle,
theme switching, and the modal "Edit dialog" this file's `.edit-overlay`/
`.edit-dialog` code implemented). #598's home-page rebuild (merged as
17d3937) stopped bundling it into `index.ts`'s output, and no other
generator, page, or test imports it — it had become fully unreachable dead
code. Site editing already lives in the standalone, non-modal Editor page
(`editor.html`, `demo/components/editor-page.tsx`), which is the inline
source+preview experience issue #409 asked to explore; removing the last
orphaned modal-dialog code completes that migration.
