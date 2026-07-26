import { useEffect, useRef, useState } from 'react'

const ELAPSED_KEY = 'study_break_elapsed_s'
export const BREAK_EVERY_S = 30 * 60   // nudge a break every 30 min of active study

function readElapsed(): number {
  if (typeof window === 'undefined') return 0
  const v = parseInt(window.localStorage.getItem(ELAPSED_KEY) || '0', 10)
  return Number.isFinite(v) && v >= 0 ? v : 0
}
function writeElapsed(v: number) {
  if (typeof window !== 'undefined') window.localStorage.setItem(ELAPSED_KEY, String(v))
}

/**
 * Accrues *active* study seconds while `active` (in a lesson) AND the tab is
 * visible. Once 30 min accumulate, `breakDue` flips true so the page can show the
 * unskippable break modal. The counter is persisted, so it spans navigating
 * between Learn and Learn Anything and survives reloads (you can't dodge a due
 * break by refreshing). Shared by both learning pages.
 */
export function useStudyBreak(active: boolean) {
  const [breakDue, setBreakDue] = useState(false)
  const elapsedRef = useRef(0)

  useEffect(() => {
    elapsedRef.current = readElapsed()
    if (elapsedRef.current >= BREAK_EVERY_S) setBreakDue(true)

    const id = window.setInterval(() => {
      if (!active) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (elapsedRef.current >= BREAK_EVERY_S) { setBreakDue(true); return }
      elapsedRef.current += 1
      writeElapsed(elapsedRef.current)
      if (elapsedRef.current >= BREAK_EVERY_S) setBreakDue(true)
    }, 1000)

    return () => window.clearInterval(id)
  }, [active])

  function resetBreak() {
    elapsedRef.current = 0
    writeElapsed(0)
    setBreakDue(false)
  }

  return { breakDue, resetBreak }
}
