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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label && <span className="meta" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{label}</span>}
      <div className="progress" style={{ flex: 1, height: 6 }}><span style={{ width: `${c}%` }} /></div>
      <span style={{ fontSize: 12, minWidth: 34, textAlign: 'right' }}>{c.toFixed(0)}%</span>
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
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 4 }}>Learn Anything</h2>
        <p className="meta" style={{ marginTop: 0 }}>
          Tell the tutor what you want to learn. It teaches you in a back-and-forth conversation —
          ask questions any time — and quietly checks your understanding to track your mastery.
        </p>

        {error && (
          <div className="card" style={{ marginTop: 12, borderColor: 'rgba(239,68,68,0.4)' }}>
            <span style={{ color: '#dc2626', fontSize: 13 }}>{error}</span>
            {error.includes('sign in') && (
              <a href="/login" className="btn small" style={{ marginLeft: 12 }}>Sign in</a>
            )}
          </div>
        )}

        <div className="card" style={{ marginTop: 16 }}>
          <div className="field">
            <label>What do you want to learn?</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') start() }}
              placeholder="e.g. Cloud Computing, Neural Networks, Photosynthesis…"
            />
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Course material <span className="meta" style={{ fontWeight: 400 }}>(optional — PDF, TXT, MD)</span></label>
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <div className="meta" style={{ fontSize: 12, marginTop: 4 }}>
              {files.length > 0
                ? `${files.length} file${files.length === 1 ? '' : 's'} selected — the tutor will follow your material and teach within its scope.`
                : 'Upload your slides/notes to scope the course to your syllabus. Leave empty to learn from a generated course.'}
            </div>
          </div>

          {packMsg && (
            <div className="meta" style={{ fontSize: 12, marginTop: 8, color: 'var(--accent, #6366f1)' }}>{packMsg}</div>
          )}

          {providers && providers.available.length > 1 && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Teaching voice</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                {providers.available.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          )}

          <button className="btn" style={{ marginTop: 14 }} onClick={() => start()} disabled={loading || !topic.trim()}>
            {loading ? 'Building your course…' : 'Start learning'}
          </button>
        </div>

        {courses.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 8 }}>Your learning</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {courses.map((c) => {
                const rep = breakdown[c.session_id]
                const isOpen = expanded === c.session_id
                return (
                  <div key={c.session_id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>{c.topic}</strong>
                        {c.is_private && <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>your material</span>}
                        <div className="meta" style={{ fontSize: 12, marginTop: 2 }}>
                          {c.phase === 'complete' ? 'Completed' : `In progress · ${c.current_level}`}
                          {' · '}{c.concepts_mastered}/{c.concepts_total} concepts mastered
                        </div>
                        <div style={{ marginTop: 8, maxWidth: 320 }}>
                          <MasteryBar pct={c.overall_mastery * 100} label="Overall" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button className="btn small secondary" onClick={() => resume(c.session_id)} disabled={loading}>
                          {resumingId === c.session_id ? 'Loading…' : (c.phase === 'complete' ? 'Review' : 'Continue')}
                        </button>
                        <button className="btn ghost small" onClick={() => toggleExpand(c)}>
                          {isOpen ? 'Hide details' : 'View details'}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border, rgba(0,0,0,0.08))', paddingTop: 12 }}>
                        {c.documents.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div className="meta" style={{ fontSize: 12, marginBottom: 4 }}>Course material</div>
                            {c.documents.map((d, i) => (
                              <div key={i} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span>{d.status === 'ingested' ? '📄' : '⚠️'}</span>
                                <span style={{ flex: 1 }}>{d.filename}</span>
                                <span className="meta" style={{ fontSize: 11 }}>
                                  {d.status === 'ingested' ? `${d.chunk_count} chunks` : (d.warning || d.status)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="meta" style={{ fontSize: 12, marginBottom: 4 }}>Concepts</div>
                        {rep ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(rep.concepts || []).map((cc: any, i: number) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ flex: 1, fontSize: 13 }}>
                                  {cc.mastered ? '✅' : '•'} {cc.concept} <span className="meta">({cc.level})</span>
                                </span>
                                <div style={{ width: 130 }}><MasteryBar pct={cc.mastery * 100} /></div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="meta" style={{ fontSize: 13 }}>Loading concepts…</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── SESSION VIEW ────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <button className="btn ghost small" onClick={() => { setView('start'); loadCourses() }}>← New topic</button>
          <h2 style={{ margin: '4px 0 0' }}>{skill?.canonical_name || 'Learning'}</h2>
          {level && <span className="badge">{level}</span>}
        </div>
        <div style={{ minWidth: 200 }}>
          {conceptMastery != null && <MasteryBar pct={conceptMastery * 100} label="Concept" />}
          <button className="btn ghost small" style={{ marginTop: 6 }} onClick={openReport}>📊 Mastery report</button>
        </div>
      </div>

      {report && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Mastery report — overall {(report.overall_mastery * 100).toFixed(0)}%</strong>
            <button className="btn ghost small" onClick={() => setReport(null)}>✕</button>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(report.concepts || []).map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13 }}>{c.mastered ? '✅' : '•'} {c.concept} <span className="meta">({c.level})</span></span>
                <div style={{ width: 140 }}><MasteryBar pct={c.mastery * 100} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="card" style={{ marginTop: 12, maxHeight: '56vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && !loading && (
          <div className="meta" style={{ textAlign: 'center', fontSize: 13 }}>The lesson will appear here.</div>
        )}
        {messages.map((m) => {
          // Student turns (their messages and submitted answers).
          if (m.sender === 'STUDENT') {
            return (
              <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '88%' }}>
                <div className="chat-bubble user">{m.content}</div>
              </div>
            )
          }
          // Graded feedback on a check.
          if (m.type === 'FEEDBACK') {
            const correct = !!m.metadata?.is_correct
            const mastery = typeof m.metadata?.mastery === 'number' ? m.metadata.mastery : null
            return (
              <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
                <div className="chat-bubble assistant" style={{
                  background: correct ? 'rgba(74,222,128,0.10)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${correct ? 'rgba(74,222,128,0.35)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  <strong style={{ color: correct ? '#16a34a' : '#dc2626' }}>{correct ? '✓ Correct' : '✗ Not quite'}</strong>
                  {m.content && <p style={{ margin: '4px 0 8px', fontSize: 14, lineHeight: 1.5 }}>{m.content}</p>}
                  {mastery != null && <MasteryBar pct={mastery * 100} label="Mastery" />}
                </div>
              </div>
            )
          }
          // A comprehension check posed by the tutor.
          if (m.type === 'CHECK') {
            const isActive = pendingCheck?.question_id === m.metadata?.question_id
            return (
              <div key={m.id} className="chat-bubble assistant" style={{ maxWidth: '92%', borderColor: 'var(--accent, #6366f1)' }}>
                <div className="meta" style={{ fontSize: 11, marginBottom: 4 }}>Quick check</div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: 14, fontWeight: 600 }}>{m.content}</p>
                {isActive && m.metadata?.qtype === 'mcq' && m.metadata?.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    {Object.entries(m.metadata.options as Record<string, string>).map(([k, v]) => (
                      <button key={k} type="button" className="btn secondary"
                        style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                        onClick={() => send(k)} disabled={loading}>
                        <strong style={{ marginRight: 8 }}>{k}.</strong> {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          // Default tutor teaching / chat message.
          return (
            <div key={m.id} className="chat-bubble assistant" style={{ maxWidth: '92%' }}>
              {m.metadata?.concept && <div className="meta" style={{ fontSize: 11, marginBottom: 4 }}>Tutor · {m.metadata.concept}</div>}
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>{m.content}</p>
            </div>
          )
        })}

        {loading && <div className="chat-bubble assistant" style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 13 }}>Thinking…</div>}
        {done && <div style={{ textAlign: 'center', marginTop: 8 }}><span className="badge">Topic complete 🎉</span></div>}
      </div>

      {/* Always-on chat input: ask anything, or type your answer to a check. */}
      {!done && (
        <div className="card" style={{ marginTop: 12 }}>
          {pendingCheck && (
            <div className="meta" style={{ fontSize: 12, marginBottom: 6 }}>
              {pendingCheck.qtype === 'mcq'
                ? 'Pick an option above, or type the letter (A/B/C/D).'
                : 'Answer the check above, or keep the conversation going.'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft) } }}
              placeholder={pendingCheck ? 'Type your answer…' : 'Ask a question, or say "go on"…'}
              style={{ flex: 1, minHeight: 46, maxHeight: 140, resize: 'vertical' }}
              disabled={loading}
            />
            <button className="btn" onClick={() => send(draft)} disabled={loading || !draft.trim()}>Send</button>
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>
          {error}{error.includes('sign in') && <a href="/login" style={{ marginLeft: 8 }}>Sign in</a>}
        </p>
      )}
    </div>
  )
}
