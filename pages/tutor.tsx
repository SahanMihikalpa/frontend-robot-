import { useEffect, useRef, useState } from 'react'
import {
  askTutor, getCurrentUser, getLearningPath, getTutorHints,
  createTutorStreamSocket, getAuthToken,
} from '../lib/api'

type Message = { role: 'user' | 'assistant'; text: string }

function SourceList({ sources }: { sources: any[] }) {
  if (!sources?.length) return null
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <p className="meta" style={{ fontSize: 11 }}>Sources</p>
      {sources.slice(0, 3).map((s: any, i: number) => (
        <div key={i} className="list-item" style={{ padding: '6px 10px' }}>
          <p className="meta" style={{ fontSize: 11, margin: 0 }}>
            {s.source || s.document || `Source ${i + 1}`}
            {s.score != null && <span style={{ marginLeft: 6 }}>· {(s.score * 100).toFixed(0)}%</span>}
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
    <div className="grid-two" style={{ alignItems: 'start' }}>
      <section className="card stack" style={{ gap: 12 }}>
        <div className="section-title">
          <div>
            <h2>AI Tutor</h2>
            <p className="meta">Ask questions, get explanations and hints powered by RAG.</p>
          </div>
          <span className="badge">LLM</span>
        </div>

        {/* Chat history */}
        <div
          className="chat-messages"
          style={{
            minHeight: 240, maxHeight: 400,
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
            background: 'rgba(0,0,0,0.1)',
          }}
        >
          {messages.length === 0 && (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>No messages yet.</p>
              <p className="meta">Type below or choose a quick prompt.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>
              {m.text || (loading && i === messages.length - 1 ? '▋' : '')}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        <div className="chip-row">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} type="button" className="chip" onClick={() => send(p)} disabled={loading}>
              {p}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div className="field">
          <textarea
            rows={3}
            placeholder="Ask the tutor something…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          />
        </div>

        <div className="row">
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={() => send(input)} disabled={loading || !input.trim()}>
              {loading ? 'Thinking…' : 'Send'}
            </button>
            <button type="button" className="btn secondary" onClick={getHint} disabled={loading || messages.length === 0}>
              Hint
            </button>
            <button type="button" className="btn ghost" onClick={() => { setMessages([]); setLastSources([]); setLastAction('') }}>
              Clear
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={useStream} onChange={(e) => setUseStream(e.target.checked)} />
            Stream
          </label>
        </div>

        {error && <p className="feedback error">{error}</p>}
      </section>

      <aside className="card stack">
        <h3 style={{ margin: 0 }}>Session info</h3>

        {lastAction && (
          <div className="list-item">
            <p className="meta">Teaching action</p>
            <strong>{lastAction}</strong>
          </div>
        )}

        <SourceList sources={lastSources} />

        {learningPath && (
          <div className="stack">
            <h4 style={{ margin: 0 }}>Learning path</h4>
            {(learningPath.path || learningPath.skills || []).slice(0, 5).map((step: any, i: number) => (
              <div key={i} className="list-item" style={{ padding: '8px 12px' }}>
                <p className="meta" style={{ margin: 0 }}>
                  {step.skill_name || step.name || `Step ${i + 1}`}
                </p>
              </div>
            ))}
          </div>
        )}

        {!learningPath && (
          <div className="empty-state" style={{ padding: '16px 0' }}>
            <p className="meta">Learning path will appear here after sign in.</p>
          </div>
        )}
      </aside>
    </div>
  )
}
