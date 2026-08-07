import { useEffect, useRef, useState } from 'react'
import {
  slStartSession, slSendMessage, slGetMastery, slGetProgress,
  slGetProviders, slResumeSession, slCreatePack,
  slStartAssessment, slCompleteAssessment, slGetRoadmap, slSkipToConcept,
  slRevisitConcept, slPracticeQuestion, slPracticeAnswer,
  getAuthToken,
} from '../lib/api'
import type { SlAssessmentQuestion, SlRoadmapConcept, SlPracticeQuestion } from '../lib/api'
import ImageLightbox from '../components/ImageLightbox'
import TutorMarkdown from '../components/TutorMarkdown'
import { useSpeech } from '../lib/speech'
import ChatFontScale, { useChatFontScale } from '../components/ChatFontScale'
import { useStudyBreak } from '../components/StudyBreak/useStudyBreak'
import StudyBreakModal from '../components/StudyBreak/StudyBreakModal'

type VoiceState = 'idle' | 'recording' | 'processing'
type SlView = 'start' | 'assessment' | 'session'
type VoiceSource = 'browser' | 'tutor' | 'gemini'

// One transcript entry as persisted by the backend (learning_messages).
type LMsg = {
  id: number | string
  sender: 'TUTOR' | 'STUDENT' | 'SYSTEM'
  type: 'TEACH' | 'MESSAGE' | 'CHECK' | 'ANSWER' | 'FEEDBACK'
  content: string
  metadata?: Record<string, any> | null
  noTts?: boolean          // client-only: skip auto read-aloud (mic pipeline spoke it)
}

type PendingCheck = {
  question_id: number
  qtype: string
  stem: string
  options?: Record<string, string> | null
}

type PackDoc = { filename: string; status: string; chunk_count: number; warning?: string }
type Course = {
  session_id: string; topic: string; is_private: boolean; phase: string; status: string
  current_level: string; last_active_at?: string; overall_mastery: number
  concepts_total: number; concepts_mastered: number; concepts_skipped: number; documents: PackDoc[]
}

function uid() { return 'tmp-' + Math.random().toString(36).slice(2) }

/** Seconds → "m:ss" (or "h:mm:ss" past an hour) for the session timer. */
function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

// One-click replies so the student can advance the lesson (or nudge the tutor) without
// typing "go on" / "continue" every time. Only shown when NO check is pending — while a
// check is pending, anything sent is graded as the answer, so these would count as wrong.
const QUICK_REPLIES: Array<{ label: string; message: string }> = [
  { label: 'Continue', message: 'Please continue.' },
  { label: 'Give an example', message: 'Can you give me an example?' },
  { label: 'Explain more simply', message: 'Can you explain that more simply?' },
  { label: 'Quiz me', message: 'Quiz me on this to check my understanding.' },
  { label: 'Next concept →', message: "I understand this — let's move on to the next concept." },
]

/** Build a displayable data: URL from a base64 image payload in message metadata. */
function extractImageUrl(meta: any): string | undefined {
  const b64 = meta?.image_b64
  if (!b64 || typeof b64 !== 'string') return undefined
  const mime = meta?.image_mime || 'image/png'
  return b64.startsWith('data:') ? b64 : `data:${mime};base64,${b64}`
}

function errDetail(e: any): string {
  if (e?.response?.status === 401) return 'Your session expired — please sign in again.'
  const d = e?.response?.data?.detail
  if (Array.isArray(d)) return d.map((x: any) => x?.msg || JSON.stringify(x)).join('; ')
  return typeof d === 'string' ? d : (e?.message || 'Something went wrong')
}

function MasteryBar({ pct, label }: { pct: number; label?: string }) {
  const c = Math.max(0, Math.min(100, pct))
  return (
    <div className="selflearn-mastery-bar">
      {label && <span className="meta selflearn-mastery-label">{label}</span>}
      <div className="teacher-progress selflearn-mastery-track"><span style={{ width: `${c}%` }} /></div>
      <span className="selflearn-mastery-pct">{c.toFixed(0)}%</span>
    </div>
  )
}

export default function SelfLearn() {
  const [view, setView] = useState<SlView>('start')
  const [topic, setTopic] = useState('')
  const [providers, setProviders] = useState<{ available: string[]; teaching_default: string } | null>(null)
  const [provider, setProvider] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [expanded, setExpanded] = useState<string>('')          // session_id of expanded course
  const [breakdown, setBreakdown] = useState<Record<string, any>>({})  // session_id → mastery report
  const [loading, setLoading] = useState(false)
  const [resumingId, setResumingId] = useState('')
  const [error, setError] = useState('')

  const [sessionId, setSessionId] = useState('')
  const [sessionSeconds, setSessionSeconds] = useState(0)   // time spent this sitting
  const [skill, setSkill] = useState<any>(null)
  const [level, setLevel] = useState('')
  const [conceptMastery, setConceptMastery] = useState<number | null>(null)
  const [messages, setMessages] = useState<LMsg[]>([])
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null)
  const [draft, setDraft] = useState('')
  const [done, setDone] = useState(false)
  const [report, setReport] = useState<any>(null)

  const [files, setFiles] = useState<File[]>([])
  const [packMsg, setPackMsg] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState('')

  // Initial diagnostic assessment (before a new course's first lesson)
  const [assessQs, setAssessQs] = useState<SlAssessmentQuestion[]>([])
  const [assessIdx, setAssessIdx] = useState(0)
  const [assessAnswers, setAssessAnswers] = useState<Array<{ concept_id: number; is_correct: boolean }>>([])
  const [assessSelected, setAssessSelected] = useState<string | null>(null)
  const [assessSkillId, setAssessSkillId] = useState<number | null>(null)
  const [assessSkillName, setAssessSkillName] = useState('')
  const [assessSubmitting, setAssessSubmitting] = useState(false)

  // Roadmap (session view) — concepts with skip-ahead / revisit
  const [roadmap, setRoadmap] = useState<{ concepts: SlRoadmapConcept[]; current_concept_id: number | null } | null>(null)
  const [skipping, setSkipping] = useState(false)

  // Practice modal — answer questions for a skipped concept without a lesson
  const [practiceConcept, setPracticeConcept] = useState<SlRoadmapConcept | null>(null)
  const [practiceQ, setPracticeQ] = useState<SlPracticeQuestion | null>(null)
  const [practiceBusy, setPracticeBusy] = useState(false)
  const [practicePicked, setPracticePicked] = useState('')
  const [practiceDraft, setPracticeDraft] = useState('')
  const [practiceResult, setPracticeResult] =
    useState<{ is_correct: boolean; feedback: string; mastery: number; mastered: boolean } | null>(null)
  const [practiceError, setPracticeError] = useState('')

  // Study-break reminder — accrues while actively in a lesson; pops an unskippable
  // break every 30 min (shared with the Learn page).
  const { breakDue, resetBreak } = useStudyBreak(view === 'session' && !done)

  // Per-sitting study timer for the session view. Counts only while the lesson is
  // open, the tab is visible, and no break modal is up — so it reflects real time on task.
  useEffect(() => {
    if (view !== 'session' || done) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !breakDue) setSessionSeconds((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [view, done, breakDue])

  // Read-aloud: tutor messages are spoken as they arrive. The browser's own
  // engine does it by default (free, offline); "tutor voice" and "Gemini voice"
  // route through the server (an API call per message) — the former matches the
  // voice the mic pipeline replies in, the latter uses Gemini TTS.
  const [autoRead, setAutoRead] = useState(true)
  const [voiceSource, setVoiceSource] = useState<VoiceSource>('browser')
  const { supported: ttsSupported, speaking, speak, stop: stopSpeaking } = useSpeech({
    endpoint: '/api/v1/selflearn/voice/tts',
    preferServer: voiceSource === 'tutor' || voiceSource === 'gemini',
    serverProvider: voiceSource === 'gemini' ? 'gemini' : undefined,
  })
  const spokenRef = useRef<Set<string>>(new Set())

  const fontScale = useChatFontScale('selflearn_chat_font_scale')

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceStatus, setVoiceStatus] = useState('')
  const voiceWsRef = useRef<WebSocket | null>(null)
  const voiceRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceMicStreamRef = useRef<MediaStream | null>(null)
  const audioQueueRef = useRef<ArrayBuffer[]>([])
  const audioPlayingRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  function loadCourses() {
    slGetProgress().then((c) => setCourses(Array.isArray(c) ? c : [])).catch(() => {})
  }

  useEffect(() => {
    slGetProviders().then((p) => { setProviders(p); setProvider(p?.teaching_default || '') }).catch(() => {})
    loadCourses()
    try {
      setAutoRead(window.localStorage.getItem('selflearn_auto_read') !== '0')
      const savedVoice = window.localStorage.getItem('selflearn_voice_source')
      if (savedVoice === 'tutor' || savedVoice === 'gemini') setVoiceSource(savedVoice)
    } catch { /* storage unavailable — keep defaults */ }
  }, [])

  async function toggleExpand(c: Course) {
    if (expanded === c.session_id) { setExpanded(''); return }
    setExpanded(c.session_id)
    if (!breakdown[c.session_id]) {
      try {
        const rep = await slGetMastery(c.session_id)
        setBreakdown((b) => ({ ...b, [c.session_id]: rep }))
      } catch { /* leave collapsed content empty on error */ }
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pendingCheck, loading])

  // Progress sidebar shows the roadmap at all times — no click needed — so
  // fetch it as soon as a session is entered, and again each time a check is
  // graded or the student skips (mastery / position may have moved).
  useEffect(() => {
    if (sessionId) { openReport(); loadRoadmap() }
  }, [sessionId, messages.length])

  // ── Read aloud ──────────────────────────────────────────────────────────────

  /** What the voice says for a tutor message — mirrors the backend's
   *  `_spoken_parts`, so typed turns sound like spoken ones. */
  function speechTextFor(m: LMsg): string {
    const body = (m.content || '').trim()
    if (m.type === 'FEEDBACK') {
      const correct = m.metadata?.is_correct
      const prefix = correct === true ? 'Correct! ' : correct === false ? 'Not quite. ' : ''
      return prefix + body
    }
    if (m.type === 'CHECK') {
      const options = m.metadata?.options as Record<string, string> | undefined
      const opts = options && Object.keys(options).length
        ? ` Your options are: ${Object.entries(options).map(([k, v]) => `${k}. ${v}`).join('. ')}`
        : ''
      return `Quick check: ${body}${opts}`
    }
    return body
  }

  // Speak each new tutor message once. Messages the mic pipeline already spoke
  // are skipped, as is restored history (marked spoken in enterSession).
  useEffect(() => {
    if (!autoRead || view !== 'session') return
    const pending = messages.filter((m) =>
      m.sender === 'TUTOR' && !m.noTts &&
      (m.content || '').trim() && !spokenRef.current.has(String(m.id)),
    )
    if (pending.length === 0) return
    pending.forEach((m) => spokenRef.current.add(String(m.id)))
    const text = pending.map(speechTextFor).filter(Boolean).join('. ')
    if (text) speak(text)
  }, [messages, autoRead, view])

  function toggleAutoRead() {
    setAutoRead((prev) => {
      const next = !prev
      try { window.localStorage.setItem('selflearn_auto_read', next ? '1' : '0') } catch { /* ignore */ }
      if (!next) stopSpeaking()
      return next
    })
  }

  function changeVoiceSource(next: VoiceSource) {
    stopSpeaking()
    setVoiceSource(next)
    try { window.localStorage.setItem('selflearn_voice_source', next) } catch { /* ignore */ }
  }

  function enterSession(res: any) {
    setSessionId(res.session_id); setSkill(res.skill); setView('session')
    setReport(null); setDraft(''); setSessionSeconds(0)
    const restored: LMsg[] = Array.isArray(res.transcript) ? res.transcript : []
    // Don't replay the whole transcript on resume — only speak what arrives next.
    stopSpeaking()
    spokenRef.current = new Set(restored.map((m) => String(m.id)))
    setMessages(restored)
    setPendingCheck(res.pending_check || null)
    setLevel(res.level || '')
    setConceptMastery(typeof res.mastery === 'number' ? res.mastery : null)
    setDone(!!res.completed)
  }

  // Build the course (concept map + optional material pack), then offer the
  // diagnostic quiz. If the course has no gradeable questions, fall straight
  // through to the session.
  async function start(t?: string) {
    const val = (t ?? topic).trim()
    if (!val || loading) return
    setLoading(true); setError(''); setPackMsg('')
    try {
      let skillId: number | undefined
      // With uploaded material, build a private course-pack skill first, then start on it.
      if (files.length > 0) {
        setPackMsg('Reading your material…')
        const pack = await slCreatePack({ topic: val, files })
        skillId = pack.skill.id
        const skipped = pack.documents.filter((d) => d.status !== 'ingested')
        const bits = [`Built your course from ${pack.ingested} file${pack.ingested === 1 ? '' : 's'} (${pack.concepts} concepts).`]
        if (skipped.length) bits.push(`${skipped.length} skipped — ${skipped.map((d) => `${d.filename}: ${d.warning || d.status}`).join('; ')}`)
        setPackMsg(bits.join(' '))
      }
      setPackMsg((m) => m ? m + ' Preparing a quick placement quiz…' : 'Preparing a quick placement quiz…')
      const res = await slStartAssessment({ topic: val, teaching_provider: provider || undefined, dynamic_skill_id: skillId })
      if (!res.questions || res.questions.length === 0) {
        // No gradeable questions — skip the diagnostic, start the session directly.
        enterSession(await slStartSession({ topic: val, teaching_provider: provider || undefined, dynamic_skill_id: res.dynamic_skill_id }))
        return
      }
      setAssessQs(res.questions)
      setAssessIdx(0)
      setAssessAnswers([])
      setAssessSelected(null)
      setAssessSkillId(res.dynamic_skill_id)
      setAssessSkillName(res.skill?.canonical_name || val)
      setPackMsg('')
      setView('assessment')
    } catch (e) { setError(errDetail(e)); setPackMsg('') } finally { setLoading(false) }
  }

  // ── Diagnostic assessment ────────────────────────────────────────────────────
  function answerAssessment(key: string) {
    if (assessSelected) return
    setAssessSelected(key)
  }

  async function nextAssessment() {
    const q = assessQs[assessIdx]
    const isCorrect = assessSelected === q.correct_answer
    const answers = [...assessAnswers, { concept_id: q.concept_id, is_correct: isCorrect }]
    setAssessAnswers(answers)

    if (assessIdx + 1 < assessQs.length) {
      setAssessIdx((i) => i + 1)
      setAssessSelected(null)
      return
    }
    // Last question → grade + seed mastery + start the session.
    setAssessSubmitting(true)
    setError('')
    try {
      if (assessSkillId != null) {
        await slCompleteAssessment({ dynamic_skill_id: assessSkillId, answers })
      }
      enterSession(await slStartSession({
        topic: assessSkillName, teaching_provider: provider || undefined,
        dynamic_skill_id: assessSkillId ?? undefined,
      }))
    } catch (e) { setError(errDetail(e)) } finally { setAssessSubmitting(false) }
  }

  async function skipAssessment() {
    if (assessSubmitting || loading) return
    setAssessSubmitting(true)
    setError('')
    try {
      enterSession(await slStartSession({
        topic: assessSkillName, teaching_provider: provider || undefined,
        dynamic_skill_id: assessSkillId ?? undefined,
      }))
    } catch (e) { setError(errDetail(e)) } finally { setAssessSubmitting(false) }
  }

  // ── Roadmap / skip-ahead ─────────────────────────────────────────────────────
  async function loadRoadmap() {
    try { setRoadmap(await slGetRoadmap(sessionId)) } catch { /* keep last roadmap on error */ }
  }

  async function skipTo(conceptId: number) {
    if (skipping || loading || done) return
    setSkipping(true); setError('')
    try {
      const res = await slSkipToConcept({ session_id: sessionId, concept_id: conceptId })
      const incoming: LMsg[] = Array.isArray(res.messages) ? res.messages : []
      setMessages((p) => [...p, ...incoming])
      setPendingCheck(res.pending_check || null)
      if (typeof res.mastery === 'number') setConceptMastery(res.mastery)
      if (res.level) setLevel(res.level)
      await loadRoadmap()
    } catch (e) { setError(errDetail(e)) } finally { setSkipping(false) }
  }

  // Return to a skipped concept and learn it normally (re-teach + checks).
  async function revisitTo(conceptId: number) {
    if (skipping || loading) return
    setSkipping(true); setError('')
    try {
      const res = await slRevisitConcept({ session_id: sessionId, concept_id: conceptId })
      const incoming: LMsg[] = Array.isArray(res.messages) ? res.messages : []
      setMessages((p) => [...p, ...incoming])
      setPendingCheck(res.pending_check || null)
      if (typeof res.mastery === 'number') setConceptMastery(res.mastery)
      if (res.level) setLevel(res.level)
      setDone(false)          // re-opens the lesson on the revisited concept
      await loadRoadmap()
    } catch (e) { setError(errDetail(e)) } finally { setSkipping(false) }
  }

  // ── Practice a skipped concept (answer questions only, no teaching) ───────────
  async function openPractice(c: SlRoadmapConcept) {
    setPracticeConcept(c)
    setPracticeQ(null); setPracticeResult(null); setPracticePicked(''); setPracticeDraft(''); setPracticeError('')
    await loadPracticeQuestion(c.concept_id)
  }

  async function loadPracticeQuestion(conceptId: number) {
    setPracticeBusy(true); setPracticeError('')
    setPracticeResult(null); setPracticePicked(''); setPracticeDraft('')
    try {
      setPracticeQ(await slPracticeQuestion({ session_id: sessionId, concept_id: conceptId }))
    } catch (e) { setPracticeError(errDetail(e)); setPracticeQ(null) }
    finally { setPracticeBusy(false) }
  }

  async function submitPractice(answer: string) {
    const val = answer.trim()
    if (!practiceQ || practiceBusy || practiceResult || !val) return
    setPracticePicked(answer)
    setPracticeBusy(true); setPracticeError('')
    try {
      const res = await slPracticeAnswer({ session_id: sessionId, question_id: practiceQ.question_id, answer: val })
      setPracticeResult(res)
      if (practiceConcept) setPracticeConcept({ ...practiceConcept, mastery: res.mastery, skipped: !res.mastered })
      if (res.completed) setDone(true)   // practising the last piece can finish the course
      await loadRoadmap()     // mastery moved — refresh the sidebar
    } catch (e) { setPracticeError(errDetail(e)) }
    finally { setPracticeBusy(false) }
  }

  function closePractice() {
    setPracticeConcept(null); setPracticeQ(null); setPracticeResult(null)
    setPracticePicked(''); setPracticeDraft(''); setPracticeError('')
    loadRoadmap()
  }

  async function resume(id: string) {
    if (loading) return
    setLoading(true); setResumingId(id); setError('')
    try { enterSession(await slResumeSession(id)) }
    catch (e) { setError(errDetail(e)) } finally { setLoading(false); setResumingId('') }
  }

  // The single conversational action: free chat OR answering a pending check.
  async function send(text: string) {
    const val = text.trim()
    if (!val || loading || done) return
    setError('')
    // Optimistic student bubble.
    const optimistic: LMsg = {
      id: uid(), sender: 'STUDENT',
      type: pendingCheck ? 'ANSWER' : 'MESSAGE', content: val,
    }
    setMessages((p) => [...p, optimistic])
    setDraft('')
    setLoading(true)
    try {
      const res = await slSendMessage({ session_id: sessionId, content: val })
      // res.messages[0] is the persisted student message — skip it (already shown optimistically).
      const incoming: LMsg[] = Array.isArray(res.messages) ? res.messages.slice(1) : []
      setMessages((p) => [...p, ...incoming])
      setPendingCheck(res.pending_check || null)
      if (typeof res.mastery === 'number') setConceptMastery(res.mastery)
      if (res.level) setLevel(res.level)
      if (res.completed) setDone(true)
    } catch (e) {
      setError(errDetail(e))
      // Roll back the optimistic bubble on failure.
      setMessages((p) => p.filter((m) => m.id !== optimistic.id))
    } finally { setLoading(false) }
  }

  async function openReport() {
    try { setReport(await slGetMastery(sessionId)) } catch (e) { setError(errDetail(e)) }
  }

  // ── Voice pipeline (mic → STT → tutor turn → TTS) ───────────────────────────

  function wsVoiceUrl(sid: string) {
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000')
      .replace(/^https/, 'wss').replace(/^http/, 'ws').replace(/\/$/, '')
    return `${base}/api/v1/selflearn/voice/ws/${sid}?token=${getAuthToken()}`
  }

  function playAudioChunk(b64: string) {
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

  async function startVoiceRecording() {
    if (!sessionId || voiceState !== 'idle' || done) return
    stopSpeaking()   // don't talk over the student
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceMicStreamRef.current = micStream

      const ws = new WebSocket(wsVoiceUrl(sessionId))
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
              // Show the spoken words as the student's bubble
              setMessages((p) => [...p, {
                id: uid(), sender: 'STUDENT',
                type: pendingCheck ? 'ANSWER' : 'MESSAGE', content: data.text,
              }])
              break
            case 'messages': {
              // Same payload as slSendMessage — messages[0] is the student echo.
              // noTts: the pipeline streams its own spoken audio back for these,
              // so read-aloud must not speak them a second time.
              const incoming: LMsg[] = Array.isArray(data.messages)
                ? data.messages.slice(1).map((m: LMsg) => ({ ...m, noTts: true }))
                : []
              setMessages((p) => [...p, ...incoming])
              setPendingCheck(data.pending_check || null)
              if (typeof data.mastery === 'number') setConceptMastery(data.mastery)
              if (data.level) setLevel(data.level)
              if (data.completed) setDone(true)
              break
            }
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

  // Tear the voice connection down when leaving the session view / unmounting
  useEffect(() => {
    return () => {
      try { voiceRecorderRef.current?.stop() } catch { /* already inactive */ }
      voiceMicStreamRef.current?.getTracks().forEach((t) => t.stop())
      voiceWsRef.current?.close()
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  // ── START VIEW ──────────────────────────────────────────────────────────────
  if (view === 'start') {
    return (
      <div className="teacher-dashboard student-dash selflearn-page">
        {error && (
          <p className="feedback error">
            {error}
            {error.includes('sign in') && <a href="/login" style={{ marginLeft: 8 }}>Sign in</a>}
          </p>
        )}

        <div className="teacher-layout selflearn-start-layout">
          <section className="teacher-main">
            <section className="teacher-hero">
              <div>
                <p className="teacher-eyebrow">Self-Paced Learning</p>
                <h2 className="editorial-title">Learn Anything</h2>
                <p>
                  Tell the tutor what you want to learn. It teaches you in a back-and-forth conversation —
                  ask questions any time - and quietly checks your understanding to track your mastery.
                </p>
              </div>
              <div className="teacher-hero-note">
                <span>Courses</span>
                <strong>{courses.length}</strong>
                <p>started so far</p>
              </div>
            </section>

            <section className="teacher-panel selflearn-learning-panel">
              <div className="skills-panel-header">
                <div>
                  <p className="teacher-eyebrow">In Progress</p>
                  <h3 className="editorial-title">Your learning</h3>
                </div>
                <span className="skills-count-pill subtle">{courses.length} course{courses.length === 1 ? '' : 's'}</span>
              </div>

              {courses.length === 0 ? (
                <div className="empty-state">
                  <p>No courses yet.</p>
                  <p className="meta">Start a new topic in the panel on the right to begin your first course.</p>
                </div>
              ) : (
                <div className="history-list">
                  {courses.map((c) => {
                    const rep = breakdown[c.session_id]
                    const isOpen = expanded === c.session_id
                    return (
                      <article key={c.session_id} className="history-card selflearn-course-card">
                        <div className="history-card-main">
                          <div className="selflearn-course-title">
                            <h4>{c.topic}</h4>
                            {c.is_private && <span className="history-result-pill success">your material</span>}
                          </div>
                          <div className="selflearn-course-actions">
                            <button className="skills-chip" onClick={() => resume(c.session_id)} disabled={loading}>
                              {resumingId === c.session_id ? 'Loading…' : (c.phase === 'complete' ? 'Review' : 'Continue')}
                            </button>
                            <button className="btn ghost small" onClick={() => toggleExpand(c)}>
                              {isOpen ? 'Hide details' : 'View details'}
                            </button>
                          </div>
                        </div>

                        <p>
                          {c.phase === 'complete' ? 'Completed' : `In progress · ${c.current_level}`}
                          {' · '}{c.concepts_mastered}/{c.concepts_total} concepts mastered
                          {c.concepts_skipped > 0 && (
                            <> · <span className="selflearn-skipped-text">{c.concepts_skipped} skipped</span></>
                          )}
                        </p>

                        <div className="selflearn-course-progress">
                          <MasteryBar pct={c.overall_mastery * 100} label="Overall" />
                        </div>

                        {isOpen && (
                          <div className="selflearn-course-detail">
                            {c.documents.length > 0 && (
                              <div className="selflearn-doc-list">
                                <p className="meta selflearn-detail-label">Course material</p>
                                {c.documents.map((d, i) => (
                                  <div key={i} className="selflearn-doc-row">
                                    <span>{d.status === 'ingested' ? '📄' : '⚠️'}</span>
                                    <span className="selflearn-doc-name">{d.filename}</span>
                                    <span className="meta selflearn-doc-meta">
                                      {d.status === 'ingested' ? `${d.chunk_count} chunks` : (d.warning || d.status)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="meta selflearn-detail-label">Concepts</p>
                            {rep ? (
                              <div className="selflearn-concept-list">
                                {(rep.concepts || []).map((cc: any, i: number) => (
                                  <div key={i} className={`selflearn-concept-row ${cc.skipped ? 'skipped' : ''}`}>
                                    <span className="selflearn-concept-name">
                                      {cc.mastered ? '✅' : cc.skipped ? '⏭️' : '•'} {cc.concept} <span className="meta">({cc.level})</span>
                                    </span>
                                    <div className="selflearn-concept-bar"><MasteryBar pct={cc.mastery * 100} /></div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="meta">Loading concepts…</p>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </section>

          <aside className="teacher-actions">
            <p className="teacher-eyebrow">New Course</p>
            <h3 className="editorial-title">What do you want to learn?</h3>

            <div className="selflearn-form">
            <div className="field">
              <label>Topic</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') start() }}
                placeholder="e.g. Cloud Computing, Neural Networks, Photosynthesis…"
              />
            </div>

            <div className="field">
              <label>Course material <span className="meta" style={{ fontWeight: 400, fontSize: 12, textTransform: 'none', letterSpacing: 'normal' }}>(optional — PDF, TXT, MD)</span></label>
              <label className="selflearn-file-drop">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                />
                <span className="selflearn-file-drop-icon">📎</span>
                <span className="selflearn-file-drop-text">
                  {files.length > 0
                    ? `${files.length} file${files.length === 1 ? '' : 's'} selected`
                    : 'Choose files or drag them here'}
                </span>
              </label>
              <p className="meta selflearn-field-hint">
                {files.length > 0
                  ? 'The tutor will follow your material and teach within its scope.'
                  : 'Upload your slides/notes to scope the course to your syllabus. Leave empty to learn from a generated course.'}
              </p>
            </div>

            {packMsg && (
              <p className="meta selflearn-pack-msg">{packMsg}</p>
            )}

            {providers && providers.available.length > 1 && (
              <div className="field">
                <label>Teaching voice</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                  {providers.available.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}

            <button className="btn selflearn-start-btn" onClick={() => start()} disabled={loading || !topic.trim()}>
              {loading ? 'Building your course…' : 'Start learning'}
            </button>
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // ── ASSESSMENT VIEW ─────────────────────────────────────────────────────────
  if (view === 'assessment') {
    const q = assessQs[assessIdx]
    const total = assessQs.length
    const pct = Math.round((assessIdx / total) * 100)
    return (
      <div className="teacher-dashboard student-dash selflearn-page">
        <div className="selflearn-assess-wrap">
          <section className="teacher-panel selflearn-assess-card">
            <div className="selflearn-assess-head">
              <div>
                <p className="teacher-eyebrow" style={{ margin: 0 }}>Placement Quiz</p>
                <h2 className="editorial-title" style={{ margin: '4px 0 0' }}>{assessSkillName}</h2>
              </div>
              <span className="skills-count-pill">{assessIdx + 1} / {total}</span>
            </div>
            <p className="meta selflearn-assess-sub">
              A few quick questions so the tutor starts you at the right place — you'll skip
              anything you already know. Not sure? Just pick your best guess.
            </p>
            <div className="teacher-progress selflearn-assess-progress"><span style={{ width: `${pct}%` }} /></div>

            <div className="selflearn-assess-body">
              <p className="meta selflearn-detail-label">{q.concept_name}</p>
              <p className="selflearn-assess-question">{q.question_text}</p>

              <div className="selflearn-options selflearn-assess-options">
                {Object.entries(q.options || {}).map(([k, v]) => {
                  let cls = 'btn secondary selflearn-option-btn'
                  if (assessSelected) {
                    if (k === q.correct_answer) cls += ' correct'
                    else if (k === assessSelected) cls += ' incorrect'
                  }
                  return (
                    <button key={k} type="button" className={cls}
                      onClick={() => answerAssessment(k)} disabled={!!assessSelected}>
                      <strong className="selflearn-option-key">{k}.</strong> {v}
                    </button>
                  )
                })}
              </div>

              {assessSelected && (
                <p className={`meta selflearn-assess-verdict ${assessSelected === q.correct_answer ? 'ok' : 'no'}`}>
                  {assessSelected === q.correct_answer ? '✓ Correct' : '✗ Not quite'}
                </p>
              )}
            </div>

            {error && <p className="feedback error">{error}</p>}

            <div className="selflearn-assess-actions">
              <button className="btn ghost small" onClick={skipAssessment} disabled={assessSubmitting}>
                Skip quiz →
              </button>
              <button className="btn" onClick={nextAssessment} disabled={!assessSelected || assessSubmitting}>
                {assessSubmitting ? 'Starting…' : assessIdx + 1 < total ? 'Next →' : 'Start learning →'}
              </button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  // ── SESSION VIEW ────────────────────────────────────────────────────────────
  const currentConceptIdx = roadmap?.concepts.find((c) => c.is_current)?.order_index ?? -1

  /** Replay one message on demand — handy after muting, or to hear it again. */
  const speakBtn = (m: LMsg) => ttsSupported ? (
    <button type="button" className="learn-tts-btn small" onClick={() => speak(speechTextFor(m))}
      title="Read this aloud" aria-label="Read this message aloud">🔊</button>
  ) : null
  return (
    <div className="teacher-dashboard student-dash selflearn-session-view">
      <div className="teacher-layout selflearn-session-layout">
        <section className="teacher-main">
          {/* One card holds the topic header, the scrolling conversation, and the
              composer — a single bordered container instead of a separate hero,
              so there's one scrollbar and the input is always reachable without
              scrolling the page. */}
          <section
            className="teacher-panel learn-chat-card selflearn-lesson-card"
            style={{ ['--chat-font-scale' as any]: fontScale.scale }}
          >
            <div className="learn-chat-card-header selflearn-lesson-header">
              <div className="selflearn-lesson-header-title">
                <p className="teacher-eyebrow" style={{ margin: 0 }}>Self-Paced Lesson</p>
                <h2 className="editorial-title">
                  {skill?.canonical_name || 'Learning'}
                  {level && <span className="history-result-pill success selflearn-level-pill">{level}</span>}
                  <span className="selflearn-time-pill" title="Time spent this session">⏱ {fmtTime(sessionSeconds)}</span>
                </h2>
              </div>
              <div className="selflearn-lesson-header-actions">
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
                      <button type="button" className="learn-tts-btn" onClick={stopSpeaking}
                        title="Stop reading" aria-label="Stop reading aloud">⏹</button>
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
                    <select
                      className="selflearn-voice-select"
                      value={voiceSource}
                      onChange={(e) => changeVoiceSource(e.target.value as VoiceSource)}
                      disabled={!autoRead}
                      title="Browser voice reads instantly and offline. Tutor voice matches the voice you hear when you speak. Gemini voice uses Google's Gemini TTS. Tutor and Gemini call the server for each message."
                      aria-label="Read-aloud voice"
                    >
                      <option value="browser">Browser voice</option>
                      <option value="tutor">Tutor voice</option>
                      <option value="gemini">Gemini voice</option>
                    </select>
                  </>
                )}
                <button className="teacher-action selflearn-back-btn" onClick={() => { setView('start'); loadCourses() }}>← New topic</button>
              </div>
            </div>

            <div ref={scrollRef} className="learn-chat-messages selflearn-chat-window">
              {messages.length === 0 && !loading && (
                <div className="empty-state"><p className="meta">The lesson will appear here.</p></div>
              )}
              {messages.map((m) => {
                // Student turns (their messages and submitted answers).
                if (m.sender === 'STUDENT') {
                  return (
                    <div key={m.id} className="selflearn-msg-row student">
                      <div className="chat-bubble user selflearn-bubble">{m.content}</div>
                    </div>
                  )
                }
                // Graded feedback on a check.
                if (m.type === 'FEEDBACK') {
                  const correct = !!m.metadata?.is_correct
                  const mastery = typeof m.metadata?.mastery === 'number' ? m.metadata.mastery : null
                  return (
                    <div key={m.id} className="selflearn-msg-row tutor">
                      <div className={`chat-bubble assistant selflearn-bubble selflearn-feedback ${correct ? 'correct' : 'incorrect'}`}>
                        <div className="selflearn-bubble-head">
                          <strong className={correct ? 'selflearn-feedback-correct' : 'selflearn-feedback-incorrect'}>
                            {correct ? '✓ Correct' : '✗ Not quite'}
                          </strong>
                          {speakBtn(m)}
                        </div>
                        {m.content && <TutorMarkdown text={m.content} className="selflearn-feedback-text" />}
                        {mastery != null && <MasteryBar pct={mastery * 100} label="Mastery" />}
                      </div>
                    </div>
                  )
                }
                // A comprehension check posed by the tutor.
                if (m.type === 'CHECK') {
                  const isActive = pendingCheck?.question_id === m.metadata?.question_id
                  return (
                    <div key={m.id} className="chat-bubble assistant selflearn-bubble selflearn-check">
                      <div className="selflearn-bubble-head">
                        <p className="meta selflearn-detail-label">Quick check</p>
                        {speakBtn(m)}
                      </div>
                      <TutorMarkdown text={m.content} className="selflearn-check-text" />
                      {isActive && m.metadata?.qtype === 'mcq' && m.metadata?.options && (
                        <div className="selflearn-options">
                          {Object.entries(m.metadata.options as Record<string, string>).map(([k, v]) => (
                            <button key={k} type="button" className="btn secondary selflearn-option-btn"
                              onClick={() => send(k)} disabled={loading}>
                              <strong className="selflearn-option-key">{k}.</strong> {v}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                // Default tutor teaching / chat message.
                const imageUrl = extractImageUrl(m.metadata)
                return (
                  <div key={m.id} className="chat-bubble assistant selflearn-bubble">
                    <div className="selflearn-bubble-head">
                      {m.metadata?.concept
                        ? <p className="meta selflearn-detail-label">Tutor · {m.metadata.concept}</p>
                        : <span />}
                      {speakBtn(m)}
                    </div>
                    <TutorMarkdown text={m.content} className="selflearn-teach-text" />
                    {imageUrl && (
                      <div style={{ marginTop: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt="AI-generated visual — click to enlarge"
                          onClick={() => setLightboxSrc(imageUrl)}
                          style={{
                            maxWidth: '100%', maxHeight: 260, borderRadius: 8, display: 'block',
                            border: '1px solid var(--border)', cursor: 'zoom-in',
                          }}
                        />
                        <span style={{ fontSize: 12, marginTop: 4, display: 'block', color: 'var(--muted)' }}>
                          🖼️ {m.metadata?.image_source === 'llm_decision'
                            ? 'The tutor added a visual'
                            : 'Visual generated for you'} — click to enlarge
                        </span>
                      </div>
                    )}
                    {!imageUrl && m.metadata?.image_error && (
                      <p className="meta" style={{ fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                        🖼️ Couldn't generate a visual for this one.
                      </p>
                    )}
                  </div>
                )
              })}

              {loading && <div className="chat-bubble assistant selflearn-bubble selflearn-thinking">Thinking…</div>}
              {done && <div className="selflearn-complete-row"><span className="history-result-pill success">Topic complete 🎉</span></div>}
            </div>

            {error && <p className="feedback error" style={{ margin: '0 22px', flexShrink: 0 }}>{error}{error.includes('sign in') && <a href="/login" style={{ marginLeft: 8 }}>Sign in</a>}</p>}

            {/* Always-on chat input: ask anything, or type your answer to a check —
                pinned inside the same card, below the message list, so it's always
                reachable without scrolling the page. */}
            {!done && (
              <div className="learn-chat-card-input">
                {pendingCheck && voiceState === 'idle' && (
                  <p className="meta selflearn-pending-hint">
                    {pendingCheck.qtype === 'mcq'
                      ? 'Pick an option above, type the letter (A/B/C/D), or say your answer.'
                      : 'Answer the check above, or keep the conversation going.'}
                  </p>
                )}
                {voiceState !== 'idle' && (
                  <p className="meta selflearn-pending-hint">
                    {voiceState === 'recording'
                      ? '🎙️ Recording… click ⏹ when done'
                      : `⏳ ${voiceStatus || 'Processing your voice…'}`}
                  </p>
                )}
                {!pendingCheck && voiceState === 'idle' && (
                  <div className="selflearn-quick-replies">
                    {QUICK_REPLIES.map((qr) => (
                      <button
                        key={qr.label}
                        type="button"
                        className="selflearn-quick-chip"
                        onClick={() => send(qr.message)}
                        disabled={loading}
                        title={qr.message}
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="selflearn-composer-row">
                  <textarea
                    className="learn-chat-textarea"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft) } }}
                    placeholder={pendingCheck ? 'Type your answer…' : 'Ask a question, or say "go on"…'}
                    disabled={loading || voiceState !== 'idle'}
                  />
                  <div className="selflearn-composer-actions">
                    {voiceState === 'recording' ? (
                      <button
                        className="teacher-action selflearn-mic-btn"
                        onClick={stopVoiceRecording}
                        title="Stop recording"
                        style={{ minHeight: 'unset', fontSize: 15, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      >
                        ⏹
                      </button>
                    ) : (
                      <button
                        className="teacher-action selflearn-mic-btn"
                        onClick={startVoiceRecording}
                        disabled={loading || voiceState !== 'idle'}
                        title="Speak to the tutor"
                        style={{ minHeight: 'unset', fontSize: 18, justifyContent: 'center' }}
                      >
                        🎙️
                      </button>
                    )}
                    <button
                      className="teacher-action primary selflearn-send-btn"
                      onClick={() => send(draft)}
                      disabled={loading || !draft.trim() || voiceState !== 'idle'}
                      style={{ minHeight: 'unset', padding: '12px 22px', fontSize: 16 }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>

        {/* Progress sidebar — always shows the concept breakdown, no click
            required, so the student can see where they stand at a glance. */}
        <aside className="teacher-actions selflearn-progress-panel">
          <p className="teacher-eyebrow">Your Progress</p>
          <h3 className="editorial-title">Concept Mastery</h3>

          <div className="selflearn-progress-stat">
            {conceptMastery != null ? (
              <>
                <strong>{Math.round(conceptMastery * 100)}%</strong>
                <div className="teacher-progress"><span style={{ width: `${Math.round(conceptMastery * 100)}%` }} /></div>
              </>
            ) : (
              <p className="meta" style={{ margin: 0 }}>Not enough signal yet — keep going.</p>
            )}
          </div>

          <div className="selflearn-time-row">
            <span className="meta">Time this session</span>
            <strong>⏱ {fmtTime(sessionSeconds)}</strong>
          </div>

          <div className="selflearn-progress-detail">
            <p className="meta selflearn-detail-label" style={{ margin: '0 0 4px' }}>Roadmap</p>
            <p className="meta" style={{ margin: '0 0 14px', fontSize: 11 }}>
              Already know something? Jump ahead — the ones you pass are set aside as
              <span className="selflearn-skipped-text"> skipped</span> (not mastered).
              Come back any time to <strong>Learn</strong> or <strong>Practice</strong> them.
            </p>
            {roadmap ? (
              <div className="selflearn-concept-list">
                {roadmap.concepts.map((c) => {
                  const canSkip = !done && !skipping && !c.is_current && !c.mastered && !c.skipped
                    && c.order_index > currentConceptIdx
                  const icon = c.mastered ? '✅' : c.is_current ? '📍' : c.skipped ? '⏭️' : '•'
                  return (
                    <div key={c.concept_id}
                      className={`selflearn-roadmap-row ${c.is_current ? 'current' : ''} ${c.skipped ? 'skipped' : ''}`}>
                      <div className="selflearn-roadmap-top">
                        <span className="selflearn-concept-name">
                          {icon} {c.name}
                          {c.level && <span className="meta"> ({c.level})</span>}
                        </span>
                        {c.is_current ? (
                          <span className="history-result-pill success selflearn-here-pill">here</span>
                        ) : c.skipped ? (
                          <span className="selflearn-skipped-pill">skipped</span>
                        ) : canSkip ? (
                          <button className="btn ghost small selflearn-skip-btn"
                            onClick={() => skipTo(c.concept_id)} disabled={skipping}>
                            {skipping ? '…' : 'Skip here'}
                          </button>
                        ) : null}
                      </div>
                      <div className="selflearn-concept-bar"><MasteryBar pct={c.mastery * 100} /></div>
                      {c.skipped && (
                        <div className="selflearn-skipped-actions">
                          <button className="btn ghost small" onClick={() => revisitTo(c.concept_id)}
                            disabled={skipping || loading}>
                            {skipping ? '…' : '↩ Learn'}
                          </button>
                          <button className="btn ghost small" onClick={() => openPractice(c)}
                            disabled={skipping || loading}>
                            ✎ Practice
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="meta" style={{ margin: 0 }}>Loading roadmap…</p>
            )}
          </div>
        </aside>
      </div>

      {breakDue && <StudyBreakModal onResume={resetBreak} />}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc('')} />}

      {practiceConcept && (
        <div className="selflearn-practice-overlay" onClick={closePractice}>
          <div className="selflearn-practice-card" onClick={(e) => e.stopPropagation()}>
            <div className="selflearn-practice-head">
              <div>
                <p className="teacher-eyebrow" style={{ margin: 0 }}>Practice</p>
                <h3 className="editorial-title" style={{ margin: '2px 0 0' }}>{practiceConcept.name}</h3>
              </div>
              <button className="btn ghost small" onClick={closePractice}>Close</button>
            </div>
            <p className="meta selflearn-practice-sub">
              Answer questions to raise your mastery — no lesson needed. Reach 85% and it's no
              longer skipped.
            </p>
            <MasteryBar pct={(practiceResult?.mastery ?? practiceConcept.mastery) * 100} label="Mastery" />

            {practiceBusy && !practiceQ ? (
              <p className="meta" style={{ marginTop: 14 }}>Loading a question…</p>
            ) : practiceError && !practiceQ ? (
              <div style={{ marginTop: 14 }}>
                <p className="feedback error">{practiceError}</p>
                <button className="btn secondary" onClick={() => loadPracticeQuestion(practiceConcept.concept_id)}>
                  Try again
                </button>
              </div>
            ) : practiceQ ? (
              <div className="selflearn-practice-body">
                <p className="selflearn-assess-question">{practiceQ.stem}</p>

                {practiceQ.qtype === 'mcq' && practiceQ.options ? (
                  <div className="selflearn-options">
                    {Object.entries(practiceQ.options).map(([k, v]) => {
                      let cls = 'btn secondary selflearn-option-btn'
                      if (practiceResult && k === practicePicked) {
                        cls += practiceResult.is_correct ? ' correct' : ' incorrect'
                      }
                      return (
                        <button key={k} type="button" className={cls}
                          onClick={() => submitPractice(k)}
                          disabled={!!practiceResult || practiceBusy}>
                          <strong className="selflearn-option-key">{k}.</strong> {v}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="selflearn-composer-row">
                    <textarea
                      className="learn-chat-textarea"
                      value={practiceDraft}
                      onChange={(e) => setPracticeDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPractice(practiceDraft) } }}
                      placeholder="Type your answer…"
                      disabled={!!practiceResult || practiceBusy}
                    />
                    {!practiceResult && (
                      <button className="btn" onClick={() => submitPractice(practiceDraft)}
                        disabled={!practiceDraft.trim() || practiceBusy}>
                        {practiceBusy ? '…' : 'Submit'}
                      </button>
                    )}
                  </div>
                )}

                {practiceError && <p className="feedback error" style={{ marginTop: 10 }}>{practiceError}</p>}

                {practiceResult && (
                  <div className={`selflearn-practice-result ${practiceResult.is_correct ? 'ok' : 'no'}`}>
                    <strong>{practiceResult.is_correct ? '✓ Correct' : '✗ Not quite'}</strong>
                    {practiceResult.feedback && <p>{practiceResult.feedback}</p>}
                    {practiceResult.mastered && (
                      <p className="selflearn-practice-mastered">🎉 Mastered — no longer skipped!</p>
                    )}
                    <div className="selflearn-practice-actions">
                      <button className="btn" onClick={() => loadPracticeQuestion(practiceConcept.concept_id)}
                        disabled={practiceBusy}>
                        {practiceBusy ? '…' : 'Next question'}
                      </button>
                      <button className="btn ghost" onClick={closePractice}>Done</button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
