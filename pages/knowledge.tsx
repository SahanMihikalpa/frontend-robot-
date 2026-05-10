import { useEffect, useState } from 'react'
import {
  uploadKnowledgeDocument, queryKnowledgeBase,
  listKnowledgeDocuments, getKnowledgeStats, deleteKnowledgeDocument,
} from '../lib/api'

export default function KnowledgePage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadOk, setUploadOk] = useState(false)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const [docs, setDocs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function loadDocs() {
    try {
      const [d, s] = await Promise.all([listKnowledgeDocuments(), getKnowledgeStats()])
      setDocs(Array.isArray(d) ? d : d?.documents || [])
      setStats(s)
    } catch { /* ignore */ }
  }

  useEffect(() => { loadDocs() }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setUploadMsg('Select a file first'); return }
    setUploading(true)
    setUploadMsg('')
    setError('')
    try {
      await uploadKnowledgeDocument(file)
      setUploadMsg('Uploaded successfully')
      setUploadOk(true)
      setFile(null)
      await loadDocs()
    } catch (err: any) {
      setUploadMsg(err?.response?.data?.detail || 'Upload failed')
      setUploadOk(false)
    } finally {
      setUploading(false)
    }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError('')
    try {
      const res = await queryKnowledgeBase({ query, top_k: 5 })
      setResults(res?.results || res || [])
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Query failed')
    } finally {
      setSearching(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteKnowledgeDocument(deleteTarget)
      setDeleteTarget(null)
      await loadDocs()
    } catch {
      setError('Delete failed')
      setDeleteTarget(null)
    }
  }

  return (
    <div className="grid-two" style={{ alignItems: 'start' }}>
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Knowledge Base</h2>
            <p className="meta">Upload curriculum documents and query with RAG.</p>
          </div>
          {stats && (
            <div className="row" style={{ gap: 8 }}>
              <span className="badge">{stats.total_documents ?? docs.length} docs</span>
              {stats.total_chunks != null && <span className="badge neutral">{stats.total_chunks} chunks</span>}
            </div>
          )}
        </div>

        {/* Upload */}
        <form onSubmit={handleUpload} className="stack">
          <h4 style={{ margin: 0 }}>Upload document</h4>
          <div className="field">
            <label>File (PDF or TXT)</label>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setUploadMsg('') }}
            />
          </div>
          {file && <p className="meta">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
          <button type="submit" className="btn" disabled={uploading || !file}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          {uploadMsg && <p className={`feedback ${uploadOk ? 'success' : 'error'}`}>{uploadMsg}</p>}
        </form>

        {/* Documents list */}
        <div className="stack">
          <h4 style={{ margin: 0 }}>Uploaded documents</h4>
          {docs.length === 0 ? (
            <div className="empty-state" style={{ padding: '12px 0' }}>
              <p className="meta">No documents uploaded yet.</p>
            </div>
          ) : (
            <div className="list">
              {docs.map((d: any, i: number) => {
                const name = d.source_name || d.name || d.filename || `Document ${i + 1}`
                return (
                  <div key={i} className="list-item">
                    <div className="row">
                      <div>
                        <strong style={{ fontSize: 13 }}>{name}</strong>
                        {d.chunk_count != null && (
                          <p className="meta" style={{ margin: 0 }}>{d.chunk_count} chunks</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => setDeleteTarget(name)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Search */}
        <form onSubmit={handleQuery} className="stack">
          <h4 style={{ margin: 0 }}>Query knowledge base</h4>
          <div className="field">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask something about the curriculum…"
            />
          </div>
          <button type="submit" className="btn" disabled={searching || !query.trim()}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && <p className="feedback error">{error}</p>}
      </section>

      <aside className="card stack">
        <div className="section-title">
          <h3>Search results</h3>
          {results.length > 0 && <span className="badge">{results.length}</span>}
        </div>

        {results.length === 0 ? (
          <div className="empty-state">
            <p>No results yet.</p>
            <p className="meta">Run a search to see matching chunks.</p>
          </div>
        ) : (
          <div className="stack">
            {results.map((r: any, i: number) => (
              <div key={i} className="result-item">
                <div className="row">
                  <strong style={{ fontSize: 13 }}>{r.source || r.title || r.id || `Result ${i + 1}`}</strong>
                  {r.score != null && (
                    <span className="badge neutral" style={{ fontSize: 11 }}>
                      {(r.score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="meta" style={{ marginTop: 6, lineHeight: 1.5 }}>
                  {r.text || r.content || r.chunk || JSON.stringify(r)}
                </p>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3>Delete document?</h3>
            <p className="meta">"{deleteTarget}"</p>
            <p className="meta">All chunks from this document will be removed. This cannot be undone.</p>
            <div className="row">
              <button type="button" className="btn danger" onClick={confirmDelete}>Yes, delete</button>
              <button type="button" className="btn secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
