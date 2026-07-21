import { useCallback, useEffect, useState } from 'react'

/**
 * Text-size control for the chat panels (learn + self-learn).
 *
 * Scales only the chat's own text — message bubbles, option buttons, labels and
 * the composer — not the surrounding page and not the browser. The chosen step
 * is written to a `--chat-font-scale` CSS variable that globals.css multiplies
 * the chat font sizes by, and remembered per panel in localStorage.
 */

/** Steps a student can land on. 1 = the design's default size. */
export const SCALE_STEPS = [0.85, 1, 1.15, 1.3, 1.5] as const
const DEFAULT_INDEX = 1

export function useChatFontScale(storageKey: string) {
  const [index, setIndex] = useState(DEFAULT_INDEX)

  // Restore after mount — localStorage isn't available during SSR, and reading
  // it in useState's initializer would desync the server/client render.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw === null) return          // never set — keep the default (Number(null) is 0, not NaN)
      const saved = Number(raw)
      if (Number.isInteger(saved) && saved >= 0 && saved < SCALE_STEPS.length) setIndex(saved)
    } catch { /* storage unavailable — keep the default */ }
  }, [storageKey])

  const move = useCallback((delta: number) => {
    setIndex((prev) => {
      const next = Math.min(SCALE_STEPS.length - 1, Math.max(0, prev + delta))
      try { window.localStorage.setItem(storageKey, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])

  return {
    scale: SCALE_STEPS[index],
    percent: Math.round(SCALE_STEPS[index] * 100),
    increase: () => move(1),
    decrease: () => move(-1),
    canIncrease: index < SCALE_STEPS.length - 1,
    canDecrease: index > 0,
  }
}

type Props = {
  percent: number
  onIncrease: () => void
  onDecrease: () => void
  canIncrease: boolean
  canDecrease: boolean
}

export default function ChatFontScale({
  percent, onIncrease, onDecrease, canIncrease, canDecrease,
}: Props) {
  return (
    <div className="chat-zoom" role="group" aria-label="Chat text size">
      <button
        type="button"
        className="learn-tts-btn chat-zoom-btn"
        onClick={onDecrease}
        disabled={!canDecrease}
        title="Smaller chat text"
        aria-label="Decrease chat text size"
      >
        A<span className="chat-zoom-sign">−</span>
      </button>
      {/* Announced on change so screen-reader users hear the new size. */}
      <span className="chat-zoom-readout" aria-live="polite">{percent}%</span>
      <button
        type="button"
        className="learn-tts-btn chat-zoom-btn"
        onClick={onIncrease}
        disabled={!canIncrease}
        title="Larger chat text"
        aria-label="Increase chat text size"
      >
        A<span className="chat-zoom-sign">+</span>
      </button>
    </div>
  )
}
