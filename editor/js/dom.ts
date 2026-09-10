/**
 * Small DOM lookup helpers shared across editor/js/*.ts.
 *
 * These modules assume a fixed set of element ids/classes exist because
 * demo/components/editor-page.tsx's markup (the paired React template they
 * run against) always renders them -- but nothing at the type level connects
 * the two, so `document.getElementById()` is typed `HTMLElement | null`
 * regardless. Rather than silence that with a non-null assertion at each of
 * the ~30 lookups in editor/js/elements.ts, `requireElement` validates and
 * throws immediately with the id in the message -- a renamed/removed id
 * becomes an immediate, diagnosable startup error instead of a silent
 * `null` crash deep inside some later DOM call.
 */
export function requireElement<T extends Element>(
  id: string,
  ctor: new (...args: never[]) => T,
): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`editor: missing #${id} element`)
  if (!(el instanceof ctor)) {
    throw new Error(
      `editor: #${id} is a ${el.constructor.name}, expected ${ctor.name}`,
    )
  }
  return el
}
