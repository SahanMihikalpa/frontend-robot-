import { useState } from 'react'
import { uploadKnowledgeDocument, queryKnowledgeBase } from '../lib/api'

export default function KnowledgePage() {
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (!file) return setMessage('Select a file')
    try {
      await uploadKnowledgeDocument(file)
      setMessage('Uploaded successfully')
      setFile(null)
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || 'Upload failed')
    }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      const res = await queryKnowledgeBase({ query, top_k: 5 })
      setResults(res?.results || res || [])
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || 'Query failed')
    }
  }

  return (
    <div className="grid-two">
      <section className="card stack">
        <h2>Knowledge Base</h2>
        <form onSubmit={handleUpload} className="stack">
          <label>Upload document (pdf, txt)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="row">
            <button className="btn" type="submit">Upload</button>
          </div>
          {message && <p className="meta">{message}</p>}
        </form>

        <form onSubmit={handleQuery} className="stack">
          <label>Query knowledge base</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask something about content" />
          <div className="row">
            <button className="btn" type="submit">Search</button>
          </div>
        </form>
      </section>

      <aside className="card stack">
        <h3>Results</h3>
        {results.length === 0 ? (
          <p className="meta">No results</p>
        ) : (
          <div className="stack">
            {results.map((r, i) => (
              <div key={i} className="result-item">
                <strong>{r.title || r.id || `Result ${i + 1}`}</strong>
                <p className="meta">{r.text || JSON.stringify(r)}</p>
                <small className="muted">score: {r.score ?? 'n/a'}</small>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
