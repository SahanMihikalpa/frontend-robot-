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
    if (!submitted) {
      return { textAlign: 'left', borderColor: selectedAnswer === key ? 'var(--accent)' : undefined }
    }
    if (key === correctAnswer) return { textAlign: 'left', borderColor: '#4ade80', background: 'rgba(74,222,128,0.1)' }
    if (key === selectedAnswer && key !== correctAnswer) return { textAlign: 'left', borderColor: '#f87171', background: 'rgba(248,113,113,0.1)' }
    return { textAlign: 'left', opacity: 0.5 }
  }

  return (
    <div className="grid-two" style={{ alignItems: 'start' }}>
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Practice</h2>
            <p className="meta">Adaptive questions via BKT/ZPD.</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge neutral">⏱ {elapsed}s</span>
            {accuracy != null && <span className="badge">{accuracy}% accuracy</span>}
          </div>
        </div>

        {error && <p className="feedback error">{error}</p>}

        {submitted && isCorrect != null && (
          <p className={`feedback ${isCorrect ? 'success' : 'error'}`}>
            {isCorrect ? '✓ Correct!' : `✗ Incorrect. The answer was ${correctAnswer}.`}
          </p>
        )}

        <div className="list-item">
          <p className="meta">
            {question?.skill_name || (question?.skill_id ? `Skill ${question.skill_id}` : 'Loading…')}
            {question?.difficulty != null && ` · Difficulty ${question.difficulty}`}
          </p>
          <h3 style={{ marginTop: 8, marginBottom: 0, lineHeight: 1.4 }}>
            {question?.question_text || 'Loading next question…'}
          </h3>
        </div>

        <div className="list">
          {optionEntries.length > 0 ? optionEntries.map(([key, value]) => (
            <button
              key={key}
              type="button"
              className="list-item"
              onClick={() => !submitted && setSelectedAnswer(key)}
              disabled={submitted}
              style={optionStyle(key)}
            >
              <strong>{key}.</strong> {value as string}
            </button>
          )) : (
            <p className="meta">No options available.</p>
          )}
        </div>

        <div className="row">
          {!submitted ? (
            <button type="button" className="btn" onClick={submitAnswer} disabled={busy || !selectedAnswer}>
              {busy ? 'Submitting…' : 'Submit answer'}
            </button>
          ) : (
            <button type="button" className="btn" onClick={loadNextQuestion} disabled={busy}>
              Next question →
            </button>
          )}
          <button type="button" className="btn secondary" onClick={loadNextQuestion} disabled={busy}>
            Skip
          </button>
        </div>
      </section>

      <aside className="card stack">
        <h3 style={{ margin: 0 }}>Session stats</h3>

        <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="kpi-card">
            <p className="kpi-label">Answered</p>
            <p className="kpi-value">{sessionTotal}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Correct</p>
            <p className="kpi-value" style={{ color: '#4ade80' }}>{sessionCorrect}</p>
          </div>
        </div>

        {accuracy != null && (
          <div>
            <div className="row" style={{ marginBottom: 6 }}>
              <p className="meta">Session accuracy</p>
              <strong style={{ fontSize: 13 }}>{accuracy}%</strong>
            </div>
            <div className="progress"><span style={{ width: `${accuracy}%` }} /></div>
          </div>
        )}

        {summary && (
          <div className="stack">
            <h4 style={{ margin: 0 }}>Mastery overview</h4>
            {(summary.skills || summary.skill_states || []).slice(0, 5).map((s: any, i: number) => {
              const pct = Math.round((s.mastery_probability ?? s.p_mastery ?? 0) * 100)
              return (
                <div key={i}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <p className="meta">{s.skill_name || `Skill ${s.skill_id || i + 1}`}</p>
                    <span style={{ fontSize: 12 }}>{pct}%</span>
                  </div>
                  <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </div>
        )}

        <div className="list-item">
          <p className="meta">Student</p>
          <strong>{user?.full_name || user?.username || '—'}</strong>
        </div>
      </aside>
    </div>
  )
}
