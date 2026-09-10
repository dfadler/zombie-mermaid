/** @jsxRuntime automatic */
/**
 * A whole number rendered as one {@link SlotDigit} reel per digit, plus the
 * real value as plain, visually-hidden text — so a screen reader, a
 * copy-paste, or this page's own text search always gets "334", never the
 * decorative reel's decoy rows or a mid-spin digit.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import { SlotDigit } from './slot-digit.tsx'

/**
 * Delay between each digit position's landing scroll starting, so the
 * reels settle left-to-right in sequence instead of all snapping into
 * place at once — the classic slot-machine "clunk, clunk, clunk" rhythm
 * rather than one flat "clunk."
 */
const SLOT_STAGGER_MS = 90

/**
 * Standard visually-hidden-but-accessible technique (off-screen via a 1px
 * clipped box, not `display: none`/`visibility: hidden`, which screen
 * readers skip entirely) — see this component's doc comment for why this
 * needs to exist alongside the decorative reel at all.
 */
const visuallyHiddenStyle = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
} as const

export function SlotNumber({
  value,
  active,
}: {
  value: number
  active: boolean
}) {
  const digits = String(value)
    .split('')
    .map((d) => Number(d))

  return (
    <span style={{ position: 'relative', fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ display: 'inline-flex' }}>
        {digits.map((digit, i) => (
          <SlotDigit
            key={i}
            digit={digit}
            active={active}
            delayMs={i * SLOT_STAGGER_MS}
          />
        ))}
      </span>
      <span style={visuallyHiddenStyle}>{value}</span>
    </span>
  )
}
