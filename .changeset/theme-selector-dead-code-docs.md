---
---

No release: closes out #690, the last plumbing sub-issue of the #684
theme-selector restoration. `demo/client.ts` was already deleted (#716,
before this epic began) — verified rather than assumed, per this issue's
own acceptance criteria. `docs/guides/theming.md`'s theme-picker
walkthrough still described the pre-#590 gallery ("a theme picker in the
top bar", a **Random Theme** button) that no longer exists; corrected it
to describe the restored "Pick a look" section present on every page and
point readers at a diagram-type page to see live re-theming in action.
README.md's theming feature bullets were checked and left as-is — they
were already accurate. Nothing here touches the published `zombie-mermaid`
package — docs only.
