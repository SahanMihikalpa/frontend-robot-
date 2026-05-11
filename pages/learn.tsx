import { useEffect, useRef, useState } from 'react'
import {
  getCurrentUser, listSkills, getMasterySummary,
  startChatSession, sendChatMessage, endChatSession,
  analyzeVisualEngagement,
} from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type MsgRole = 'system' | 'student'
type MsgType = 'PRACTICE_QUESTION' | 'FEEDBACK' | 'EXPLANATION' | 'HINT' | 'DIALOGUE' | 'ANSWER' | 'QUESTION' | 'SUMMARY'

type ChatMsg = {
  id: string
  role: MsgRole
  type: MsgType
  content: string
  options?: Record<string, string>
  selectedAnswer?: string
  isCorrect?: boolean
  masteryBefore?: number
  masteryAfter?: number
  timestamp: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function extractOptions(raw: any): Record<string, string> | undefined {
  const opts = raw?.options || raw?.choices
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return undefined
  return opts as Record<string, string>
}

function parseNextMsg(raw: any): Partial<ChatMsg> | null {
  if (!raw) return null
  const content = raw.content || raw.text || raw.message || raw.question_text || ''
  if (!content) return null
  const type: MsgType = raw.type || raw.message_type || 'DIALOGUE'
  return { type, content, options: extractOptions(raw) }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MasteryBar({ pct, label }: { pct: number; label?: string }) {
  const clamped = Math.min(pct, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label && <span className="meta" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{label}</span>}
      <div className="progress" style={{ flex: 1, height: 7 }}>
        <span style={{ width: `${clamped}%` }} />
      </div>
      <span style={{ fontSize: 12, minWidth: 32, textAlign: 'right' }}>{clamped.toFixed(0)}%</span>
    </div>
  )
}

function MCOptions({
  options, disabled, selected, correct, onSelect,
}: {
  options: Record<string, string>
  disabled: boolean
  selected?: string
  correct?: string
  onSelect: (k: string) => void
}) {
  return (
    <div className="stack" style={{ gap: 6, marginTop: 10 }}>
      {Object.entries(options).map(([k, v]) => {
        let border = '1px solid rgba(255,255,255,0.1)'
        let bg = 'rgba(255,255,255,0.02)'
        let color = '#e2e8f0'
        if (disabled && selected) {
          if (k === correct) { border = '1px solid #4ade80'; bg = 'rgba(74,222,128,0.12)'; color = '#4ade80' }
          else if (k === selected && k !== correct) { border = '1px solid #f87171'; bg = 'rgba(248,113,113,0.12)'; color = '#f87171' }
          else { color = '#475569' }
        } else if (k === selected) {
          border = '1px solid var(--accent)'; bg = 'rgba(14,165,233,0.12)'
        }
        return (
          <button
            key={k}
            type="button"
            onClick={() => !disabled && onSelect(k)}
            disabled={disabled}
            style={{
              textAlign: 'left', width: '100%', padding: '9px 14px',
              borderRadius: 8, border, background: bg, color,
              cursor: disabled ? 'default' : 'pointer', fontSize: 14,
              transition: 'all 0.15s',
            }}
          >
            <strong>{k}.</strong> {v}
          </button>
        )
      })}
    </div>
  )
}

function Bubble({ msg, onAnswer, pendingAnswer }: {
  msg: ChatMsg
  onAnswer?: (key: string) => void
  pendingAnswer?: boolean
}) {
  const isStudent = msg.role === 'student'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isStudent ? 'flex-end' : 'flex-start', gap: 4 }}>
      <span className="meta" style={{ fontSize: 11, marginBottom: 2 }}>
        {isStudent ? 'You' : 'Learning AI'} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <div
        className={`chat-bubble ${isStudent ? 'user' : 'assistant'}`}
        style={{ maxWidth: '85%' }}
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.content}</p>

        {/* Mastery delta shown in feedback */}
        {msg.type === 'FEEDBACK' && msg.masteryBefore != null && msg.masteryAfter != null && (
          <div style={{ marginTop: 10 }}>
            <MasteryBar pct={msg.masteryAfter * 100} label="Mastery" />
            <p className="meta" style={{ fontSize: 11, marginTop: 4 }}>
              {msg.masteryBefore < msg.masteryAfter ? '↑' : '→'} {(msg.masteryBefore * 100).toFixed(0)}% → {(msg.masteryAfter * 100).toFixed(0)}%
            </p>
          </div>
        )}

        {/* Inline MC options */}
        {msg.type === 'PRACTICE_QUESTION' && msg.options && (
          <MCOptions
            options={msg.options}
            disabled={!!msg.selectedAnswer || !!pendingAnswer}
            selected={msg.selectedAnswer}
            correct={undefined}
            onSelect={(k) => onAnswer?.(k)}
          />
        )}

        {/* Answered state with colour */}
        {msg.type === 'ANSWER' && msg.isCorrect != null && (
          <span className={`badge ${msg.isCorrect ? 'success' : 'danger'}`} style={{ marginTop: 6, display: 'inline-flex' }}>
            {msg.isCorrect ? '✓ Correct' : '✗ Incorrect'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const [user, setUser] = useState<any>(null)
  const [skills, setSkills] = useState<any[]>([])
  const [selectedSkill, setSelectedSkill] = useState<number | null>(null)
  const [mastery, setMastery] = useState(0)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [pendingAnswer, setPendingAnswer] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Session timer
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Engagement
  const [engagementScore, setEngagementScore] = useState<number | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const capturingRef = useRef(false)
  const frameCountRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const userRef = useRef<any>(null)

  // Scroll anchor
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  // Track active question for answer lookup
  const activeQuestionRef = useRef<ChatMsg | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const u = await getCurrentUser()
        setUser(u)
        userRef.current = u
        const sk = await listSkills()
        setSkills(Array.isArray(sk) ? sk : sk?.items || [])
        if (u?.id) {
          const s = await getMasterySummary(u.id)
          const pct = Number(s?.mastered_pct || 0)
          setMastery(pct)
        }
      } catch { /* ignore */ }
    }
    init()
    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function cleanup() {
    stopEngagementCapture()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  // ─── Session ───────────────────────────────────────────────────────────────

  async function beginSession() {
    if (!selectedSkill || !user?.id) return
    setError('')
    setLoading(true)
    try {
      const res = await startChatSession({ skill_id: selectedSkill, user_id: user.id })
      const sid = res.session_id || res.id || `local-${Date.now()}`
      setSessionId(sid)
      sessionIdRef.current = sid
      setMessages([])
      setSessionEnded(false)
      setSummary(null)

      // Start timer
      setElapsed(0)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)

      // Add first message from backend
      const firstMsg = res.first_message || res.message || res
      addSystemMsg(firstMsg)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not start session. Make sure the backend chat endpoints are deployed.')
    } finally {
      setLoading(false)
    }
  }

  function addSystemMsg(raw: any) {
    const content = typeof raw === 'string' ? raw
      : raw?.content || raw?.text || raw?.message || raw?.question_text || ''
    if (!content) return
    const type: MsgType = raw?.type || raw?.message_type || 'DIALOGUE'
    const msg: ChatMsg = {
      id: uid(), role: 'system', type, content,
      options: extractOptions(raw),
      timestamp: Date.now(),
    }
    setMessages((prev) => {
      if (type === 'PRACTICE_QUESTION') activeQuestionRef.current = msg
      return [...prev, msg]
    })
  }

  // ─── Sending messages ──────────────────────────────────────────────────────

  async function handleAnswer(key: string) {
    if (!sessionId || pendingAnswer) return
    const q = activeQuestionRef.current
    setPendingAnswer(true)
    setError('')

    // Mark the question bubble as answered
    setMessages((prev) => prev.map((m) =>
      m.id === q?.id ? { ...m, selectedAnswer: key } : m
    ))

    // Add student answer bubble
    const studentMsg: ChatMsg = {
      id: uid(), role: 'student', type: 'ANSWER',
      content: q?.options?.[key] ? `${key}. ${q.options[key]}` : key,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, studentMsg])

    try {
      const res = await sendChatMessage({
        session_id: sessionId,
        message_type: 'ANSWER',
        content: key,
        response_time_ms: 0,
        engagement_data: engagementScore != null ? { engagement_score: engagementScore } : undefined,
      })

      // Mark correctness on student bubble
      const correct = res?.is_correct ?? res?.correct ?? null
      setMessages((prev) => prev.map((m) =>
        m.id === studentMsg.id ? { ...m, isCorrect: correct ?? undefined } : m
      ))

      // Feedback message
      if (res?.feedback_message || res?.feedback) {
        const fContent = res.feedback_message || res.feedback
        const fm: ChatMsg = {
          id: uid(), role: 'system', type: 'FEEDBACK',
          content: typeof fContent === 'string' ? fContent : JSON.stringify(fContent),
          masteryBefore: res?.mastery_before,
          masteryAfter: res?.mastery_after,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, fm])
        if (res?.mastery_after != null) setMastery(res.mastery_after * 100)
      }

      // Next message
      const next = res?.next_system_message || res?.next_message || res?.question
      if (next) addSystemMsg(next)

    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
        : typeof detail === 'string' ? detail : 'Failed to submit answer')
    } finally {
      setPendingAnswer(false)
    }
  }

  async function handleSend() {
    const q = input.trim()
    if (!q || !sessionId || loading) return
    setInput('')
    setError('')

    const isHint = /hint/i.test(q)
    const msgType: 'QUESTION' | 'HINT_REQUEST' = isHint ? 'HINT_REQUEST' : 'QUESTION'

    setMessages((prev) => [...prev, {
      id: uid(), role: 'student', type: 'QUESTION',
      content: q, timestamp: Date.now(),
    }])
    setLoading(true)

    try {
      const res = await sendChatMessage({
        session_id: sessionId,
        message_type: msgType,
        content: q,
      })

      const explanation = res?.explanation_message || res?.hint_message || res?.response || res?.answer || res?.message || ''
      if (explanation && typeof explanation === 'string') {
        setMessages((prev) => [...prev, {
          id: uid(), role: 'system',
          type: isHint ? 'HINT' : 'EXPLANATION',
          content: explanation, timestamp: Date.now(),
        }])
      }

      const next = res?.next_system_message || res?.next_message || res?.question
      if (next) addSystemMsg(next)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
        : typeof detail === 'string' ? detail : 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  async function handleEndSession() {
    if (!sessionId) return
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    stopEngagementCapture()
    try {
      const res = await endChatSession(sessionId)
      setSummary(res)
    } catch { setSummary({ session_id: sessionId, time_elapsed: elapsed }) }
    setSessionEnded(true)
  }

  function handleHintBtn() {
    const q = activeQuestionRef.current
    if (!q) return
    setInput('Give me a hint for this question')
  }

  // ─── Engagement capture ────────────────────────────────────────────────────

  async function startEngagementCapture() {
    if (!navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      capturingRef.current = true
      setCameraOn(true)
      engagementLoop()
    } catch { /* camera optional */ }
  }

  function stopEngagementCapture() {
    capturingRef.current = false
    setCameraOn(false)
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function engagementLoop() {
    if (!capturingRef.current) return
    frameCountRef.current++
    // Send every ~5 seconds (150 RAF frames at 30fps)
    if (frameCountRef.current % 150 === 0 && videoRef.current) {
      const v = videoRef.current
      const w = v.videoWidth || 320
      const h = v.videoHeight || 240
      if (!canvasRef.current) { const c = document.createElement('canvas'); c.width = w; c.height = h; canvasRef.current = c }
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.drawImage(v, 0, 0, w, h)
        const b64 = canvasRef.current.toDataURL('image/jpeg', 0.6).replace(/^data:image\/(png|jpeg);base64,/, '')
        analyzeVisualEngagement({
          user_id: userRef.current?.id || 0,
          session_id: sessionIdRef.current || 'learn',
          frame_data: b64,
        }).then((r) => {
          const score = r?.engagement_score ?? r?.attention_score ?? r?.visual_engagement_score
          if (typeof score === 'number') setEngagementScore(score)
        }).catch(() => {})
      }
    }
    rafRef.current = requestAnimationFrame(engagementLoop)
  }

  // ─── Skill picker ──────────────────────────────────────────────────────────

  if (!sessionId && !sessionEnded) {
    return (
      <div className="grid-two" style={{ alignItems: 'start' }}>
        <section className="card stack">
          <div>
            <h2>Learning Chat</h2>
            <p className="meta">Practice and ask questions in a single unified conversation. The AI tutor guides you through questions and explanations.</p>
          </div>

          <div className="stack">
            <h4 style={{ margin: 0 }}>Choose a topic to start</h4>
            {skills.length === 0 ? (
              <p className="meta">Loading skills…</p>
            ) : (
              <div className="chip-row">
                {skills.map((s: any) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`chip ${selectedSkill === s.id ? 'active' : ''}`}
                    onClick={() => setSelectedSkill(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              disabled={!selectedSkill || loading}
              onClick={beginSession}
            >
              {loading ? 'Starting…' : 'Start learning session'}
            </button>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={cameraOn} onChange={(e) => e.target.checked ? startEngagementCapture() : stopEngagementCapture()} />
              Enable engagement camera
            </label>
          </div>

          {error && <p className="feedback error">{error}</p>}

          {/* Hidden video for engagement */}
          <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
        </section>

        <aside className="card stack">
          <h3 style={{ margin: 0 }}>How it works</h3>
          <div className="list">
            <div className="list-item">
              <strong>1. Pick a topic</strong>
              <p className="meta" style={{ marginTop: 4 }}>Select a skill from the list. The AI will choose the right question difficulty for you.</p>
            </div>
            <div className="list-item">
              <strong>2. Answer questions</strong>
              <p className="meta" style={{ marginTop: 4 }}>Click an option to answer. Get instant feedback with mastery updates.</p>
            </div>
            <div className="list-item">
              <strong>3. Ask anything</strong>
              <p className="meta" style={{ marginTop: 4 }}>Type a question or "Give me a hint" anytime. The tutor explains inline without losing your place.</p>
            </div>
            <div className="list-item">
              <strong>4. End and review</strong>
              <p className="meta" style={{ marginTop: 4 }}>End the session to see your accuracy, mastery change, and time spent.</p>
            </div>
          </div>
          {mastery > 0 && (
            <div>
              <p className="meta" style={{ marginBottom: 6 }}>Current overall mastery</p>
              <MasteryBar pct={mastery} />
            </div>
          )}
        </aside>
      </div>
    )
  }

  // ─── Session summary ───────────────────────────────────────────────────────

  if (sessionEnded && summary) {
    const acc = summary.accuracy_pct != null ? summary.accuracy_pct
      : summary.accuracy != null ? summary.accuracy : null
    return (
      <div className="stack" style={{ maxWidth: 600, margin: '0 auto' }}>
        <section className="card stack" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <h2 style={{ margin: 0 }}>Session complete!</h2>
          <p className="meta">Great work. Here's your session summary.</p>
        </section>

        <section className="card stack">
          <div className="kpi-grid">
            <div className="kpi-card">
              <p className="kpi-label">Questions</p>
              <p className="kpi-value">{summary.practice_questions ?? summary.total_questions ?? '—'}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Accuracy</p>
              <p className="kpi-value" style={{ color: '#4ade80' }}>
                {acc != null ? `${typeof acc === 'number' && acc <= 1 ? Math.round(acc * 100) : Math.round(acc)}%` : '—'}
              </p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Time</p>
              <p className="kpi-value">{fmtTime(summary.time_elapsed ?? elapsed)}</p>
            </div>
          </div>

          {summary.mastery_start != null && summary.mastery_end != null && (
            <div>
              <div className="row" style={{ marginBottom: 6 }}>
                <p className="meta">Mastery progress</p>
                <span className="meta">
                  {(summary.mastery_start * 100).toFixed(0)}% → {(summary.mastery_end * 100).toFixed(0)}%
                </span>
              </div>
              <MasteryBar pct={summary.mastery_end * 100} />
            </div>
          )}

          {summary.avg_engagement != null && (
            <div className="list-item">
              <p className="meta">Avg engagement</p>
              <strong>{(summary.avg_engagement * 100).toFixed(0)}%</strong>
            </div>
          )}
        </section>

        <div className="row">
          <button type="button" className="btn" onClick={() => { setSessionId(null); setSessionEnded(false); setSummary(null); setMessages([]) }}>
            Start new session
          </button>
          <button type="button" className="btn secondary" onClick={() => window.location.href = '/dashboard/student'}>
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  // ─── Active chat ───────────────────────────────────────────────────────────

  const lastQuestion = [...messages].reverse().find((m) => m.type === 'PRACTICE_QUESTION')
  const questionAnswered = lastQuestion ? !!lastQuestion.selectedAnswer : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 140px)', minHeight: 500 }}>
      {/* Metrics bar */}
      <div className="card" style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', align: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="meta" style={{ fontSize: 12 }}>
              ⏱ <strong>{fmtTime(elapsed)}</strong>
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 160 }}>
              <span className="meta" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Mastery</span>
              <MasteryBar pct={mastery} />
            </div>
            {engagementScore != null && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 140 }}>
                <span className="meta" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Engagement</span>
                <MasteryBar pct={engagementScore * 100} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {cameraOn ? (
              <span className="badge success" style={{ fontSize: 11 }}>👁 Camera on</span>
            ) : (
              <button type="button" className="btn small secondary" onClick={startEngagementCapture}>
                Enable camera
              </button>
            )}
            <button type="button" className="btn small danger" onClick={handleEndSession}>
              End session
            </button>
          </div>
        </div>
      </div>

      {/* Chat thread */}
      <div
        ref={chatRef}
        className="card chat-messages"
        style={{
          flex: 1, overflowY: 'auto', gap: 14,
          padding: '16px 20px', minHeight: 0,
        }}
      >
        {messages.length === 0 && (
          <div className="empty-state"><p className="meta">Your conversation will appear here…</p></div>
        )}
        {messages.map((msg) => (
          <Bubble
            key={msg.id}
            msg={msg}
            pendingAnswer={pendingAnswer}
            onAnswer={msg.type === 'PRACTICE_QUESTION' && !msg.selectedAnswer ? handleAnswer : undefined}
          />
        ))}
        {(loading || pendingAnswer) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="chat-bubble assistant" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="feedback error" style={{ margin: 0 }}>{error}</p>}

      {/* Input area */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={questionAnswered ? 'Ask a question or wait for the next one…' : 'Ask for an explanation, a hint, or type your question…'}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            style={{ flex: 1, resize: 'none', fontSize: 14 }}
            disabled={loading || pendingAnswer}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              className="btn small"
              onClick={handleSend}
              disabled={!input.trim() || loading || pendingAnswer}
            >
              Send
            </button>
            <button
              type="button"
              className="btn small secondary"
              onClick={handleHintBtn}
              disabled={!lastQuestion || questionAnswered || loading}
            >
              Hint
            </button>
          </div>
        </div>
        <p className="meta" style={{ fontSize: 11, marginTop: 6 }}>
          Click an answer option above · Enter to send · Type "hint" or click Hint for help
        </p>
      </div>

      {/* Hidden video element for engagement */}
      <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
    </div>
  )
}
