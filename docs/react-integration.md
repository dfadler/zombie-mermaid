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

**With the React Compiler:** the manual `useMemo()` above is the pattern for codebases without the compiler enabled. If your project has the [React Compiler](https://react.dev/learn/react-compiler) turned on, it memoizes this call automatically — you can call `renderMermaidSVG()` directly in the component body and drop the `useMemo()` wrapper. The synchronous, no-`useEffect` part still matters either way; only the manual memoization becomes redundant.
