# React Integration

Because rendering is synchronous, you can call `renderMermaidSVG()` directly in the render body — no `useEffect` round trip, no flash. Wrapping the call in `useMemo()` additionally skips recomputing the SVG on renders where `code` hasn't changed:

```tsx
import { renderMermaidSVG } from 'zombie-mermaid'

function MermaidDiagram({ code }: { code: string }) {
  const { svg, error } = React.useMemo(() => {
    try {
      return {
        svg: renderMermaidSVG(code, {
          bg: 'var(--background)',
          fg: 'var(--foreground)',
          transparent: true,
        }),
        error: null,
      }
    } catch (err) {
      return {
        svg: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }, [code])

  if (error) return <pre>{error.message}</pre>
  return <div dangerouslySetInnerHTML={{ __html: svg! }} />
}
```

**Why this works well:**

- **No flash** — SVG is computed synchronously during render, not in a useEffect
- **CSS variables** — Pass `var(--background)` etc. instead of hex colors. The SVG inherits from your app's CSS, so theme switches apply instantly without re-rendering
- **Memoized** — Only recomputed when `code` changes
- **Links and hover stay interactive** — `dangerouslySetInnerHTML` inlines the SVG into your page's DOM. An `<img src="data:image/svg+xml,...">` approach would render the SVG in the browser's secure static mode instead, where `click`-generated links and CSS `:hover` tooltips go inert — see [`docs/decisions/no-script-interactivity.md`](decisions/no-script-interactivity.md) for why

**With the React Compiler:** the manual `useMemo()` above is the pattern for codebases without the compiler enabled. If your project has the [React Compiler](https://react.dev/learn/react-compiler) turned on, it memoizes this call automatically — you can call `renderMermaidSVG()` directly in the component body and drop the `useMemo()` wrapper. The synchronous, no-`useEffect` part still matters either way; only the manual memoization becomes redundant.

## Strict Content-Security-Policy

If your app ships a `style-src` without `'unsafe-inline'`, the diagram's two inline-style surfaces — the `<style>` element and the root `<svg style="--bg: …">` attribute carrying the theme variables — are both blocked, and it renders unstyled ([issue #216](https://github.com/dfadler/zombie-mermaid/issues/216)). A nonce can allow the element but never the attribute, so use both options together and move the variables into a nonced stylesheet you control:

```tsx
import { renderMermaidSVG, themeCssVariables } from 'zombie-mermaid'

function MermaidDiagram({ code, nonce }: { code: string; nonce: string }) {
  const opts = {
    bg: 'var(--background)',
    fg: 'var(--foreground)',
    transparent: true,
    nonce, // every <style> in the SVG gets nonce="…"
    styleAttribute: false, // no root style= attribute
  }
  const svg = React.useMemo(() => renderMermaidSVG(code, opts), [code, nonce])
  const css = `.mermaid svg { ${themeCssVariables(opts)} }`
  return (
    <>
      <style nonce={nonce}>{css}</style>
      <div className="mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
    </>
  )
}
```

`themeCssVariables()` returns the exact declarations the attribute would have carried, so pass it the same options. If the theme colours are static you can put that rule in your regular external stylesheet instead of a nonced `<style>`; `styleAttribute: false` is the only part that must be set at render time.
