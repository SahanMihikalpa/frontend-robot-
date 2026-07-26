import { useEffect, useState } from 'react'

// 4-7-8 breathing: a calm, well-known relaxation pattern.
const PHASES = [
  { label: 'Breathe in', secs: 4, scale: 1.65 },
  { label: 'Hold',       secs: 7, scale: 1.65 },
  { label: 'Breathe out', secs: 8, scale: 1.0 },
]
const CYCLE = PHASES.reduce((s, p) => s + p.secs, 0)

/** Guided breathing — an expanding/contracting circle paced to 4-7-8. */
export default function Breathing() {
  const [t, setT] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => (x + 1) % CYCLE), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Derive the current phase from the elapsed second in the cycle (deterministic).
  let acc = 0, idx = 0, into = 0
  for (let i = 0; i < PHASES.length; i++) {
    if (t < acc + PHASES[i].secs) { idx = i; into = t - acc; break }
    acc += PHASES[i].secs
  }
  const phase = PHASES[idx]
  const remaining = phase.secs - into

  return (
    <div className="break-breathing">
      <div className="break-breath-ring">
        <div
          className="break-breath-circle"
          style={{ transform: `scale(${phase.scale})`, transitionDuration: `${phase.secs}s` }}
        />
        <div className="break-breath-label">
          <strong>{phase.label}</strong>
          <span>{remaining}</span>
        </div>
      </div>
      <p className="meta break-game-hint">Follow the circle — inhale 4, hold 7, exhale 8. Repeat and relax.</p>
    </div>
  )
}
