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
    <div className="knowledge-page">
      <section className="knowledge-hero">
        <div>
          <p className="teacher-eyebrow">RAG Library</p>
          <h2 className="editorial-title">Knowledge Base</h2>
          <p>Upload curriculum documents, keep source material organized, and query matching chunks with retrieval-augmented search.</p>
        </div>
        {stats && (
          <div className="knowledge-stat-grid">
            <div>
              <span>Documents</span>
              <strong>{stats.total_documents ?? docs.length}</strong>
            </div>
            {stats.total_chunks != null && (
              <div>
                <span>Chunks</span>
                <strong>{stats.total_chunks}</strong>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="knowledge-layout">
        <section className="knowledge-main">
          <form onSubmit={handleUpload} className="knowledge-panel">
            <div className="skills-panel-header">
              <div>
                <p className="teacher-eyebrow">Upload</p>
                <h3 className="editorial-title">Add document</h3>
              </div>
            </div>

            <label className="knowledge-file-drop">
              <span>File (PDF, TXT, or MD)</span>
              <input
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setUploadMsg('') }}
              />
            </label>

            {file && (
              <p className="knowledge-file-meta">
                {file.name} | {(file.size / 1024).toFixed(1)} KB
              </p>
            )}

            <button type="submit" className="skills-action primary" disabled={uploading || !file}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            {uploadMsg && <p className={`feedback ${uploadOk ? 'success' : 'error'}`}>{uploadMsg}</p>}
          </form>

          <section className="knowledge-panel">
            <div className="skills-panel-header">
              <div>
                <p className="teacher-eyebrow">Sources</p>
                <h3 className="editorial-title">Uploaded documents</h3>
              </div>
              <span className="skills-count-pill subtle">{docs.length} listed</span>
            </div>

            {docs.length === 0 ? (
              <div className="empty-state">
                <p className="meta">No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="knowledge-doc-list">
                {docs.map((d: any, i: number) => {
                  const name = d.source_name || d.name || d.filename || `Document ${i + 1}`
                  return (
                    <div key={i} className="knowledge-doc-card">
                      <div>
                        <strong>{name}</strong>
                        {d.chunk_count != null && (
                          <p>{d.chunk_count} chunks</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="skills-mini-action danger"
                        onClick={() => setDeleteTarget(name)}
                      >
                        Delete
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <form onSubmit={handleQuery} className="knowledge-panel">
            <div className="skills-panel-header">
              <div>
                <p className="teacher-eyebrow">Query</p>
                <h3 className="editorial-title">Ask the library</h3>
              </div>
            </div>
            <div className="knowledge-query-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask something about the curriculum..."
              />
              <button type="submit" className="skills-action primary" disabled={searching || !query.trim()}>
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {error && <p className="feedback error">{error}</p>}
        </section>

        <aside className="knowledge-results">
          <div className="skills-panel-header">
            <div>
              <p className="teacher-eyebrow">Retrieval</p>
              <h3 className="editorial-title">Search results</h3>
            </div>
            {results.length > 0 && <span className="skills-count-pill">{results.length}</span>}
          </div>

          {results.length === 0 ? (
            <div className="empty-state">
              <p>No results yet.</p>
              <p className="meta">Run a search to see matching chunks.</p>
            </div>
          ) : (
            <div className="knowledge-result-list">
              {results.map((r: any, i: number) => (
                <div key={i} className="knowledge-result-card">
                  <div className="knowledge-result-topline">
                    <strong>{r.source || r.title || r.id || `Result ${i + 1}`}</strong>
                    {r.score != null && (
                      <span>{(r.score * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <p>{r.text || r.content || r.chunk || JSON.stringify(r)}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {deleteTarget && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <p className="skills-modal-kicker">Delete Source</p>
            <h3>Delete document?</h3>
            <p className="meta">"{deleteTarget}"</p>
            <p className="meta">All chunks from this document will be removed. This cannot be undone.</p>
            <div className="skills-modal-actions">
              <button type="button" className="skills-modal-button danger" onClick={confirmDelete}>Yes, delete</button>
              <button type="button" className="skills-modal-button" onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
