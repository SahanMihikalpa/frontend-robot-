import { useEffect, useRef, useState } from 'react'
import {
  getCurrentUser, listSkills, getMasterySummary,
  startChatSession, sendChatMessage, endChatSession,
  analyzeVisualEngagement, getAuthToken,
  getSessionStatus, getAssessmentQuestions, completeAssessment,
} from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type MsgRole = 'system' | 'student'
type MsgType = 'PRACTICE_QUESTION' | 'FEEDBACK' | 'EXPLANATION' | 'HINT' | 'DIALOGUE' | 'ANSWER' | 'QUESTION' | 'SUMMARY' | 'SESSION_RESUMED' | 'SESSION_START'
type VoiceState = 'idle' | 'recording' | 'processing'
type Phase = 'skill-pick' | 'assessment' | 'session'

type SkillStatus = {
  has_active_session: boolean
  session_id: string | null
  assessment_done: boolean
  mastery: number | null
  message_count: number
}

type AssessmentQ = {
  question_id: number
  question_text: string
  options: Record<string, string> | null
  correct_answer: string
  difficulty: number | null
}

type AssessmentAnswer = {
  question_id: number
  answer: string
  is_correct: boolean
  time_taken: number
}

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
  imageUrl?: string        // data: URL for a Gemini-generated infographic
  imageError?: string      // set when a visual was requested but generation failed
  timestamp: number
}

/** Build a displayable data: URL from a base64 image payload in message metadata. */
function extractImageUrl(meta: any): string | undefined {
  const b64 = meta?.image_b64
  if (!b64 || typeof b64 !== 'string') return undefined
  const mime = meta?.image_mime || 'image/png'
  return b64.startsWith('data:') ? b64 : `data:${mime};base64,${b64}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }

/** Safely coerce any value to a plain string — never lets an object reach JSX */
function safeStr(v: any): string {
  if (typeof v === 'string') return v
  if (v == null) return ''
  if (typeof v === 'object') return (v.text || v.content || v.label || v.key || JSON.stringify(v)) as string
  return String(v)
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function extractOptions(raw: any): Record<string, string> | undefined {
  const opts = raw?.metadata?.options || raw?.options || raw?.choices || raw?.answer_options || raw?.mc_options
  if (!opts) return undefined
  if (Array.isArray(opts)) {
    if (opts.length === 0) return undefined
    const result: Record<string, string> = {}
    const keys = ['A', 'B', 'C', 'D', 'E']
    opts.forEach((item: any, i: number) => {
      const key = item?.key || keys[i] || String.fromCharCode(65 + i)
      result[key] = typeof item === 'string' ? item : item?.text || item?.label || item?.value || String(item)
    })
    return result
  }
  if (typeof opts !== 'object') return undefined
  return opts as Record<string, string>
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MasteryBar({ pct, label }: { pct: number; label?: string }) {
  const clamped = Math.min(pct, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label && <span className="meta" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{label}</span>}
      <div className="progress" style={{ flex: 1, height: 6 }}>
        <span style={{ width: `${clamped}%` }} />
      </div>
      <span style={{ fontSize: 12, minWidth: 32, textAlign: 'right' }}>{clamped.toFixed(0)}%</span>
    </div>
  )
}

// Left panel — current question card
function QuestionPanel({
  question,
  pendingAnswer,
  answerCorrect,
  onAnswer,
  onHint,
  onEnd,
  elapsed,
  mastery,
  engagementScore,
  cameraOn,
  onEnableCamera,
  onDisableCamera,
  skillName,
}: {
  question: ChatMsg | null
  pendingAnswer: boolean
  answerCorrect: boolean | null
  onAnswer: (key: string) => void
  onHint: () => void
  onEnd: () => void
  elapsed: number
  mastery: number
  engagementScore: number | null
  cameraOn: boolean
  onEnableCamera: () => void
  onDisableCamera: () => void
  skillName: string
}) {
  const answered = !!question?.selectedAnswer

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Skill + metrics row */}
      <div className="card" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span className="badge neutral" style={{ fontSize: 12 }}>{skillName || 'Learning session'}</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="meta" style={{ fontSize: 12 }}>⏱ <strong>{fmtTime(elapsed)}</strong></span>
            {!cameraOn && (
              <button type="button" className="btn small secondary" onClick={onEnableCamera} style={{ fontSize: 11 }} title="Enable camera engagement tracking">
                👁 Camera off
              </button>
            )}
            {cameraOn && (
              <button type="button" className="btn small secondary" onClick={onDisableCamera} style={{ fontSize: 11, color: '#4ade80' }} title="Camera tracking active — click to disable">
                👁 On
              </button>
            )}
            <button type="button" className="btn small secondary" onClick={onEnd} style={{ fontSize: 12 }}>
              ← Exit
            </button>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <MasteryBar pct={mastery} label="Mastery" />
        </div>
        {engagementScore != null && (
          <div style={{ marginTop: 6 }}>
            <MasteryBar pct={engagementScore * 100} label="Engagement" />
          </div>
        )}
      </div>

      {/* Question display */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 18px', overflowY: 'auto' }}>
        {!question ? (
          <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
              <p className="meta">Waiting for the next question…</p>
            </div>
          </div>
        ) : (
          <>
            <div>
              <span className="badge neutral" style={{ fontSize: 11, marginBottom: 10, display: 'inline-block' }}>
                Practice Question
              </span>
              <p style={{ fontSize: 16, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
                {question.content}
              </p>
            </div>

            {question.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(question.options).map(([k, v]) => {
                  let border = '1px solid rgba(255,255,255,0.1)'
                  let bg = 'rgba(255,255,255,0.03)'
                  let color = '#e2e8f0'
                  if (answered && k === question.selectedAnswer) {
                    if (answerCorrect === true) {
                      border = '1px solid #4ade80'
                      bg = 'rgba(74,222,128,0.15)'
                      color = '#4ade80'
                    } else if (answerCorrect === false) {
                      border = '1px solid #f87171'
                      bg = 'rgba(248,113,113,0.15)'
                      color = '#f87171'
                    } else {
                      border = '1px solid var(--accent)'
                      bg = 'rgba(14,165,233,0.12)'
                      color = 'var(--accent)'
                    }
                  } else if (answered) {
                    color = '#475569'
                  }
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => !answered && !pendingAnswer && onAnswer(k)}
                      disabled={answered || pendingAnswer}
                      style={{
                        textAlign: 'left', width: '100%', padding: '12px 16px',
                        borderRadius: 10, border, background: bg, color,
                        cursor: answered || pendingAnswer ? 'default' : 'pointer',
                        fontSize: 14, lineHeight: 1.5, transition: 'all 0.15s',
                      }}
                    >
                      <strong style={{ marginRight: 8, opacity: 0.7 }}>{k}.</strong>{safeStr(v)}
                    </button>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              {/* <button
                type="button"
                className="btn small secondary"
                onClick={onHint}
                disabled={answered || pendingAnswer}
              >
                💡 Hint
              </button> */}
              {answered && (
                <span
                  className={`badge ${answerCorrect === true ? 'success' : answerCorrect === false ? 'danger' : 'neutral'}`}
                  style={{ fontSize: 12, alignSelf: 'center' }}
                >
                  {answerCorrect === true ? '✓ Correct! Next question loading…' : answerCorrect === false ? '✗ Wrong — next question loading…' : 'Submitted…'}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Right panel — chat bubbles
function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isStudent = msg.role === 'student'

  let bubbleStyle: React.CSSProperties = {}
  if (msg.type === 'FEEDBACK') {
    bubbleStyle = {
      background: msg.isCorrect ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
      border: `1px solid ${msg.isCorrect ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isStudent ? 'flex-end' : 'flex-start', gap: 3 }}>
      <span className="meta" style={{ fontSize: 11 }}>
        {isStudent ? 'You' : 'Tutor AI'} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <div
        className={`chat-bubble ${isStudent ? 'user' : 'assistant'}`}
        style={{ maxWidth: '88%', ...bubbleStyle }}
      >
        {msg.type === 'FEEDBACK' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>{msg.isCorrect ? '✅' : '❌'}</span>
            <strong style={{ color: msg.isCorrect ? '#4ade80' : '#f87171', fontSize: 13 }}>
              {msg.isCorrect ? 'Correct!' : 'Not quite'}
            </strong>
          </div>
        )}
        {msg.type === 'HINT' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>💡</span>
            <strong style={{ fontSize: 12, color: '#fbbf24' }}>Hint</strong>
          </div>
        )}

        <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>
          {msg.type === 'FEEDBACK'
            ? safeStr(msg.content).replace(/^[✅❌]\s*(Correct!|Not quite\.?)\s*/i, '').trim() || safeStr(msg.content)
            : safeStr(msg.content)}
        </p>

        {msg.imageUrl && (
          <div style={{ marginTop: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.imageUrl}
              alt="AI-generated infographic"
              style={{ maxWidth: '100%', borderRadius: 10, display: 'block', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <span className="meta" style={{ fontSize: 10, marginTop: 4, display: 'block' }}>
              🖼️ Visual generated by Gemini
            </span>
          </div>
        )}

        {!msg.imageUrl && msg.imageError && (
          <p className="meta" style={{ fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
            🖼️ Couldn’t generate a visual for this one.
          </p>
        )}

        {msg.type === 'FEEDBACK' && msg.masteryAfter != null && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <MasteryBar pct={msg.masteryAfter * 100} label="Mastery" />
            {msg.masteryBefore != null && (
              <p className="meta" style={{ fontSize: 11, marginTop: 3 }}>
                {msg.masteryBefore < msg.masteryAfter ? '↑' : '→'} {(msg.masteryBefore * 100).toFixed(0)}% → {(msg.masteryAfter * 100).toFixed(0)}%
              </p>
            )}
          </div>
        )}

        {msg.type === 'ANSWER' && msg.isCorrect != null && (
          <span className={`badge ${msg.isCorrect ? 'success' : 'danger'}`} style={{ marginTop: 6, display: 'inline-flex', fontSize: 11 }}>
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
  const [phase, setPhase] = useState<Phase>('skill-pick')

  // Session-status per skill (fetched when skill is selected)
  const [skillStatus, setSkillStatus] = useState<SkillStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  // Assessment state
  const [assessmentQs, setAssessmentQs] = useState<AssessmentQ[]>([])
  const [assessmentIdx, setAssessmentIdx] = useState(0)
  const [assessmentAnswers, setAssessmentAnswers] = useState<AssessmentAnswer[]>([])
  const [assessmentSelected, setAssessmentSelected] = useState<string | null>(null)
  const [assessmentFeedback, setAssessmentFeedback] = useState<boolean | null>(null)
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false)
  const assessmentStartRef = useRef<number>(Date.now())

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [pendingAnswer, setPendingAnswer] = useState(false)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [engagementScore, setEngagementScore] = useState<number | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const engagementIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const capturingRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)
  const userRef = useRef<any>(null)

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const activeQuestionRef = useRef<ChatMsg | null>(null)

  // ─── Voice pipeline state ─────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceStreamText, setVoiceStreamText] = useState('')
  const voiceWsRef = useRef<WebSocket | null>(null)
  const voiceRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceMicStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<ArrayBuffer[]>([])
  const audioPlayingRef = useRef(false)

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
          setMastery(Number(s?.mastered_pct || 0))
        }
      } catch { /* ignore */ }
    }
    init()
    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function cleanup() {
    stopEngagementCapture()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  // ─── Skill select → fetch status ──────────────────────────────────────────

  async function handleSkillSelect(skillId: number) {
    setSelectedSkill(skillId)
    setSkillStatus(null)
    setError('')
    if (!user?.id) return
    setStatusLoading(true)
    try {
      const status = await getSessionStatus(skillId)
      setSkillStatus(status)
      if (status.mastery != null) setMastery(status.mastery * 100)
    } catch {
      setSkillStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }

  // ─── Assessment flow ───────────────────────────────────────────────────────

  async function startAssessment() {
    if (!selectedSkill) return
    setError('')
    setLoading(true)
    try {
      const data = await getAssessmentQuestions(selectedSkill)
      if (!data.questions || data.questions.length === 0) {
        // No questions available — skip assessment, go straight to session
        await beginSession(true)
        return
      }
      setAssessmentQs(data.questions)
      setAssessmentIdx(0)
      setAssessmentAnswers([])
      setAssessmentSelected(null)
      setAssessmentFeedback(null)
      assessmentStartRef.current = Date.now()
      setPhase('assessment')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load assessment.')
    } finally {
      setLoading(false)
    }
  }

  function handleAssessmentAnswer(key: string) {
    if (assessmentSelected || assessmentSubmitting) return
    const q = assessmentQs[assessmentIdx]
    const correct = key === q.correct_answer
    setAssessmentSelected(key)
    setAssessmentFeedback(correct)
  }

  async function handleAssessmentNext() {
    const q = assessmentQs[assessmentIdx]
    const timeTaken = (Date.now() - assessmentStartRef.current) / 1000
    const newAnswers: AssessmentAnswer[] = [
      ...assessmentAnswers,
      {
        question_id: q.question_id,
        answer: assessmentSelected!,
        is_correct: assessmentFeedback!,
        time_taken: timeTaken,
      },
    ]
    setAssessmentAnswers(newAnswers)
    assessmentStartRef.current = Date.now()

    if (assessmentIdx + 1 < assessmentQs.length) {
      setAssessmentIdx((i) => i + 1)
      setAssessmentSelected(null)
      setAssessmentFeedback(null)
    } else {
      // All done → submit assessment
      setAssessmentSubmitting(true)
      try {
        const result = await completeAssessment({ skill_id: selectedSkill!, answers: newAnswers })
        setMastery(result.mastery * 100)
        // Update local status
        setSkillStatus((s) => s ? { ...s, assessment_done: true, mastery: result.mastery } : s)
      } catch { /* non-fatal */ }
      setAssessmentSubmitting(false)
      await beginSession(false)
    }
  }

  // ─── Session start / resume ────────────────────────────────────────────────

  async function beginSession(skipAssessment = false) {
    if (!selectedSkill || !user?.id) return
    setError('')
    setLoading(true)
    try {
      const res = await startChatSession({ skill_id: selectedSkill, user_id: user.id })
      const sid = res.session_id || res.id || `local-${Date.now()}`
      setSessionId(sid)
      sessionIdRef.current = sid
      setSessionEnded(false)
      setSummary(null)
      setElapsed(0)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)

      if (res.resumed) {
        // Restore previous session messages
        const rawHistory = Array.isArray(res.history) ? res.history : []
        const restored: ChatMsg[] = rawHistory.map((m: any) => {
          const role: MsgRole = m.sender === 'STUDENT' ? 'student' : 'system'
          const rawType = m.message_type as MsgType
          // extractOptions already handles {key,text} array items → safe string values
          const options = extractOptions(m)
          // Safe content extraction — DB can store ANSWER content as {key, text} object
          const content: string = safeStr(m.content)
          return {
            id: uid(),
            role,
            type: options ? 'PRACTICE_QUESTION' : rawType,
            content,
            options,
            isCorrect: m.metadata?.is_correct,
            masteryBefore: m.metadata?.mastery_before,
            masteryAfter: m.metadata?.mastery_after,
            imageUrl: extractImageUrl(m.metadata),
            imageError: m.metadata?.image_error,
            timestamp: new Date(m.created_at).getTime(),
          }
        })
        // Prepend a SESSION_RESUMED notice to the chat
        const resumeNotice: ChatMsg = {
          id: uid(), role: 'system', type: 'SESSION_RESUMED',
          content: '▶️ Welcome back! Continuing your previous session.',
          timestamp: Date.now(),
        }
        setMessages([resumeNotice, ...restored])

        // Restore the active question ref so the student can answer it immediately
        const lastRestoredQ = restored.slice().reverse().find((m) => m.type === 'PRACTICE_QUESTION')
        if (lastRestoredQ) {
          activeQuestionRef.current = lastRestoredQ
          setLastAnswerCorrect(null)
        }
        // Restore mastery from BKT state returned from backend
        if (res.mastery_start != null) setMastery(res.mastery_start * 100)
      } else {
        setMessages([])
        const firstMsg = res.first_message || res.message || res
        addSystemMsg(firstMsg)
      }
      setPhase('session')
      // Auto-start camera engagement capture when session begins.
      // Runs silently — if the user denies camera permission the catch inside
      // startEngagementCapture swallows the error and cameraOn stays false.
      if (!capturingRef.current) {
        startEngagementCapture()
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not start session.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStartOrContinue() {
    if (!selectedSkill || !user?.id) return
    if (skillStatus?.has_active_session) {
      // Resume existing session
      await beginSession(true)
    } else if (!skillStatus?.assessment_done) {
      // New skill — show assessment first
      await startAssessment()
    } else {
      // Returning to skill, assessment already done — start fresh session
      await beginSession(true)
    }
  }

  function addSystemMsg(raw: any) {
    const content = typeof raw === 'string' ? raw
      : raw?.content || raw?.text || raw?.message || raw?.question_text || ''
    if (!content) return
    const options = extractOptions(raw)
    const rawType: MsgType = raw?.type || raw?.message_type || 'DIALOGUE'
    const type: MsgType = options ? 'PRACTICE_QUESTION' : rawType
    const msg: ChatMsg = { id: uid(), role: 'system', type, content, options, timestamp: Date.now() }
    setMessages((prev) => {
      if (type === 'PRACTICE_QUESTION') {
        activeQuestionRef.current = msg
        setLastAnswerCorrect(null)
      }
      return [...prev, msg]
    })
  }

  // ─── Answer ───────────────────────────────────────────────────────────────

  async function handleAnswer(key: string) {
    if (!sessionId || pendingAnswer) return
    const q = activeQuestionRef.current
    setPendingAnswer(true)
    setError('')

    setMessages((prev) => prev.map((m) => m.id === q?.id ? { ...m, selectedAnswer: key } : m))

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

      const feedbackRaw = res?.feedback_message || res?.feedback
      const feedbackObj = typeof feedbackRaw === 'object' && feedbackRaw !== null ? feedbackRaw : null
      const feedbackContent = feedbackObj?.content ?? (typeof feedbackRaw === 'string' ? feedbackRaw : null)
      const feedbackMeta = feedbackObj?.metadata ?? {}
      const isCorrect = feedbackMeta?.is_correct ?? res?.is_correct ?? res?.correct ?? null
      const masteryAfter = feedbackMeta?.mastery_after ?? res?.mastery_after ?? null
      const masteryBefore = feedbackMeta?.mastery_before ?? res?.mastery_before ?? null

      setMessages((prev) => prev.map((m) => m.id === studentMsg.id ? { ...m, isCorrect: isCorrect ?? undefined } : m))

      if (isCorrect != null) setLastAnswerCorrect(isCorrect)

      if (feedbackContent && masteryAfter != null) {
        setMastery(masteryAfter * 100)
      }

      const next = res?.next_system_message || res?.next_message || res?.question
      if (next) {
        setTimeout(() => addSystemMsg(next), 1500)
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
        : typeof detail === 'string' ? detail : 'Failed to submit answer')
    } finally {
      setPendingAnswer(false)
    }
  }

  // ─── Chat send ────────────────────────────────────────────────────────────

  async function handleSend() {
    const q = input.trim()
    if (!q || !sessionId || loading) return
    setInput('')
    setError('')
    const isHint = /hint/i.test(q)
    const msgType: 'QUESTION' | 'HINT_REQUEST' = isHint ? 'HINT_REQUEST' : 'QUESTION'
    setMessages((prev) => [...prev, { id: uid(), role: 'student', type: 'QUESTION', content: q, timestamp: Date.now() }])
    setLoading(true)
    try {
      const res = await sendChatMessage({ session_id: sessionId, message_type: msgType, content: q })
      const expRaw = res?.explanation_message || res?.hint_message || res?.response || res?.answer || res?.message
      const expContent = typeof expRaw === 'string' ? expRaw : expRaw?.content || null
      const expMeta = typeof expRaw === 'object' ? expRaw?.metadata : undefined
      const imageUrl = extractImageUrl(expMeta)
      if (expContent || imageUrl) {
        setMessages((prev) => [...prev, {
          id: uid(), role: 'system',
          type: isHint ? 'HINT' : 'EXPLANATION',
          content: expContent || '', timestamp: Date.now(),
          imageUrl,
          imageError: expMeta?.image_error,
        }])
      }
      const next = res?.next_system_message || res?.next_message || res?.question
      if (next) addSystemMsg(next)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
        : typeof detail === 'string' ? detail : 'Failed to send')
    } finally {
      setLoading(false)
    }
  }

  async function handleEndSession() {
    if (!sessionId) return
    // Stop local timers / camera — but do NOT close the session on the backend.
    // The session stays active (is_active=True) so the student can resume it later.
    // History is already persisted in the DB message-by-message.
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    stopEngagementCapture()
    // Exit to skill picker — keep session live in DB
    setSessionId(null)
    setMessages([])
    setSessionEnded(false)
    setSummary(null)
    setError('')
    setElapsed(0)
    setLastAnswerCorrect(null)
    // Refresh skill status so the "Continue Session" badge updates immediately
    if (selectedSkill && user?.id) {
      try {
        const status = await getSessionStatus(selectedSkill)
        setSkillStatus(status)
        if (status.mastery != null) setMastery(status.mastery * 100)
      } catch { /* non-fatal */ }
    }
    setPhase('skill-pick')
  }

  function handleHintBtn() {
    setInput('Give me a hint for this question')
  }

  // ─── Voice pipeline ───────────────────────────────────────────────────────

  function wsVoiceUrl(userId: number) {
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000')
      .replace(/^https/, 'wss').replace(/^http/, 'ws').replace(/\/$/, '')
    const token = getAuthToken()
    return `${base}/api/v1/voice/ws/${userId}?token=${token}`
  }

  async function playAudioChunk(b64: string) {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    audioQueueRef.current.push(bytes.buffer)
    if (!audioPlayingRef.current) drainAudioQueue()
  }

  async function drainAudioQueue() {
    if (audioQueueRef.current.length === 0) { audioPlayingRef.current = false; return }
    audioPlayingRef.current = true
    const buf = audioQueueRef.current.shift()!
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext()
      }
      const decoded = await audioCtxRef.current.decodeAudioData(buf.slice(0))
      const src = audioCtxRef.current.createBufferSource()
      src.buffer = decoded
      src.connect(audioCtxRef.current.destination)
      src.onended = () => drainAudioQueue()
      src.start()
    } catch {
      drainAudioQueue()
    }
  }

  function addVoiceMsg(role: MsgRole, type: MsgType, content: string) {
    setMessages((prev) => [...prev, { id: uid(), role, type, content, timestamp: Date.now() }])
  }

  async function startVoiceRecording() {
    if (!user?.id) return
    if (voiceState !== 'idle') return
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceMicStreamRef.current = micStream

      const ws = new WebSocket(wsVoiceUrl(user.id))
      voiceWsRef.current = ws

      ws.onopen = () => {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm'
        const recorder = new MediaRecorder(micStream, { mimeType })
        voiceRecorderRef.current = recorder
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data)
        }
        recorder.start(200)
        setVoiceState('recording')
        setVoiceStatus('')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string)
          switch (data.event) {
            case 'status':
              setVoiceStatus(data.message || '')
              break
            case 'transcript':
              setVoiceStreamText('')
              addVoiceMsg('student', 'QUESTION', data.text)
              break
            case 'llm_token':
              setVoiceStreamText((prev) => prev + (data.token || ''))
              break
            case 'llm_complete':
              setVoiceStreamText('')
              addVoiceMsg('system', 'EXPLANATION', data.full_response || '')
              break
            case 'audio':
              playAudioChunk(data.audio_base64)
              break
            case 'done':
              setVoiceState('idle')
              setVoiceStatus('')
              break
            case 'error':
              setVoiceState('idle')
              setVoiceStatus('')
              setError(`Voice error (${data.step}): ${data.message}`)
              break
            case 'cancelled':
              setVoiceState('idle')
              setVoiceStatus('')
              break
          }
        } catch { /* non-JSON frame */ }
      }

      ws.onerror = () => {
        setVoiceState('idle')
        setVoiceStatus('')
        setError('Voice connection error — check backend')
      }

      ws.onclose = () => {
        setVoiceState('idle')
        setVoiceStatus('')
      }
    } catch {
      setError('Microphone access denied')
    }
  }

  function stopVoiceRecording() {
    voiceRecorderRef.current?.stop()
    voiceMicStreamRef.current?.getTracks().forEach((t) => t.stop())
    voiceMicStreamRef.current = null
    setVoiceState('processing')
    setVoiceStatus('Processing…')
    if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
      voiceWsRef.current.send('STOP')
    }
  }

  function cancelVoiceRecording() {
    voiceRecorderRef.current?.stop()
    voiceMicStreamRef.current?.getTracks().forEach((t) => t.stop())
    voiceMicStreamRef.current = null
    if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
      voiceWsRef.current.send('CANCEL')
    }
    setVoiceState('idle')
    setVoiceStatus('')
  }

  // ─── Engagement ───────────────────────────────────────────────────────────

  async function startEngagementCapture() {
    if (!navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      capturingRef.current = true
      setCameraOn(true)
      // First capture after 2 s (camera warm-up), then every 10 s
      setTimeout(() => captureEngagementFrame(), 2000)
      engagementIntervalRef.current = setInterval(captureEngagementFrame, 10_000)
    } catch { /* camera permission denied — non-fatal */ }
  }

  function stopEngagementCapture() {
    capturingRef.current = false
    setCameraOn(false)
    if (engagementIntervalRef.current) { clearInterval(engagementIntervalRef.current); engagementIntervalRef.current = null }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function captureEngagementFrame() {
    if (!capturingRef.current || !videoRef.current) return
    const v = videoRef.current
    const w = v.videoWidth || 320
    const h = v.videoHeight || 240
    if (!canvasRef.current) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; canvasRef.current = c
    }
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0, w, h)
    const b64 = canvasRef.current.toDataURL('image/jpeg', 0.7).replace(/^data:image\/(png|jpeg);base64,/, '')
    analyzeVisualEngagement({
      user_id: userRef.current?.id || 0,
      session_id: sessionIdRef.current || 'learn',
      frame_data: b64,
    })
      .then((r) => {
        if (!r) return
        // backend returns visual_engagement_score; fallback to other field names
        const s = r.visual_engagement_score ?? r.engagement_score ?? r.attention_score
        if (typeof s === 'number') setEngagementScore(s)
      })
      .catch(() => { /* silent — engagement is optional */ })
  }

  // ─── Skill picker (before session) ────────────────────────────────────────

  // ─── Assessment phase UI ──────────────────────────────────────────────────
  if (phase === 'assessment' && assessmentQs.length > 0) {
    const q = assessmentQs[assessmentIdx]
    const total = assessmentQs.length
    const pct = Math.round(((assessmentIdx) / total) * 100)
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <section className="card stack">
          <div>
            <div className="row" style={{ marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>Initial Assessment</h2>
              <span className="badge neutral">{assessmentIdx + 1} / {total}</span>
            </div>
            <p className="meta">ඔබේ දැනුම් මට්ටම measure කිරීමට ප්‍රශ්න කිහිපයකට answer කරන්න.</p>
            <div className="progress" style={{ marginTop: 8 }}>
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div style={{ padding: '16px 0' }}>
            <p style={{ fontSize: 16, lineHeight: 1.7, fontWeight: 500 }}>{q.question_text}</p>
            {q.difficulty && (
              <span className="badge neutral" style={{ fontSize: 11, marginTop: 4, display: 'inline-block' }}>
                Difficulty {q.difficulty}
              </span>
            )}
          </div>

          {q.options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(q.options).map(([k, v]) => {
                let border = '1px solid rgba(255,255,255,0.1)'
                let bg = 'rgba(255,255,255,0.03)'
                let color = '#e2e8f0'
                if (assessmentSelected === k) {
                  if (assessmentFeedback === true)  { border = '1px solid #4ade80'; bg = 'rgba(74,222,128,0.15)'; color = '#4ade80' }
                  if (assessmentFeedback === false)  { border = '1px solid #f87171'; bg = 'rgba(248,113,113,0.15)'; color = '#f87171' }
                } else if (assessmentSelected && k === q.correct_answer) {
                  border = '1px solid #4ade80'; bg = 'rgba(74,222,128,0.08)'; color = '#4ade80'
                } else if (assessmentSelected) {
                  color = '#475569'
                }
                return (
                  <button key={k} type="button"
                    onClick={() => handleAssessmentAnswer(k)}
                    disabled={!!assessmentSelected}
                    style={{ textAlign: 'left', width: '100%', padding: '12px 16px', borderRadius: 10, border, background: bg, color, cursor: assessmentSelected ? 'default' : 'pointer', fontSize: 14, lineHeight: 1.5 }}
                  >
                    <strong style={{ marginRight: 8, opacity: 0.7 }}>{k}.</strong>{safeStr(v)}
                  </button>
                )
              })}
            </div>
          )}

          {assessmentSelected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`badge ${assessmentFeedback ? 'success' : 'danger'}`}>
                {assessmentFeedback ? '✓ Correct!' : '✗ Incorrect'}
              </span>
              <button type="button" className="btn" onClick={handleAssessmentNext} disabled={assessmentSubmitting}>
                {assessmentSubmitting ? 'Submitting…' : assessmentIdx + 1 < assessmentQs.length ? 'Next →' : 'Finish Assessment →'}
              </button>
            </div>
          )}

          {error && <p className="feedback error">{error}</p>}
        </section>
      </div>
    )
  }

  if (!sessionId && !sessionEnded) {
    return (
      <div className="grid-two" style={{ alignItems: 'start' }}>
        <section className="card stack">
          <div>
            <h2>Practice Session</h2>
            <p className="meta">Select a topic and start practising. Questions appear on the left, tutor chat on the right.</p>
          </div>

          <div className="stack">
            <h4 style={{ margin: 0 }}>Choose a topic</h4>
            {skills.length === 0 ? (
              <p className="meta">Loading skills…</p>
            ) : (
              <div className="chip-row">
                {skills.map((s: any) => (
                  <button key={s.id} type="button"
                    className={`chip ${selectedSkill === s.id ? 'active' : ''}`}
                    onClick={() => handleSkillSelect(s.id)}
                  >
                    {s.name}
                    {skillStatus && selectedSkill === s.id && skillStatus.has_active_session && (
                      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>▶ active</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Skill status info */}
            {selectedSkill && skillStatus && !statusLoading && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {skillStatus.has_active_session ? (
                  <p className="meta" style={{ margin: 0 }}>
                    ▶️ <strong>Active session</strong> — {skillStatus.message_count} messages saved.
                    {skillStatus.mastery != null && ` Mastery: ${(skillStatus.mastery * 100).toFixed(0)}%`}
                  </p>
                ) : skillStatus.assessment_done ? (
                  <p className="meta" style={{ margin: 0 }}>
                    ✅ Assessment done.
                    {skillStatus.mastery != null && ` Current mastery: ${(skillStatus.mastery * 100).toFixed(0)}%`}
                  </p>
                ) : (
                  <p className="meta" style={{ margin: 0 }}>
                    📋 New skill — initial assessment will run first (3 questions).
                  </p>
                )}
              </div>
            )}
            {statusLoading && <p className="meta" style={{ margin: 0 }}>Checking session…</p>}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              disabled={!selectedSkill || loading || statusLoading}
              onClick={handleStartOrContinue}
              style={skillStatus?.has_active_session ? { background: '#7c3aed' } : {}}
            >
              {loading ? 'Loading…' :
               statusLoading ? 'Checking…' :
               skillStatus?.has_active_session ? '▶ Continue Session' :
               'Start Session'}
            </button>
            <span className="meta" style={{ fontSize: 12 }}>
              👁 Camera engagement tracking will start automatically
            </span>
          </div>

          {error && <p className="feedback error">{error}</p>}
          <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
        </section>

        <aside className="card stack">
          <h3 style={{ margin: 0 }}>How it works</h3>
          <div className="list">
            {[
              ['Pick a topic', 'Select a skill. The AI picks the right difficulty for you.'],
              ['Answer questions', 'Questions appear on the left. Click an option to answer.'],
              ['Chat with tutor', 'Feedback and explanations appear on the right. Ask anything.'],
              ['Hint anytime', 'Click Hint or type "hint" in the chat for guidance.'],
              ['End and review', 'End the session to see accuracy, mastery, and time.'],
            ].map(([title, desc]) => (
              <div className="list-item" key={title}>
                <strong>{title}</strong>
                <p className="meta" style={{ marginTop: 4 }}>{desc}</p>
              </div>
            ))}
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

  // ─── Session summary ──────────────────────────────────────────────────────

  if (sessionEnded && summary) {
    const acc = summary.accuracy_pct ?? summary.accuracy ?? null
    return (
      <div className="stack" style={{ maxWidth: 600, margin: '0 auto' }}>
        <section className="card stack" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <h2 style={{ margin: 0 }}>Session complete!</h2>
          <p className="meta">Great work. Here's your summary.</p>
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
                <span className="meta">{(summary.mastery_start * 100).toFixed(0)}% → {(summary.mastery_end * 100).toFixed(0)}%</span>
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
          <button type="button" className="btn" onClick={() => {
            setSessionId(null); setSessionEnded(false); setSummary(null)
            setMessages([]); setPhase('skill-pick')
            // Refresh status so skill picker shows updated mastery
            if (selectedSkill && user?.id) {
              getSessionStatus(selectedSkill).then((s) => {
                setSkillStatus(s)
                if (s.mastery != null) setMastery(s.mastery * 100)
              }).catch(() => {})
            }
          }}>
            ← Back to Skills
          </button>
          <button type="button" className="btn secondary" onClick={() => { window.location.href = '/dashboard/student' }}>
            Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ─── Active session — split layout ────────────────────────────────────────

  const currentQuestion = [...messages].reverse().find((m) => m.type === 'PRACTICE_QUESTION') ?? null
  const skillName = skills.find((s) => s.id === selectedSkill)?.name || ''

  // Chat panel: only explanations, hints, dialogue, student questions — no answers/feedback
  const chatMessages = messages.filter((m) =>
    m.type !== 'PRACTICE_QUESTION' && m.type !== 'FEEDBACK' && m.type !== 'ANSWER'
  )

  return (
    <div style={{ display: 'flex', gap: 14, height: 'calc(100vh - 130px)', minHeight: 520 }}>
      {/* ── LEFT: Question panel ── */}
      <div style={{ width: '44%', minWidth: 280, flexShrink: 0 }}>
        <QuestionPanel
          question={currentQuestion}
          pendingAnswer={pendingAnswer}
          answerCorrect={lastAnswerCorrect}
          onAnswer={handleAnswer}
          onHint={handleHintBtn}
          onEnd={handleEndSession}
          elapsed={elapsed}
          mastery={mastery}
          engagementScore={engagementScore}
          cameraOn={cameraOn}
          onEnableCamera={startEngagementCapture}
          onDisableCamera={stopEngagementCapture}
          skillName={skillName}
        />
      </div>

      {/* ── RIGHT: Tutor chat panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        {/* Chat header */}
        <div className="card" style={{ padding: '10px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>Tutor Chat</h4>
            {voiceStatus ? (
              <span className="meta" style={{ fontSize: 12, color: 'var(--accent)', fontStyle: 'italic' }}>
                🔄 {voiceStatus}
              </span>
            ) : (
              <span className="meta" style={{ fontSize: 12 }}>Type or use voice</span>
            )}
          </div>
        </div>

        {/* Chat messages */}
        <div
          className="card chat-messages"
          style={{ flex: 1, overflowY: 'auto', gap: 12, padding: '14px 16px', minHeight: 0 }}
        >
          {chatMessages.length === 0 && voiceStreamText === '' && (
            <div className="empty-state">
              <p className="meta">Answer a question on the left, or ask the tutor via text or voice…</p>
            </div>
          )}
          {chatMessages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)}

          {/* Live LLM streaming from voice pipeline */}
          {voiceStreamText && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <span className="meta" style={{ fontSize: 11 }}>Tutor AI · live</span>
              <div className="chat-bubble assistant" style={{ maxWidth: '88%' }}>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>{voiceStreamText}</p>
              </div>
            </div>
          )}

          {(loading || pendingAnswer) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="chat-bubble assistant" style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 13 }}>
                Thinking…
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {error && <p className="feedback error" style={{ margin: 0, flexShrink: 0 }}>{error}</p>}

        {/* Input + voice */}
        <div className="card" style={{ padding: '10px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={voiceState === 'recording' ? '🎙️ Recording… click Stop when done' : voiceState === 'processing' ? '⏳ Processing voice…' : 'Ask the tutor anything — or use the mic'}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              style={{ flex: 1, resize: 'none', fontSize: 13 }}
              disabled={loading || pendingAnswer || voiceState !== 'idle'}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Text send */}
              <button type="button" className="btn small" onClick={handleSend}
                disabled={!input.trim() || loading || pendingAnswer || voiceState !== 'idle'}>
                Send
              </button>

              {/* Voice button */}
              {voiceState === 'idle' && (
                <button type="button" className="btn small secondary" onClick={startVoiceRecording}
                  title="Start voice input" style={{ fontSize: 16, padding: '4px 10px' }}>
                  🎙️
                </button>
              )}
              {voiceState === 'recording' && (
                <button type="button" className="btn small danger" onClick={stopVoiceRecording}
                  title="Stop recording and send" style={{ animation: 'pulse 1s infinite' }}>
                  ⏹ Stop
                </button>
              )}
              {voiceState === 'processing' && (
                <button type="button" className="btn small secondary" disabled style={{ opacity: 0.5 }}>
                  ⏳
                </button>
              )}
            </div>
          </div>
          <p className="meta" style={{ fontSize: 11, marginTop: 5 }}>
            {voiceState === 'recording'
              ? 'Speak now — click Stop when done · Cancel: refresh page'
              : 'Enter to send · 🎙️ for voice input (STT → LLM → TTS)'}
          </p>
        </div>
      </div>

      <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
    </div>
  )
}
