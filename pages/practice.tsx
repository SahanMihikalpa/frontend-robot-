import { useEffect, useMemo, useRef, useState } from 'react'
import { createInteraction, getCurrentUser, getNextQuestion, getMasterySummary } from '../lib/api'

type OptionMap = Record<string, string>

export default function PracticePage() {
  const [user, setUser] = useState<any>(null)
  const [questionPayload, setQuestionPayload] = useState<any>(null)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState('')
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionTotal, setSessionTotal] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  function startTimer() {
    setElapsed(0)
    startTimeRef.current = Date.now()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    return Math.floor((Date.now() - startTimeRef.current) / 1000)
  }

  async function loadNextQuestion() {
    setBusy(true)
    setError('')
    setSubmitted(false)
    setIsCorrect(null)
    setSelectedAnswer('')
    try {
      const next = await getNextQuestion({ strategy: 'bkt_zpd' })
      setQuestionPayload(next)
      startTimer()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to load the next question')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const u = await getCurrentUser()
        setUser(u)
        if (u?.id) {
          const s = await getMasterySummary(u.id)
          setSummary(s)
        }
      } catch { /* ignore */ }
      await loadNextQuestion()
    }
    init()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const question = questionPayload?.question || questionPayload
  const options = (question?.options || {}) as OptionMap
  const optionEntries = useMemo(() => Object.entries(options), [options])
  const correctAnswer = question?.correct_answer || question?.answer || ''

  async function submitAnswer() {
    if (!question?.id || !question?.skill_id || !selectedAnswer || submitted) return
    const timeTaken = stopTimer()
    setBusy(true)
    setError('')
    const correct = selectedAnswer === correctAnswer
    setIsCorrect(correct)
    setSubmitted(true)
    setSessionTotal((n) => n + 1)
    if (correct) setSessionCorrect((n) => n + 1)
    try {
      const res = await createInteraction({
        question_id: question.id,
        skill_id: question.skill_id,
        is_correct: correct,
        time_taken: timeTaken,
        session_id: `practice-${Date.now()}`,
      })
      if (res?.bkt) setSummary(res.bkt)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to submit answer')
    } finally {
      setBusy(false)
    }
  }

  const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : null

  function optionStyle(key: string): React.CSSProperties {
    const base: React.CSSProperties = {
      textAlign: 'left', width: '100%', padding: '13px 16px',
      borderRadius: 8, fontSize: 14, lineHeight: 1.5,
      fontFamily: 'inherit', transition: 'all 0.15s',
      border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
    }
    if (!submitted) {
      if (selectedAnswer === key) {
        return { ...base, borderColor: 'var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)' }
      }
      return base
    }
    if (key === correctAnswer) {
      return { ...base, borderColor: 'var(--success)', background: 'rgba(22,163,74,0.08)', color: 'var(--success)' }
    }
    if (key === selectedAnswer && key !== correctAnswer) {
      return { ...base, borderColor: 'var(--danger)', background: 'rgba(239,68,68,0.08)', color: 'var(--danger)' }
    }
    return { ...base, color: 'var(--muted)' }
  }

  return (
    <div className="teacher-dashboard">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">Adaptive Practice</p>
          <h2 className="editorial-title">Practice</h2>
          <p>Adaptive questions via BKT/ZPD, tuned to your current mastery level.</p>
        </div>
        <div className="teacher-hero-note">
          <span>Session accuracy</span>
          <strong>{accuracy != null ? `${accuracy}%` : '—'}</strong>
          <p>⏱ {elapsed}s on this question</p>
        </div>
      </section>

      <div className="teacher-layout">
        <section className="teacher-main">
          <section className="teacher-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">
                  {question?.skill_name || (question?.skill_id ? `Skill ${question.skill_id}` : 'Loading…')}
                  {question?.difficulty != null && ` · Difficulty ${question.difficulty}`}
                </p>
                <h3 className="editorial-title" style={{ fontSize: 28 }}>
                  {question?.question_text || 'Loading next question…'}
                </h3>
              </div>
            </div>

            {error && <p className="feedback error">{error}</p>}

            {submitted && isCorrect != null && (
              <div style={{ marginBottom: 16 }}>
                <span
                  style={{
                    fontSize: 13, fontWeight: 700, padding: '6px 14px',
                    borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: isCorrect ? 'var(--success-dim)' : 'var(--danger-dim)',
                    color: isCorrect ? 'var(--success)' : 'var(--danger)',
                    border: `1px solid ${isCorrect ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  {isCorrect ? '✓ Correct!' : `✗ Incorrect. The answer was ${correctAnswer}.`}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {optionEntries.length > 0 ? optionEntries.map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => !submitted && setSelectedAnswer(key)}
                  disabled={submitted}
                  style={{ ...optionStyle(key), cursor: submitted ? 'default' : 'pointer' }}
                >
                  <strong style={{ marginRight: 8, opacity: 0.6 }}>{key}.</strong>{value as string}
                </button>
              )) : (
                <p style={{ color: 'var(--muted)', margin: 0 }}>No options available.</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {!submitted ? (
                <button type="button" className="teacher-action primary"
                  onClick={submitAnswer} disabled={busy || !selectedAnswer}
                  style={{ minHeight: 'unset', padding: '12px 26px' }}>
                  {busy ? 'Submitting…' : 'Submit answer'}
                </button>
              ) : (
                <button type="button" className="teacher-action primary"
                  onClick={loadNextQuestion} disabled={busy}
                  style={{ minHeight: 'unset', padding: '12px 26px' }}>
                  Next question →
                </button>
              )}
              <button type="button" className="teacher-action"
                onClick={loadNextQuestion} disabled={busy}
                style={{ minHeight: 'unset', padding: '12px 26px' }}>
                Skip
              </button>
            </div>
          </section>
        </section>

        <aside className="teacher-actions">
          <p className="teacher-eyebrow">This Session</p>
          <h3 className="editorial-title">Session stats</h3>

          <div className="teacher-kpi-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 16 }}>
            <div className="teacher-kpi-card">
              <p>Answered</p>
              <strong>{sessionTotal}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>Correct</p>
              <strong style={{ color: 'var(--success)' }}>{sessionCorrect}</strong>
            </div>
          </div>

          {accuracy != null && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <p className="teacher-eyebrow" style={{ margin: 0 }}>Session accuracy</p>
                <strong style={{ fontSize: 13 }}>{accuracy}%</strong>
              </div>
              <div className="teacher-progress"><span style={{ width: `${accuracy}%` }} /></div>
            </div>
          )}

          {summary && (summary.skills || summary.skill_states || []).length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p className="teacher-eyebrow" style={{ margin: '0 0 10px' }}>Mastery overview</p>
              <div className="teacher-skill-list">
                {(summary.skills || summary.skill_states || []).slice(0, 5).map((s: any, i: number) => {
                  const pct = Math.round((s.mastery_probability ?? s.p_mastery ?? 0) * 100)
                  return (
                    <div className="teacher-skill-row" key={i}>
                      <div className="teacher-skill-topline">
                        <p>{s.skill_name || `Skill ${s.skill_id || i + 1}`}</p>
                        <span style={{ color: 'var(--accent)' }}>{pct}%</span>
                      </div>
                      <div className="teacher-progress"><span style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <p
              style={{
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontSize: 11,
                color: 'var(--muted)',
                margin: 0
              }}
            >Student</p>
            <strong style={{ display: 'block', marginTop: 8 }}>{user?.full_name || user?.username || '—'}</strong>
          </div>
        </aside>
      </div>
    </div>
  )
}
