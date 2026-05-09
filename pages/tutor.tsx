import { useState } from 'react'
import { askTutor, getCurrentUser } from '../lib/api'

export default function TutorPage() {
  const [query, setQuery] = useState('Explain how to solve fractions step by step.')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submitQuestion() {
    setLoading(true)
    setError('')
    try {
      const user = await getCurrentUser()
      const result = await askTutor({
        query,
        user_id: user.id,
        domain: 'education',
      })
      setResponse(result)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Tutor request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid-two">
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Tutor</h2>
            <p className="meta">Ask the AI tutor for explanations, hints, and practice support.</p>
          </div>
          <span className="badge">LLM</span>
        </div>

        <div className="field">
          <label htmlFor="tutor-query">Your question</label>
          <textarea id="tutor-query" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        <div className="row">
          <button type="button" className="btn" onClick={submitQuestion} disabled={loading}>
            {loading ? 'Asking tutor...' : 'Ask tutor'}
          </button>
          <button type="button" className="btn secondary" onClick={() => setQuery('')}>
            Clear
          </button>
        </div>

        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
      </section>

      <aside className="card stack">
        <div className="section-title">
          <h3>Response</h3>
          <span className="badge">Ready</span>
        </div>

        {response ? (
          <div className="stack">
            <div className="list-item">
              <p className="meta">Tutor answer</p>
              <p>{response.response}</p>
            </div>
            <div className="list-item">
              <p className="meta">Teaching action</p>
              <strong>{response.teaching_action || 'n/a'}</strong>
            </div>
            <div className="list-item">
              <p className="meta">RAG sources</p>
              <pre>{JSON.stringify(response.rag_sources, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <p className="meta">Tutor response will appear here.</p>
        )}
      </aside>
    </div>
  )
}