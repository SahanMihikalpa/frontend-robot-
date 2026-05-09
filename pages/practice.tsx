import { useEffect, useMemo, useState } from 'react'
import { createInteraction, getCurrentUser, getNextQuestion, getMasterySummary } from '../lib/api'

type OptionMap = Record<string, string>

export default function PracticePage() {
  const [user, setUser] = useState<any>(null)
  const [questionPayload, setQuestionPayload] = useState<any>(null)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState('')

  async function loadNextQuestion() {
    setBusy(true)
    setError('')
    setFeedback('')
    try {
      const nextQuestion = await getNextQuestion({ strategy: 'bkt_zpd' })
      setQuestionPayload(nextQuestion)
      setSelectedAnswer('')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to load the next question')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    async function initPractice() {
      try {
        const profile = await getCurrentUser()
        setUser(profile)
        if (profile?.id) {
          const mastery = await getMasterySummary(profile.id)
          setSummary(mastery)
        }
      } catch {
        setError('Unable to load your profile')
      }
      await loadNextQuestion()
    }

    initPractice()
  }, [])

  const question = questionPayload?.question || questionPayload
  const options = (question?.options || {}) as OptionMap
  const optionEntries = useMemo(() => Object.entries(options), [options])

  async function submitAnswer() {
    if (!question?.id || !question?.skill_id || !selectedAnswer) {
      return
    }

    setBusy(true)
    setError('')

    try {
      const isCorrect = selectedAnswer === (question.correct_answer || question?.answer)
      const result = await createInteraction({
        question_id: question.id,
        skill_id: question.skill_id,
        is_correct: isCorrect,
        time_taken: 0,
        session_id: `practice-${Date.now()}`,
      })

      setFeedback(isCorrect ? 'Correct answer recorded.' : 'Answer recorded. Keep going.')
      if (result?.bkt) {
        setSummary((previous: any) => previous ? previous : result.bkt)
      }
      await loadNextQuestion()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to submit your answer')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="grid-two">
        <section className="card stack">
          <div className="section-title">
            <div>
              <h2>Practice</h2>
              <p className="meta">Adaptive questions from the DKT/BKT pipeline.</p>
            </div>
            <span className="badge">Student mode</span>
          </div>

          {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
          {feedback && <p style={{ color: '#86efac' }}>{feedback}</p>}

          <div className="list-item">
            <p className="meta">Question</p>
            <h3 style={{ marginTop: 6 }}>{question?.question_text || 'Loading next question...'}</h3>
            <p className="meta">Skill: {question?.skill_name || question?.skill_id || 'Unknown'}</p>
          </div>

          <div className="list">
            {optionEntries.length > 0 ? optionEntries.map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={`list-item ${selectedAnswer === key ? 'chip active' : 'chip'}`}
                onClick={() => setSelectedAnswer(key)}
                style={{ textAlign: 'left' }}
              >
                <strong>{key}.</strong> {value}
              </button>
            )) : (
              <p className="meta">No options available for this question.</p>
            )}
          </div>

          <div className="row">
            <button type="button" className="btn" onClick={submitAnswer} disabled={busy || !selectedAnswer}>
              {busy ? 'Submitting...' : 'Submit answer'}
            </button>
            <button type="button" className="btn secondary" onClick={loadNextQuestion} disabled={busy}>
              Next question
            </button>
          </div>
        </section>

        <aside className="card stack">
          <div className="section-title">
            <h3>Session status</h3>
            <span className="badge">Live</span>
          </div>
          <div className="list-item">
            <p className="meta">Student</p>
            <strong>{user?.full_name || user?.username || 'Guest'}</strong>
          </div>
          <div className="list-item">
            <p className="meta">Mastery summary</p>
            <pre>{JSON.stringify(summary, null, 2)}</pre>
          </div>
        </aside>
      </div>
    </div>
  )
}