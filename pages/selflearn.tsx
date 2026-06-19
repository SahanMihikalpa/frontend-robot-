import { useEffect, useRef, useState } from 'react'
import {
  slStartSession, slSendMessage, slGetMastery, slGetProgress,
  slGetProviders, slResumeSession, slCreatePack,
} from '../lib/api'

// One transcript entry as persisted by the backend (learning_messages).
type LMsg = {
  id: number | string
  sender: 'TUTOR' | 'STUDENT' | 'SYSTEM'
  type: 'TEACH' | 'MESSAGE' | 'CHECK' | 'ANSWER' | 'FEEDBACK'
  content: string
  metadata?: Record<string, any> | null
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
  concepts_total: number; concepts_mastered: number; documents: PackDoc[]
}

function uid() { return 'tmp-' + Math.random().toString(36).slice(2) }

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
  const [view, setView] = useState<'start' | 'session'>('start')
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

  const scrollRef = useRef<HTMLDivElement>(null)

  function loadCourses() {
    slGetProgress().then((c) => setCourses(Array.isArray(c) ? c : [])).catch(() => {})
  }

  useEffect(() => {
    slGetProviders().then((p) => { setProviders(p); setProvider(p?.teaching_default || '') }).catch(() => {})
    loadCourses()
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

  function enterSession(res: any) {
    setSessionId(res.session_id); setSkill(res.skill); setView('session')
    setReport(null); setDraft('')
    setMessages(Array.isArray(res.transcript) ? res.transcript : [])
    setPendingCheck(res.pending_check || null)
    setLevel(res.level || '')
    setConceptMastery(typeof res.mastery === 'number' ? res.mastery : null)
    setDone(!!res.completed)
  }

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
      enterSession(await slStartSession({
        topic: val, teaching_provider: provider || undefined, dynamic_skill_id: skillId,
      }))
    } catch (e) { setError(errDetail(e)); setPackMsg('') } finally { setLoading(false) }
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

  // ── START VIEW ──────────────────────────────────────────────────────────────
  if (view === 'start') {
    return (
      <div className="selflearn-page">
        <section className="history-hero">
          <div>
            <p className="teacher-eyebrow">Self-Paced Learning</p>
            <h2 className="editorial-title">Learn Anything</h2>
            <p>
              Tell the tutor what you want to learn. It teaches you in a back-and-forth conversation —
              ask questions any time — and quietly checks your understanding to track your mastery.
            </p>
          </div>
          <div className="history-subject-card">
            <span>Courses</span>
            <strong>{courses.length}</strong>
          </div>
        </section>

        {error && (
          <p className="feedback error">
            {error}
            {error.includes('sign in') && <a href="/login" style={{ marginLeft: 8 }}>Sign in</a>}
          </p>
        )}

        <section className="history-panel">
          <div className="skills-panel-header">
            <div>
              <p className="teacher-eyebrow">New Course</p>
              <h3 className="editorial-title">What do you want to learn?</h3>
            </div>
          </div>

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
              <label>Course material <span className="meta" style={{ fontWeight: 400 }}>(optional — PDF, TXT, MD)</span></label>
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
        </section>

        <section className="history-panel">
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
              <p className="meta">Start a new topic above to begin your first course.</p>
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
                              <div key={i} className="selflearn-concept-row">
                                <span className="selflearn-concept-name">
                                  {cc.mastered ? '✅' : '•'} {cc.concept} <span className="meta">({cc.level})</span>
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
      </div>
    )
  }

  // ── SESSION VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="selflearn-page selflearn-session-page">
      <section className="history-hero selflearn-session-hero">
        <div>
          <button className="btn ghost small" onClick={() => { setView('start'); loadCourses() }}>← New topic</button>
          <h2 className="editorial-title selflearn-session-title">{skill?.canonical_name || 'Learning'}</h2>
          {level && <span className="history-result-pill success">{level}</span>}
        </div>
        <div className="history-subject-card selflearn-session-status">
          <span>Concept Mastery</span>
          {conceptMastery != null && (
            <strong className="selflearn-session-pct">{Math.round(conceptMastery * 100)}%</strong>
          )}
          <button className="btn ghost small selflearn-report-btn" onClick={openReport}>📊 Mastery report</button>
        </div>
      </section>

      {report && (
        <section className="history-panel">
          <div className="skills-panel-header">
            <div>
              <p className="teacher-eyebrow">Report</p>
              <h3 className="editorial-title">Mastery report — {(report.overall_mastery * 100).toFixed(0)}%</h3>
            </div>
            <button className="btn ghost small" onClick={() => setReport(null)}>✕</button>
          </div>
          <div className="selflearn-concept-list">
            {(report.concepts || []).map((c: any, i: number) => (
              <div key={i} className="selflearn-concept-row">
                <span className="selflearn-concept-name">{c.mastered ? '✅' : '•'} {c.concept} <span className="meta">({c.level})</span></span>
                <div className="selflearn-concept-bar"><MasteryBar pct={c.mastery * 100} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="history-panel">
        <div className="skills-panel-header">
          <div>
            <p className="teacher-eyebrow">Conversation</p>
            <h3 className="editorial-title">Lesson</h3>
          </div>
        </div>

        <div ref={scrollRef} className="selflearn-chat-window">
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
                    <strong className={correct ? 'selflearn-feedback-correct' : 'selflearn-feedback-incorrect'}>
                      {correct ? '✓ Correct' : '✗ Not quite'}
                    </strong>
                    {m.content && <p className="selflearn-feedback-text">{m.content}</p>}
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
                  <p className="meta selflearn-detail-label">Quick check</p>
                  <p className="selflearn-check-text">{m.content}</p>
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
            return (
              <div key={m.id} className="chat-bubble assistant selflearn-bubble">
                {m.metadata?.concept && <p className="meta selflearn-detail-label">Tutor · {m.metadata.concept}</p>}
                <p className="selflearn-teach-text">{m.content}</p>
              </div>
            )
          })}

          {loading && <div className="chat-bubble assistant selflearn-bubble selflearn-thinking">Thinking…</div>}
          {done && <div className="selflearn-complete-row"><span className="history-result-pill success">Topic complete 🎉</span></div>}
        </div>

        {/* Always-on chat input: ask anything, or type your answer to a check. */}
        {!done && (
          <div className="selflearn-composer">
            {pendingCheck && (
              <p className="meta selflearn-pending-hint">
                {pendingCheck.qtype === 'mcq'
                  ? 'Pick an option above, or type the letter (A/B/C/D).'
                  : 'Answer the check above, or keep the conversation going.'}
              </p>
            )}
            <div className="selflearn-composer-row">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft) } }}
                placeholder={pendingCheck ? 'Type your answer…' : 'Ask a question, or say "go on"…'}
                disabled={loading}
              />
              <button className="btn" onClick={() => send(draft)} disabled={loading || !draft.trim()}>Send</button>
            </div>
          </div>
        )}

        {error && (
          <p className="feedback error selflearn-error">
            {error}{error.includes('sign in') && <a href="/login" style={{ marginLeft: 8 }}>Sign in</a>}
          </p>
        )}
      </section>
    </div>
  )
}
