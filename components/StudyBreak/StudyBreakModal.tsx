import { useEffect, useState } from 'react'
import FlappyBird from './FlappyBird'
import Game2048 from './Game2048'
import MemoryMatch from './MemoryMatch'
import Breathing from './Breathing'
import RestVideo from './RestVideo'

const MIN_BREAK_S = 5 * 60    // "Resume" stays locked until 5 min have passed
const MAX_BREAK_S = 10 * 60   // break auto-ends at 10 min

type Activity = 'menu' | 'flappy' | '2048' | 'memory' | 'breathing' | 'video'

const ACTIVITIES: { key: Exclude<Activity, 'menu'>; label: string; emoji: string; blurb: string }[] = [
  { key: 'flappy', label: 'Flappy Bird', emoji: '🐤', blurb: 'Tap to flap through the pipes' },
  { key: '2048', label: '2048', emoji: '🔢', blurb: 'Slide tiles, chase 2048' },
  { key: 'memory', label: 'Memory Match', emoji: '🃏', blurb: 'Find the matching pairs' },
  { key: 'breathing', label: 'Breathe', emoji: '🫧', blurb: 'Guided 4-7-8 breathing' },
  { key: 'video', label: 'Rest video', emoji: '📺', blurb: 'Lofi · meditate · stretch' },
]

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Unskippable break modal. Opens after 30 min of study. The learner picks a rest
 * activity; "Resume learning" unlocks after MIN_BREAK_S and the break auto-ends at
 * MAX_BREAK_S. `onResume` clears the study timer and closes the modal.
 */
export default function StudyBreakModal({ onResume }: { onResume: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [activity, setActivity] = useState<Activity>('menu')

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (elapsed >= MAX_BREAK_S) onResume()   // hit the 10-min cap → back to learning
  }, [elapsed, onResume])

  const canResume = elapsed >= MIN_BREAK_S
  const untilUnlock = Math.max(0, MIN_BREAK_S - elapsed)

  return (
    <div className="study-break-overlay" role="dialog" aria-modal="true" aria-label="Take a study break">
      <div className="study-break-card">
        <div className="study-break-head">
          <div>
            <p className="teacher-eyebrow" style={{ margin: 0 }}>Time for a break 🌿</p>
            <h3 className="editorial-title" style={{ margin: '2px 0 0' }}>You've studied for 30 minutes</h3>
          </div>
          <div className="study-break-timer">
            <span className="study-break-clock">{fmt(elapsed)}</span>
            <span className="meta">into your break</span>
          </div>
        </div>

        <p className="meta study-break-sub">
          Rest your eyes and mind. Pick something below — you can head back to learning{' '}
          {canResume ? 'whenever you’re ready.' : `in ${fmt(untilUnlock)}.`}
        </p>

        {activity === 'menu' ? (
          <div className="study-break-menu">
            {ACTIVITIES.map((a) => (
              <button key={a.key} className="study-break-tile" onClick={() => setActivity(a.key)}>
                <span className="study-break-emoji">{a.emoji}</span>
                <strong>{a.label}</strong>
                <span className="meta">{a.blurb}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="study-break-activity">
            <button className="btn ghost small study-break-back" onClick={() => setActivity('menu')}>
              ← Activities
            </button>
            <div className="study-break-stage">
              {activity === 'flappy' && <FlappyBird />}
              {activity === '2048' && <Game2048 />}
              {activity === 'memory' && <MemoryMatch />}
              {activity === 'breathing' && <Breathing />}
              {activity === 'video' && <RestVideo />}
            </div>
          </div>
        )}

        <div className="study-break-foot">
          <span className="meta">
            {canResume
              ? 'Break complete — resume any time. Auto-resumes at 10:00.'
              : `Resume unlocks at ${fmt(MIN_BREAK_S)} · auto-resumes at ${fmt(MAX_BREAK_S)}`}
          </span>
          <button className="btn study-break-resume" onClick={onResume} disabled={!canResume}>
            {canResume ? 'Resume learning →' : `Resume in ${fmt(untilUnlock)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
