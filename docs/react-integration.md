# React Integration

Because rendering is synchronous, you can use `useMemo()` for zero-flash diagram rendering:

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
- **Memoized** — Only re-renders when `code` changes
