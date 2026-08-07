import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getCurrentUser, listSkills, getMasterySummary,
  startChatSession, sendChatMessage, endChatSession,
  analyzeVisualEngagement, getAuthToken,
  getSessionStatus, getAssessmentQuestions, completeAssessment,
  streamLesson,
} from '../lib/api'
import ImageLightbox from '../components/ImageLightbox'
import TutorMarkdown from '../components/TutorMarkdown'
import { useSpeech } from '../lib/speech'
import ChatFontScale, { useChatFontScale } from '../components/ChatFontScale'
import { useStudyBreak } from '../components/StudyBreak/useStudyBreak'
import StudyBreakModal from '../components/StudyBreak/StudyBreakModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type MsgRole = 'system' | 'student'
type MsgType = 'PRACTICE_QUESTION' | 'FEEDBACK' | 'EXPLANATION' | 'HINT' | 'DIALOGUE' | 'ANSWER' | 'QUESTION' | 'SUMMARY' | 'SESSION_RESUMED' | 'SESSION_START' | 'LESSON'
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
  streaming?: boolean      // true while a LESSON bubble is still receiving tokens
  noTts?: boolean          // skip auto read-aloud (voice pipeline already spoke it)
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

const DIFF_LABELS: Record<number, string> = { 1: 'Beginner', 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Expert' }

function uid() { return Math.random().toString(36).slice(2) }

/**
 * A font size that follows the chat's A−/A+ text-size setting.
 *
 * The bubbles style their text with inline `fontSize`, which beats any
 * stylesheet rule — so scaling has to be baked into the inline value itself
 * rather than left to `.chat-bubble` inheritance.
 */
function fs(px: number): string {
  return `calc(${px}px * var(--chat-font-scale, 1))`
}

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

function MasteryBar({ pct, label, big }: { pct: number; label?: string; big?: boolean }) {
  const clamped = Math.min(pct, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: big ? 16 : 10 }}>
      {label && (
        <span style={{
          whiteSpace: 'nowrap', color: 'var(--muted)', fontWeight: 700,
          fontSize: big ? 19 : 13, minWidth: big ? 112 : 66,
        }}>
          {label}
        </span>
      )}
      <div className="teacher-progress" style={{ flex: 1, height: big ? 14 : undefined }}>
        <span style={{ width: `${clamped}%` }} />
      </div>
      <span style={{
        textAlign: 'right', fontWeight: 700, color: 'var(--text)',
        fontSize: big ? 20 : 13, minWidth: big ? 60 : 40,
      }}>
        {clamped.toFixed(0)}%
      </span>
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
      <div className="teacher-panel" style={{ padding: '40px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <p className="teacher-eyebrow" style={{ margin: 0, fontSize: 17 }}>{skillName || 'Learning session'}</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 18, color: 'var(--muted)', fontWeight: 600 }}>
              ⏱ {fmtTime(elapsed)}
            </span>
            {!cameraOn && (
              <button type="button" className="teacher-action" onClick={onEnableCamera}
                style={{ minHeight: 'unset', padding: '11px 18px', fontSize: 15, gap: 6 }}
                title="Enable camera engagement tracking">
                👁 Camera off
              </button>
            )}
            {cameraOn && (
              <button type="button" className="teacher-action primary" onClick={onDisableCamera}
                style={{ minHeight: 'unset', padding: '11px 18px', fontSize: 15, gap: 6 }}
                title="Camera tracking active — click to disable">
                👁 On
              </button>
            )}
            <button type="button" className="teacher-action learn-exit-btn" onClick={onEnd}
              style={{ minHeight: 'unset', padding: '11px 20px', fontSize: 15 }}>
              Exit
            </button>
          </div>
        </div>
        <div style={{ marginTop: 32 }}>
          <MasteryBar pct={mastery} label="Mastery" big />
        </div>
        {engagementScore != null && (
          <div style={{ marginTop: 20 }}>
            <MasteryBar pct={engagementScore * 100} label="Engagement" big />
          </div>
        )}
      </div>

      {/* Question display */}
      <div className="teacher-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 26px', overflowY: 'auto' }}>
        {!question ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
              <p style={{ color: 'var(--muted)', margin: 0, fontSize: 15 }}>Waiting for the next question…</p>
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="teacher-eyebrow" style={{ marginBottom: 10, fontSize: 13 }}>Practice Question</p>
              <p style={{ fontSize: 19, lineHeight: 1.6, margin: 0, fontWeight: 600, color: 'var(--text)' }}>
                {question.content}
              </p>
            </div>

            {question.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(question.options).map(([k, v]) => {
                  let stateClass = ''
                  if (answered && k === question.selectedAnswer) {
                    if (answerCorrect === true) stateClass = 'correct'
                    else if (answerCorrect === false) stateClass = 'incorrect'
                    else stateClass = 'selected'
                  } else if (answered) {
                    stateClass = 'dimmed'
                  }

                  return (
                    <button
                      key={k}
                      type="button"
                      className={`learn-option ${stateClass}`}
                      onClick={() => !answered && !pendingAnswer && onAnswer(k)}
                      disabled={answered || pendingAnswer}
                    >
                      <span className="learn-option-key">{k}</span>
                      <span>{safeStr(v)}</span>
                    </button>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              {/* <button type="button" className="teacher-action" onClick={onHint}
                disabled={answered || pendingAnswer}
                style={{ minHeight: 'unset', padding: '8px 14px', fontSize: 13 }}>
                💡 Hint
              </button> */}
              {answered && (
                <span className={`learn-status-pill ${answerCorrect === true ? 'success' : answerCorrect === false ? 'error' : 'pending'}`}>
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
function ChatBubble({ msg, onImageClick, onSpeak }: {
  msg: ChatMsg
  onImageClick?: (src: string) => void
  onSpeak?: (msg: ChatMsg) => void
}) {
  const isStudent = msg.role === 'student'

  let bubbleExtra: React.CSSProperties = {}
  if (msg.type === 'FEEDBACK') {
    bubbleExtra = {
      background: msg.isCorrect ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${msg.isCorrect ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`,
    }
  }

  // FEEDBACK repeats the ✅/❌ verdict that the header above already shows.
  const body = msg.type === 'FEEDBACK'
    ? safeStr(msg.content).replace(/^[✅❌]\s*(Correct!|Not quite\.?)\s*/i, '').trim() || safeStr(msg.content)
    : safeStr(msg.content)

  const bodyStyle: React.CSSProperties = {
    margin: 0, lineHeight: 1.6, fontSize: fs(14),
    // Justified tutor prose; student replies are usually one line, where
    // justifying would stretch the gaps for no benefit.
    textAlign: isStudent ? 'left' : 'justify',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isStudent ? 'flex-end' : 'flex-start', gap: 4 }}>
      <span style={{ fontSize: fs(13), color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {isStudent ? 'You' : 'Tutor AI'} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {!isStudent && onSpeak && !msg.streaming && safeStr(msg.content).trim() && (
          <button
            type="button"
            className="learn-tts-btn small"
            onClick={() => onSpeak(msg)}
            title="Read this aloud"
            aria-label="Read this message aloud"
          >
            🔊
          </button>
        )}
      </span>
      <div
        className={`chat-bubble ${isStudent ? 'user' : 'assistant'}`}
        style={{
          maxWidth: '92%',
          background: isStudent ? 'var(--accent)' : 'var(--surface)',
          color: isStudent ? '#fff' : 'var(--text)',
          border: isStudent ? 'none' : '1px solid var(--border)',
          borderBottomRightRadius: isStudent ? 4 : 14,
          borderBottomLeftRadius: isStudent ? 14 : 4,
          ...bubbleExtra,
        }}
      >
        {msg.type === 'FEEDBACK' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: fs(19) }}>{msg.isCorrect ? '✅' : '❌'}</span>
            <strong style={{ color: msg.isCorrect ? 'var(--success)' : 'var(--danger)', fontSize: fs(16) }}>
              {msg.isCorrect ? 'Correct!' : 'Not quite'}
            </strong>
          </div>
        )}
        {msg.type === 'HINT' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: fs(17) }}>💡</span>
            <strong style={{ fontSize: fs(15), color: 'var(--warning)' }}>Hint</strong>
          </div>
        )}
        {msg.type === 'LESSON' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: fs(16) }}>📘</span>
            <strong style={{ fontSize: fs(13), color: 'var(--accent)' }}>Lesson</strong>
            {msg.streaming && (
              <span style={{ fontSize: fs(11), color: 'var(--muted)', fontStyle: 'italic' }}>
                ✍️ writing…
              </span>
            )}
          </div>
        )}

        {msg.type === 'LESSON' && msg.streaming && !safeStr(msg.content) ? (
          <p style={{ margin: 0, color: 'var(--muted)', fontStyle: 'italic', fontSize: fs(14) }}>
            Preparing your personalized lesson<span className="dot-ellipsis" />
          </p>
        ) : isStudent ? (
          // The student's own words stay verbatim — rendering them as Markdown
          // would let a stray "#" or "*" reformat what they actually typed.
          <p style={{ ...bodyStyle, whiteSpace: 'pre-wrap' }}>{body}</p>
        ) : (
          // The typing caret rides the end of the last rendered line via CSS
          // (.md-streaming). A sibling element would sit on a line of its own,
          // because every Markdown block renders block-level.
          <TutorMarkdown
            text={body}
            className={msg.type === 'LESSON' && msg.streaming ? 'md-streaming' : undefined}
            style={bodyStyle}
          />
        )}

        {msg.imageUrl && (
          <div style={{ marginTop: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.imageUrl}
              alt="AI-generated infographic — click to enlarge"
              onClick={() => onImageClick?.(msg.imageUrl!)}
              style={{
                maxWidth: '100%', borderRadius: 8, display: 'block',
                border: '1px solid var(--border)', cursor: 'zoom-in',
              }}
            />
            <span style={{ fontSize: fs(12), marginTop: 4, display: 'block', color: 'var(--muted)' }}>
              🖼️ AI-generated visual — click to enlarge
            </span>
          </div>
        )}

        {!msg.imageUrl && msg.imageError && (
          <p style={{ fontSize: fs(13), marginTop: 8, fontStyle: 'italic', color: 'var(--muted)', margin: 0 }}>
            🖼️ Couldn't generate a visual for this one.
          </p>
        )}

        {msg.type === 'FEEDBACK' && msg.masteryAfter != null && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <MasteryBar pct={msg.masteryAfter * 100} label="Mastery" />
            {msg.masteryBefore != null && (
              <p style={{ fontSize: fs(13), marginTop: 4, color: 'var(--muted)', margin: '4px 0 0' }}>
                {msg.masteryBefore < msg.masteryAfter ? '↑' : '→'} {(msg.masteryBefore * 100).toFixed(0)}% → {(msg.masteryAfter * 100).toFixed(0)}%
              </p>
            )}
          </div>
        )}

        {msg.type === 'ANSWER' && msg.isCorrect != null && (
          <span
            style={{
              marginTop: 6, display: 'inline-flex', fontSize: fs(13),
              padding: '5px 14px', borderRadius: 999, fontWeight: 700,
              background: msg.isCorrect ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)',
              color: msg.isCorrect ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${msg.isCorrect ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
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
  const [lightboxSrc, setLightboxSrc] = useState('')
  const [phase, setPhase] = useState<Phase>('skill-pick')

  // Skill-picker filters (frontend only)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [skillQuery, setSkillQuery] = useState('')

  const skillCategories = useMemo(() => {
    const cats = new Set(skills.map((s: any) => s.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [skills])

  const visibleSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    return skills.filter((s: any) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false
      if (difficultyFilter !== 'all' && String(s.difficulty_level ?? '') !== difficultyFilter) return false
      // Search spans description and category too — students look for "cross
      // validation" long before they know it lives under "Model Evaluation".
      if (q && !`${s.name || ''} ${s.description || ''} ${s.category || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [skills, categoryFilter, difficultyFilter, skillQuery])

  const filtersActive = categoryFilter !== 'all' || difficultyFilter !== 'all' || skillQuery.trim() !== ''

  function clearSkillFilters() {
    setCategoryFilter('all'); setDifficultyFilter('all'); setSkillQuery('')
  }

  const selectedSkillObj = useMemo(
    () => skills.find((s: any) => s.id === selectedSkill) || null,
    [skills, selectedSkill],
  )

  // A skill hidden by the filters can't stay selected — otherwise the Start /
  // Continue button would still act on a skill the student can no longer see.
  useEffect(() => {
    if (
      phase === 'skill-pick' &&
      selectedSkill != null &&
      skills.length > 0 &&
      !visibleSkills.some((s: any) => s.id === selectedSkill)
    ) {
      setSelectedSkill(null)
      setSkillStatus(null)
    }
  }, [visibleSkills, selectedSkill, phase, skills.length])

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
  // Read-aloud: tutor messages are spoken automatically as they arrive.
  const { supported: ttsSupported, speaking, speak, stop: stopSpeaking } = useSpeech()
  const [autoRead, setAutoRead] = useState(true)
  const spokenRef = useRef<Set<string>>(new Set())
  const fontScale = useChatFontScale('learn_chat_font_scale')
  const [input, setInput] = useState('')
  const [pendingAnswer, setPendingAnswer] = useState(false)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Study-break reminder — accrues while in an active lesson; pops an unskippable
  // break every 30 min (shared with the Learn Anything page).
  const { breakDue, resetBreak } = useStudyBreak(phase === 'session' && !sessionEnded)

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
  const chatScrollRef = useRef<HTMLDivElement>(null)
  // "stick to bottom": true while the user is parked at the bottom of the chat.
  // If they scroll up (to re-read earlier text), this flips false and we stop
  // auto-scrolling so streaming tokens don't yank them back down.
  const stickToBottomRef = useRef(true)
  const activeQuestionRef = useRef<ChatMsg | null>(null)
  const lessonStreamAbortRef = useRef<null | (() => void)>(null)

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

  // Track whether the user is parked at the bottom. Only auto-scroll when they
  // are — so scrolling up during a streaming lesson is never interrupted.
  function handleChatScroll() {
    const el = chatScrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distanceFromBottom < 80
  }

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    // When the student just sent something, always snap them to the bottom (and
    // re-arm auto-scroll) — they took an action and expect to see the reply.
    const last = messages[messages.length - 1]
    if (last?.role === 'student') stickToBottomRef.current = true
    if (!stickToBottomRef.current) return
    // Scroll the chat container itself (not scrollIntoView, which also drags the
    // whole page/window down). This keeps the browser scroll position untouched.
    el.scrollTop = el.scrollHeight
  }, [messages])

  function cleanup() {
    stopEngagementCapture()
    if (timerRef.current) clearInterval(timerRef.current)
    lessonStreamAbortRef.current?.()
    lessonStreamAbortRef.current = null
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
      const res = await startChatSession({ skill_id: selectedSkill, user_id: user.id, defer_lesson: true })
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
        // Don't replay the whole transcript aloud on resume — only new messages.
        restored.forEach((m) => spokenRef.current.add(m.id))
        setMessages([resumeNotice, ...restored])

        // Restore the active question ref so the student can answer it immediately
        const lastRestoredQ = restored.slice().reverse().find((m) => m.type === 'PRACTICE_QUESTION')
        if (lastRestoredQ) {
          activeQuestionRef.current = lastRestoredQ
          setLastAnswerCorrect(null)
        }
        // Restore mastery from current BKT state — mastery_start is frozen at
        // session creation, so only use it if the backend didn't send the live value
        const resumedMastery = res.mastery_current ?? res.mastery_start
        if (resumedMastery != null) setMastery(resumedMastery * 100)
      } else {
        setMessages([])
        // Welcome shows instantly. The full lesson is DEFERRED (generation takes
        // ~1 min on the LLM) — we drop a streaming placeholder bubble and fill it
        // token-by-token via SSE, so the student sees the lesson being written
        // instead of a frozen screen.
        if (res.welcome_message) addSystemMsg(res.welcome_message)

        const lessonPending = res.lesson_message?.metadata?.pending
        let lessonId: string | null = null
        if (res.lesson_message) {
          lessonId = uid()
          setMessages((prev) => [...prev, {
            id: lessonId!, role: 'system', type: 'LESSON',
            content: '', streaming: !!lessonPending, timestamp: Date.now(),
          }])
        }

        // First practice question appears immediately (left panel + chat).
        const firstMsg = res.first_message || res.message || res
        addSystemMsg(firstMsg)

        // Stream the lesson into its placeholder bubble.
        if (lessonId && lessonPending) {
          lessonStreamAbortRef.current?.()
          lessonStreamAbortRef.current = streamLesson(sid, {
            onDelta: (t) => setMessages((prev) => prev.map((m) =>
              m.id === lessonId ? { ...m, content: m.content + t } : m)),
            onDone: (full) => setMessages((prev) => prev.map((m) =>
              m.id === lessonId ? { ...m, content: full || m.content, streaming: false } : m)),
            onError: () => setMessages((prev) => prev.map((m) =>
              m.id === lessonId ? {
                ...m, streaming: false,
                content: m.content || '⚠️ The lesson could not be generated right now — but you can still ask me anything about this topic and try the practice question.',
              } : m)),
          })
        } else if (res.lesson_message?.content && lessonId) {
          // Non-deferred fallback: lesson already generated server-side.
          const full = res.lesson_message.content
          setMessages((prev) => prev.map((m) =>
            m.id === lessonId ? { ...m, content: full, streaming: false } : m))
        }
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

  // ─── Read aloud ───────────────────────────────────────────────────────────

  /** What the voice should say for a message (questions include their options). */
  function speechTextFor(m: ChatMsg): string {
    const body = safeStr(m.content)
    if (m.type === 'PRACTICE_QUESTION' && m.options && Object.keys(m.options).length) {
      const opts = Object.entries(m.options).map(([k, v]) => `${k}. ${safeStr(v)}`).join('. ')
      return `${body}. Your options are: ${opts}`
    }
    return body
  }

  // Speak every new tutor message once. Messages already spoken (or spoken by the
  // voice pipeline, which returns its own audio) are skipped, and a finished
  // streaming lesson is read only once it's complete.
  useEffect(() => {
    if (!autoRead || phase !== 'session') return
    const pending = messages.filter((m) =>
      m.role === 'system' && !m.noTts && !m.streaming &&
      safeStr(m.content).trim() && !spokenRef.current.has(m.id),
    )
    if (pending.length === 0) return
    pending.forEach((m) => spokenRef.current.add(m.id))
    const text = pending.map(speechTextFor).filter(Boolean).join('. ')
    if (text) speak(text)
  }, [messages, autoRead, phase])

  function toggleAutoRead() {
    setAutoRead((prev) => {
      const next = !prev
      try { window.localStorage.setItem('learn_auto_read', next ? '1' : '0') } catch { /* ignore */ }
      if (!next) stopSpeaking()
      return next
    })
  }

  // Restore the student's saved preference.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('learn_auto_read')
      if (saved != null) setAutoRead(saved === '1')
    } catch { /* ignore */ }
  }, [])

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
    // Cancel any in-flight lesson stream so it doesn't write into a closed view.
    lessonStreamAbortRef.current?.()
    lessonStreamAbortRef.current = null
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
    // noTts: the voice pipeline streams its own spoken audio back — don't let the
    // browser read the same reply a second time.
    setMessages((prev) => [...prev, { id: uid(), role, type, content, noTts: true, timestamp: Date.now() }])
  }

  async function startVoiceRecording() {
    if (!user?.id) return
    if (voiceState !== 'idle') return
    stopSpeaking()   // don't let read-aloud talk over the student's recording
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

  // ─── Assessment phase UI ──────────────────────────────────────────────────

  if (phase === 'assessment' && assessmentQs.length > 0) {
    const q = assessmentQs[assessmentIdx]
    const total = assessmentQs.length
    const pct = Math.round(((assessmentIdx) / total) * 100)

    return (
      <div className="learn-assessment">
        <div className="teacher-dashboard">
          <section className="teacher-hero" style={{ padding: '32px 40px', alignItems: 'center' }}>
            <div>
              <p className="teacher-eyebrow">Initial Assessment</p>
              <h2 className="editorial-title" style={{ fontSize: 'clamp(32px,4.5vw,52px)', margin: '10px 0 12px' }}>
                Knowledge check
              </h2>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 16, lineHeight: 1.7 }}>
                Answer a few questions so we can calibrate the right difficulty for you.
              </p>
            </div>
            <div className="teacher-hero-note" style={{ minHeight: 150, padding: 24 }}>
              <span>Question</span>
              <strong style={{ fontSize: 46 }}>{assessmentIdx + 1}<span style={{ fontSize: 26, opacity: 0.5 }}>/{total}</span></strong>
              <p>initial assessment</p>
            </div>
          </section>

          <section className="teacher-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <div className="teacher-progress" style={{ flex: 1 }}>
                <span style={{ width: `${pct}%` }} />
              </div>
              {q.difficulty && (
                <span className="badge neutral" style={{ flexShrink: 0 }}>Difficulty {q.difficulty}</span>
              )}
            </div>

            <p style={{ fontSize: 18, lineHeight: 1.65, fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>
              {q.question_text}
            </p>

            {q.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(q.options).map(([k, v]) => {
                  let stateClass = ''
                  if (assessmentSelected === k) {
                    if (assessmentFeedback === true) stateClass = 'correct'
                    if (assessmentFeedback === false) stateClass = 'incorrect'
                  } else if (assessmentSelected && k === q.correct_answer) {
                    stateClass = 'correct'
                  } else if (assessmentSelected) {
                    stateClass = 'dimmed'
                  }

                  return (
                    <button key={k} type="button"
                      className={`learn-option ${stateClass}`}
                      onClick={() => handleAssessmentAnswer(k)}
                      disabled={!!assessmentSelected}
                    >
                      <span className="learn-option-key">{k}</span>
                      <span>{safeStr(v)}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {assessmentSelected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <span className={`learn-status-pill ${assessmentFeedback ? 'success' : 'error'}`}>
                  {assessmentFeedback ? '✓ Correct!' : '✗ Incorrect'}
                </span>
                <button type="button" className="teacher-action primary"
                  onClick={handleAssessmentNext}
                  disabled={assessmentSubmitting}
                  style={{ minHeight: 'unset', padding: '10px 22px', marginLeft: 'auto' }}
                >
                  {assessmentSubmitting ? 'Submitting…' : assessmentIdx + 1 < assessmentQs.length ? 'Next →' : 'Finish Assessment →'}
                </button>
              </div>
            )}

            {error && <p className="feedback error" style={{ marginTop: 16 }}>{error}</p>}
          </section>
        </div>
      </div>
    )
  }

  // ─── Skill picker ─────────────────────────────────────────────────────────

  // Shared by the Step 2 panel and the mobile launch bar, which are the same
  // action rendered at whichever breakpoint can reach it.
  const startLabel =
    loading ? 'Loading…' :
    statusLoading ? 'Checking…' :
    skillStatus?.has_active_session ? '▶ Continue Session' :
    'Start Session'

  if (!sessionId && !sessionEnded) {
    return (
      <div className={`teacher-dashboard student-dash learn-picker-page${selectedSkillObj ? ' has-launch-bar' : ''}`}>
        <div className="teacher-layout">
          <section className="teacher-main">
            <section className="teacher-hero">
              <div>
                <p className="teacher-eyebrow">Practice Studio</p>
                <h2 className="editorial-title">
                  Practice Session
                </h2>
                <p>
                  Select a topic and start practising. Questions appear on the left, tutor chat on the right.
                </p>
              </div>
              {mastery > 0 && (
                <div className="teacher-hero-note">
                  <span>Overall mastery</span>
                  <strong>{mastery.toFixed(0)}%</strong>
                  <p>across all skills</p>
                </div>
              )}
            </section>

            <div className="learn-step-row">
            <section className="teacher-panel">
              {/* Header: title left, filters right */}
              <div className="learn-picker-header">
                <div>
                  <p className="teacher-eyebrow">Step 1</p>
                  <h3 className="editorial-title" style={{ margin: 0 }}>Choose a topic</h3>
                </div>
                {skills.length > 0 && (
                  <div className="learn-filter-row">
                    <div className="learn-filter learn-filter-search">
                      <label htmlFor="learn-skill-search">Search</label>
                      <div className="learn-search-wrap">
                        <span className="learn-search-icon" aria-hidden="true">🔍</span>
                        <input
                          id="learn-skill-search"
                          type="search"
                          value={skillQuery}
                          onChange={(e) => setSkillQuery(e.target.value)}
                          placeholder="Search topics…"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    {skillCategories.length > 0 && (
                      <div className="learn-filter">
                        <label htmlFor="learn-category-filter">Category</label>
                        <select
                          id="learn-category-filter"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                          <option value="all">All categories</option>
                          {skillCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="learn-filter">
                      <label htmlFor="learn-difficulty-filter">Difficulty</label>
                      <select
                        id="learn-difficulty-filter"
                        value={difficultyFilter}
                        onChange={(e) => setDifficultyFilter(e.target.value)}
                      >
                        <option value="all">All difficulties</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={String(n)}>{DIFF_LABELS[n]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {skills.length > 0 && filtersActive && (
                <div className="learn-result-row">
                  <span>Showing <strong>{visibleSkills.length}</strong> of {skills.length} topics</span>
                  <button type="button" className="skills-chip" onClick={clearSkillFilters}>
                    Clear filters
                  </button>
                </div>
              )}

              {skills.length === 0 ? (
                <p style={{ color: 'var(--muted)', margin: 0 }}>Loading skills…</p>
              ) : visibleSkills.length === 0 ? (
                <div className="learn-skill-empty">
                  <p>No topics match your search or filters.</p>
                  <button type="button" className="skills-chip" onClick={clearSkillFilters}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="learn-skill-grid">
                  {visibleSkills.map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`learn-skill-card ${selectedSkill === s.id ? 'selected' : ''}`}
                      onClick={() => handleSkillSelect(s.id)}
                      style={{ fontSize: 16 }}
                    // >
                    //   {s.name}
                    //   {skillStatus && selectedSkill === s.id && skillStatus.has_active_session && (
                    //     <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.75 }}>▶ active</span>
                      title={s.description || s.name}
                    >
                      <div className="learn-skill-card-top">
                        <span className="learn-skill-card-name">{s.name}</span>
                        <span className="learn-skill-card-check" aria-hidden="true">✓</span>
                      </div>
                      <div className="learn-skill-card-badges">
                        {s.difficulty_level != null && (
                          <span className="badge neutral" style={{ fontSize: 12 }}>
                            {DIFF_LABELS[s.difficulty_level] || `Level ${s.difficulty_level}`}
                          </span>
                        )}
                        {s.category && (
                          <span className="badge neutral" style={{ fontSize: 12 }}>{s.category}</span>
                        )}
                      </div>
                      {s.description ? (
                        <p className="learn-skill-card-desc">{s.description}</p>
                      ) : (
                        <p className="learn-skill-card-desc placeholder">No description yet.</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

            </section>

            {/* Step 2 sticks to the viewport as the topic grid scrolls past, so
                the primary action is reachable no matter how many modules exist.
                Everything needed to decide — what's selected, what happens on
                click — now lives in this one panel instead of being spread
                across the bottom of Step 1. */}
            <section className="teacher-panel learn-step-start">
              <div className="teacher-panel-header">
                <div>
                  <p className="teacher-eyebrow">Step 2</p>
                  <h3 className="editorial-title">Begin learning</h3>
                </div>
              </div>

              <div className="learn-step-start-body">
                {selectedSkillObj ? (
                  <div className="learn-launch-pick">
                    <p className="learn-launch-label">Selected topic</p>
                    <p className="learn-launch-name">{selectedSkillObj.name}</p>
                    {(selectedSkillObj.difficulty_level != null || selectedSkillObj.category) && (
                      <div className="learn-skill-card-badges">
                        {selectedSkillObj.difficulty_level != null && (
                          <span className="badge neutral" style={{ fontSize: 12 }}>
                            {DIFF_LABELS[selectedSkillObj.difficulty_level] || `Level ${selectedSkillObj.difficulty_level}`}
                          </span>
                        )}
                        {selectedSkillObj.category && (
                          <span className="badge neutral" style={{ fontSize: 12 }}>{selectedSkillObj.category}</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="learn-launch-empty">
                    <span className="learn-launch-empty-icon" aria-hidden="true">📚</span>
                    <p>Choose a topic in Step 1 — it will appear here, ready to start.</p>
                  </div>
                )}

                {selectedSkill && skillStatus && !statusLoading && (
                  <div className="learn-launch-status">
                    {skillStatus.has_active_session ? (
                      <p>
                        ▶️ <strong>Active session</strong> — {skillStatus.message_count} messages saved.
                        {skillStatus.mastery != null && ` Mastery: ${(skillStatus.mastery * 100).toFixed(0)}%`}
                      </p>
                    ) : skillStatus.assessment_done ? (
                      <p>
                        ✅ Assessment done.
                        {skillStatus.mastery != null && ` Current mastery: ${(skillStatus.mastery * 100).toFixed(0)}%`}
                      </p>
                    ) : (
                      <p>📋 New skill — initial assessment will run first (up to 10 questions).</p>
                    )}
                  </div>
                )}
                {statusLoading && (
                  <p className="learn-launch-checking">Checking session…</p>
                )}

                <button
                  type="button"
                  className="teacher-action primary learn-launch-btn"
                  disabled={!selectedSkill || loading || statusLoading}
                  onClick={handleStartOrContinue}
                  style={skillStatus?.has_active_session
                    ? { background: '#7c3aed', borderColor: '#7c3aed' }
                    : undefined}
                >
                  {startLabel}
                </button>
                <p className="learn-launch-note">
                  👁 Camera engagement tracking will start automatically
                </p>
              </div>

              {error && <p className="feedback error" style={{ marginTop: 12 }}>{error}</p>}
            </section>
            </div>
          </section>

          <aside className="teacher-actions">
            <p className="teacher-eyebrow">How it works</p>
            <h3 className="editorial-title">Your session guide</h3>

            <div className="teacher-action-list">
              {[
                ['01', 'Pick a topic', 'Select a skill. The AI picks the right difficulty for you.'],
                ['02', 'Answer questions', 'Questions appear on the left. Click an option to answer.'],
                ['03', 'Chat with tutor', 'Feedback and explanations appear on the right. Ask anything.'],
                ['04', 'Hint anytime', 'Click Hint or type "hint" in the chat for guidance.'],
                ['05', 'End and review', 'End the session to see accuracy, mastery, and time.'],
              ].map(([num, title, desc]) => (
                <div key={num} style={{
                  display: 'flex', gap: 14, padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{
                    fontSize: 19,
                    fontWeight: 500, color: 'var(--muted)', minWidth: 26, paddingTop: 2,
                  }}>{num}</span>
                  <div>
                    <strong style={{ fontSize: 17, display: 'block', marginBottom: 4 }}>{title}</strong>
                    <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* Below 1181px the two steps stack, so the sticky Step 2 rail is no
            longer beside the grid. This bar takes over: it docks to the bottom
            of the viewport the moment a topic is picked, so the action stays
            one tap away however far down the list the student has scrolled. */}
        {selectedSkillObj && (
          <div className="learn-launch-bar">
            <div className="learn-launch-bar-info">
              <span className="learn-launch-bar-label">Selected topic</span>
              <strong className="learn-launch-bar-name">{selectedSkillObj.name}</strong>
            </div>
            <button
              type="button"
              className="teacher-action primary learn-launch-btn"
              disabled={loading || statusLoading}
              onClick={handleStartOrContinue}
              style={skillStatus?.has_active_session
                ? { background: '#7c3aed', borderColor: '#7c3aed' }
                : undefined}
            >
              {startLabel}
            </button>
          </div>
        )}

        <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
      </div>
    )
  }

  // ─── Session summary ──────────────────────────────────────────────────────

  if (sessionEnded && summary) {
    const acc = summary.accuracy_pct ?? summary.accuracy ?? null
    return (
      <div className="teacher-dashboard">
        <section className="teacher-hero">
          <div>
            <p className="teacher-eyebrow">Session Complete</p>
            <h2 className="editorial-title">
              Great work! 🎉
            </h2>
            <p>Here's a summary of your session performance.</p>
          </div>
          {summary.mastery_end != null && (
            <div className="teacher-hero-note">
              <span>Final mastery</span>
              <strong>{(summary.mastery_end * 100).toFixed(0)}%</strong>
              <p>{summary.mastery_start != null ? `from ${(summary.mastery_start * 100).toFixed(0)}%` : 'achieved'}</p>
            </div>
          )}
        </section>

        <div className="teacher-kpi-grid">
          <div className="teacher-kpi-card">
            <p>Questions</p>
            <strong>{summary.practice_questions ?? summary.total_questions ?? '—'}</strong>
          </div>
          <div className="teacher-kpi-card">
            <p>Accuracy</p>
            <strong style={{ color: 'var(--success)' }}>
              {acc != null ? `${typeof acc === 'number' && acc <= 1 ? Math.round(acc * 100) : Math.round(acc)}%` : '—'}
            </strong>
          </div>
          <div className="teacher-kpi-card">
            <p>Time</p>
            <strong>{fmtTime(summary.time_elapsed ?? elapsed)}</strong>
          </div>
        </div>

        {(summary.mastery_start != null && summary.mastery_end != null) || summary.avg_engagement != null ? (
          <section className="teacher-panel">
            {summary.mastery_start != null && summary.mastery_end != null && (
              <div style={{ marginBottom: summary.avg_engagement != null ? 20 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p className="teacher-eyebrow" style={{ margin: 0 }}>Mastery Progress</p>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {(summary.mastery_start * 100).toFixed(0)}% → {(summary.mastery_end * 100).toFixed(0)}%
                  </span>
                </div>
                <MasteryBar pct={summary.mastery_end * 100} />
              </div>
            )}
            {summary.avg_engagement != null && (
              <div>
                <p className="teacher-eyebrow" style={{ margin: '0 0 10px' }}>Average Engagement</p>
                <MasteryBar pct={summary.avg_engagement * 100} />
              </div>
            )}
          </section>
        ) : null}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="teacher-action primary"
            style={{ minHeight: 'unset', padding: '12px 24px' }}
            onClick={() => {
              setSessionId(null); setSessionEnded(false); setSummary(null)
              setMessages([]); setPhase('skill-pick')
              if (selectedSkill && user?.id) {
                getSessionStatus(selectedSkill).then((s) => {
                  setSkillStatus(s)
                  if (s.mastery != null) setMastery(s.mastery * 100)
                }).catch(() => {})
              }
            }}>
            ← Back to Skills
          </button>
          <button type="button" className="teacher-action"
            style={{ minHeight: 'unset', padding: '12px 24px' }}
            onClick={() => { window.location.href = '/dashboard/student' }}>
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
    <div className="learn-session">
      {/* ── LEFT: Question panel ── */}
      <div className="learn-question-col">
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

      {/* ── RIGHT: Tutor chat panel — one card, one scrollbar ── */}
      <div className="learn-chat-col">
        <div className="teacher-panel learn-chat-card" style={{ ['--chat-font-scale' as any]: fontScale.scale }}>
          {/* Chat header */}
          <div className="learn-chat-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <p className="teacher-eyebrow" style={{ margin: 0, fontSize: 14 }}>AI Tutor</p>
              <span className="status-dot online" title="Tutor ready" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {voiceStatus && (
                <span style={{ fontSize: 15, color: 'var(--accent)', fontStyle: 'italic', fontWeight: 600 }}>
                  🔄 {voiceStatus}
                </span>
              )}
              <ChatFontScale
                percent={fontScale.percent}
                onIncrease={fontScale.increase}
                onDecrease={fontScale.decrease}
                canIncrease={fontScale.canIncrease}
                canDecrease={fontScale.canDecrease}
              />
              {ttsSupported && (
                <>
                  {speaking && (
                    <button
                      type="button"
                      className="learn-tts-btn"
                      onClick={stopSpeaking}
                      title="Stop reading"
                      aria-label="Stop reading aloud"
                    >
                      ⏹
                    </button>
                  )}
                  <button
                    type="button"
                    className={`learn-tts-btn${autoRead ? ' on' : ''}`}
                    onClick={toggleAutoRead}
                    aria-pressed={autoRead}
                    title={autoRead ? 'Read aloud is on — click to mute' : 'Read aloud is off — click to unmute'}
                    aria-label={autoRead ? 'Turn off read aloud' : 'Turn on read aloud'}
                  >
                    {autoRead ? '🔊' : '🔇'}
                  </button>
                </>
              )}
            </div>
          </div>

        {/* Chat messages */}
        <div className="learn-chat-messages" ref={chatScrollRef} onScroll={handleChatScroll}>
          {chatMessages.length === 0 && voiceStreamText === '' && (
            <div className="learn-chat-empty">
              <span className="learn-chat-empty-icon" aria-hidden="true">💬</span>
              <strong>Your tutor is ready</strong>
              <p>
                Answer the question on the left, or ask anything about this
                topic — by text or voice — and the explanation will appear here.
              </p>
            </div>
          )}
          {chatMessages.map((msg) => (
            <ChatBubble
              key={msg.id}
              msg={msg}
              onImageClick={setLightboxSrc}
              onSpeak={ttsSupported ? (m) => speak(speechTextFor(m)) : undefined}
            />
          ))}

            {/* Live LLM streaming from voice pipeline */}
            {voiceStreamText && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <span style={{ fontSize: fs(13), color: 'var(--muted)' }}>Tutor AI · live</span>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, borderBottomLeftRadius: 4,
                  padding: '14px 18px', maxWidth: '92%',
                }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: fs(16), color: 'var(--text)', textAlign: 'justify' }}>
                    {voiceStreamText}
                  </p>
                </div>
              </div>
            )}

            {(loading || pendingAnswer) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, borderBottomLeftRadius: 4,
                  padding: '14px 18px', color: 'var(--muted)', fontStyle: 'italic', fontSize: fs(15),
                }}>
                  Thinking…
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {error && <p className="feedback error" style={{ margin: '0 22px', flexShrink: 0 }}>{error}</p>}

          {/* Input + voice — pinned inside the same card, below the message list */}
          <div className="learn-chat-card-input">
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                rows={2}
                className="learn-chat-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  voiceState === 'recording' ? '🎙️ Recording… click Stop when done'
                  : voiceState === 'processing' ? '⏳ Processing voice…'
                  : 'Ask the tutor anything — or use the mic'
                }
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                disabled={loading || pendingAnswer || voiceState !== 'idle'}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Text send */}
                <button type="button" className="teacher-action primary"
                  onClick={handleSend}
                  disabled={!input.trim() || loading || pendingAnswer || voiceState !== 'idle'}
                  style={{ minHeight: 'unset', padding: '12px 22px', fontSize: 16 }}>
                  Send
                </button>

                {/* Voice button */}
                {voiceState === 'idle' && (
                  <button type="button" className="teacher-action" onClick={startVoiceRecording}
                    title="Start voice input"
                    style={{ minHeight: 'unset', padding: '10px 18px', fontSize: 18, justifyContent: 'center' }}>
                    🎙️
                  </button>
                )}
                {voiceState === 'recording' && (
                  <button type="button" className="teacher-action"
                    onClick={stopVoiceRecording}
                    style={{ minHeight: 'unset', padding: '10px 18px', fontSize: 15, color: 'var(--danger)', borderColor: 'var(--danger)', animation: 'pulse 1s infinite' }}>
                    ⏹ Stop
                  </button>
                )}
                {voiceState === 'processing' && (
                  <button type="button" className="teacher-action" disabled
                    style={{ minHeight: 'unset', padding: '10px 18px', fontSize: 15, opacity: 0.5 }}>
                    ⏳
                  </button>
                )}
              </div>
            </div>
            <p style={{ fontSize: 14, marginTop: 8, margin: '8px 0 0', color: 'var(--muted)' }}>
              {voiceState === 'recording'
                ? 'Speak now — click Stop when done · Cancel: refresh page'
                : 'Enter to send · 🎙️ for voice input '}
            </p>
          </div>
        </div>
      </div>

      <video ref={videoRef} playsInline muted style={{ display: 'none' }} />

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc('')} />}

      {breakDue && <StudyBreakModal onResume={resetBreak} />}
    </div>
  )
}
