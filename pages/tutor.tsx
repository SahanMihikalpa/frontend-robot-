import { useEffect, useRef, useState } from 'react'
import {
  askTutor, getCurrentUser, getLearningPath, getTutorHints,
  createTutorStreamSocket, getAuthToken,
} from '../lib/api'

type Message = { role: 'user' | 'assistant'; text: string }

function SourceList({ sources }: { sources: any[] }) {
  if (!sources?.length) return null
  return (
    <div className="tutor-source-block">
      <p className="teacher-eyebrow">Sources</p>
      {sources.slice(0, 3).map((s: any, i: number) => (
        <div key={i} className="tutor-source-card">
          <p>
            {s.source || s.document || `Source ${i + 1}`}
            {s.score != null && <span>{(s.score * 100).toFixed(0)}%</span>}
          </p>
        </div>
      ))}
    </div>
  )
}

const QUICK_PROMPTS = [
  'Explain this concept simply.',
  'Give me a worked example.',
  'What are common mistakes here?',
  'How does this connect to other topics?',
]

export default function TutorPage() {
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [useStream, setUseStream] = useState(false)
  const [learningPath, setLearningPath] = useState<any>(null)
  const [lastSources, setLastSources] = useState<any[]>([])
  const [lastAction, setLastAction] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      try {
        const u = await getCurrentUser()
        setUser(u)
        if (u?.id) {
          const lp = await getLearningPath(u.id)
          setLearningPath(lp)
        }
      } catch { /* ignore */ }
    }
    init()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(query: string) {
    if (!query.trim() || loading) return
    const q = query.trim()
    setInput('')
    setError('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setLoading(true)

    if (useStream) {
      const token = getAuthToken() || ''
      setMessages((prev) => [...prev, { role: 'assistant', text: '' }])
      const sock = createTutorStreamSocket(
        { token, userId: user?.id || 0, query: q, domain: 'education' },
        {
          onToken: (tok) => {
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                role: 'assistant',
                text: updated[updated.length - 1].text + tok,
              }
              return updated
            })
          },
          onDone: (data: any) => {
            setLastSources(data.rag_sources || [])
            setLastAction(data.teaching_action || '')
            setLoading(false)
          },
          onError: () => {
            setError('Stream connection failed')
            setLoading(false)
          },
        },
      )
      if (!sock) { setLoading(false); setError('WebSocket not available') }
    } else {
      try {
        const res = await askTutor({ query: q, user_id: user?.id || 0, domain: 'education' })
        const text = typeof res?.response === 'string' ? res.response
          : typeof res?.answer === 'string' ? res.answer
          : typeof res?.message === 'string' ? res.message
          : ''
        setMessages((prev) => [...prev, { role: 'assistant', text }])
        setLastSources(res?.rag_sources || [])
        setLastAction(typeof res?.teaching_action === 'string' ? res.teaching_action : '')
      } catch (err: any) {
        const detail = err?.response?.data?.detail
        const msg = Array.isArray(detail)
          ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
          : typeof detail === 'string' ? detail : 'Tutor request failed'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
  }

  async function getHint() {
    const last = messages.filter((m) => m.role === 'user').pop()
    if (!last) return
    try {
      const h = await getTutorHints({ query: last.text, user_id: user?.id || 0 })
      setMessages((prev) => [...prev, { role: 'assistant', text: h.hint || JSON.stringify(h) }])
    } catch { setError('Could not fetch hint') }
  }

  return (
    <div className="tutor-page">
      <section className="tutor-hero">
        <div>
          <p className="teacher-eyebrow">Guided Learning</p>
          <h2 className="editorial-title">AI Tutor</h2>
          <p>Ask questions, request hints, and get explanations powered by the curriculum knowledge base.</p>
        </div>
        <div className="tutor-status-card">
          <span>Mode</span>
          <strong>{useStream ? 'Stream' : 'Chat'}</strong>
          <p>{user?.full_name || user?.username || 'Learner session'}</p>
        </div>
      </section>

      <div className="tutor-layout">
        <section className="tutor-chat-panel">
          <div className="skills-panel-header">
            <div>
              <p className="teacher-eyebrow">Conversation</p>
              <h3 className="editorial-title">Tutor workspace</h3>
            </div>
            <span className="skills-count-pill">LLM</span>
          </div>

          <div className="tutor-chat-window">
            {messages.length === 0 && (
              <div className="empty-state">
                <p>No messages yet.</p>
                <p className="meta">Type below or choose a quick prompt.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`tutor-message ${m.role}`}>
                {m.text || (loading && i === messages.length - 1 ? '...' : '')}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="tutor-prompt-row">
            {QUICK_PROMPTS.map((p) => (
              <button key={p} type="button" className="skills-chip" onClick={() => send(p)} disabled={loading}>
                {p}
              </button>
            ))}
          </div>

          <div className="tutor-composer">
            <textarea
              rows={3}
              placeholder="Ask the tutor something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            />
          </div>

          <div className="tutor-toolbar">
            <div className="tutor-button-row">
              <button type="button" className="skills-action primary" onClick={() => send(input)} disabled={loading || !input.trim()}>
                {loading ? 'Thinking...' : 'Send'}
              </button>
              <button type="button" className="skills-action secondary" onClick={getHint} disabled={loading || messages.length === 0}>
                Hint
              </button>
              <button type="button" className="tutor-clear-button" onClick={() => { setMessages([]); setLastSources([]); setLastAction('') }}>
                Clear
              </button>
            </div>
            <label className="tutor-stream-toggle">
              <input type="checkbox" checked={useStream} onChange={(e) => setUseStream(e.target.checked)} />
              Stream
            </label>
          </div>

          {error && <p className="feedback error">{error}</p>}
        </section>

        <aside className="tutor-side-panel">
          <div className="skills-panel-header">
            <div>
              <p className="teacher-eyebrow">Session</p>
              <h3 className="editorial-title">Info</h3>
            </div>
          </div>

          {lastAction && (
            <div className="tutor-info-card">
              <p>Teaching action</p>
              <strong>{lastAction}</strong>
            </div>
          )}

          <SourceList sources={lastSources} />

          {learningPath && (
            <div className="tutor-path-block">
              <p className="teacher-eyebrow">Learning Path</p>
              {(learningPath.path || learningPath.skills || []).slice(0, 5).map((step: any, i: number) => (
                <div key={i} className="tutor-path-item">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <p>{step.skill_name || step.name || `Step ${i + 1}`}</p>
                </div>
              ))}
            </div>
          )}

          {!learningPath && (
            <div className="empty-state">
              <p className="meta">Learning path will appear here after sign in.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
