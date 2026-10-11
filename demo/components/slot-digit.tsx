/** @jsxRuntime automatic */
/**
 * One digit's vertical reel: a tall stack of rows (see {@link
 * buildReelRows}) inside a one-row-tall `overflow: hidden` window, scrolled
 * via `transform: translateY` so only the bottom row (the real digit) is
 * ever visible at rest. `aria-hidden` — the decoy rows above it would
 * otherwise read out to a screen reader as a garbled run of digits (e.g.
 * "0123423" for a reel landing on "3"); `SlotNumber` (`slot-number.tsx`)
 * renders the real value as plain, visually-hidden text alongside this reel
 * for that reason.
 *
 * The spin is a two-step style flip, not a single `useState` update:
 * `active` flipping true first snaps the strip to its *top* row (digit 0)
 * with no transition, then — two animation frames later, so the browser has
 * actually painted that snap and has something to transition *from* — a
 * second update applies the transition and scrolls it down to the real
 * digit's row. A single synchronous update instead risks the browser
 * coalescing both style changes into one paint and never rendering the
 * transition at all — the standard "force a paint, then animate" fix for
 * restarting a CSS transition (one rAF is occasionally still not enough for
 * the paint to have landed by the time it fires; two is the reliable form).
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import { useEffect, useState } from 'react'

/**
 * How many full 0-9 laps a digit reel spins through before landing on its
 * real digit. More laps means more travel distance at the same {@link
 * SLOT_DURATION_MS} — i.e. a faster-looking spin over the same total time,
 * not a longer one; {@link SLOT_DURATION_MS} is what controls how long the
 * animation actually takes.
 */
const SLOT_LOOPS = 1

/** How long each digit reel's landing scroll takes, once it starts. */
const SLOT_DURATION_MS = 4650

const SLOT_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'

/**
 * A single digit reel's rows: 0-9 repeated {@link SLOT_LOOPS} times, then
 * continuing up through `digit` one more time — so the *last* row is
 * always the real digit, whatever it is. Scrolling this strip's bottom row
 * into view (see {@link SlotDigit}) is what makes it "land" on the correct
 * number.
 */
function buildReelRows(digit: number): number[] {
  const length = SLOT_LOOPS * 10 + digit + 1
  return Array.from({ length }, (_, i) => i % 10)
}

export function SlotDigit({
  digit,
  active,
  delayMs,
}: {
  digit: number
  active: boolean
  delayMs: number
}) {
  const rows = buildReelRows(digit)
  const restEm = -(rows.length - 1)
  const restStyle = {
    transform: `translateY(${restEm}em)`,
    transition: 'none',
  }
  const [style, setStyle] = useState<{ transform: string; transition: string }>(
    restStyle,
  )

  useEffect(() => {
    if (!active) return
    if (typeof requestAnimationFrame === 'undefined') return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ) {
      return
    }

    setStyle({ transform: 'translateY(0em)', transition: 'none' })
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setStyle({
          transform: `translateY(${restEm}em)`,
          transition: `transform ${SLOT_DURATION_MS}ms ${SLOT_EASING} ${delayMs}ms`,
        })
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
    // Deliberately keyed on `active` alone: `restEm`/`delayMs` are pure
    // functions of this reel's own fixed `digit`/position, never change
    // for a mounted instance, and re-running on their account would be a
    // no-op anyway.
  }, [active])

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        height: '1em',
        lineHeight: 1,
        verticalAlign: 'bottom',
      }}
    >
      <span style={{ display: 'block', ...style }}>
        {rows.map((row, i) => (
          <span
            key={i}
            style={{ display: 'block', height: '1em', lineHeight: 1 }}
          >
            {row}
          </span>
        ))}
      </span>
    </span>
  )
}
