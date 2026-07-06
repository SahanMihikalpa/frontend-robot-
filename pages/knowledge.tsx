import { useEffect, useState } from 'react'
import {
  uploadKnowledgeDocument, queryKnowledgeBase,
  listKnowledgeDocuments, getKnowledgeStats, deleteKnowledgeDocument,
  listSkills,
} from '../lib/api'
import ModalMobileHeader from '../components/ModalMobileHeader'

/** Private self-learn course packs are namespaced "sl:{user}:{skill}". */
function isPrivatePack(subject?: string) {
  return typeof subject === 'string' && subject.startsWith('sl:')
}

export default function KnowledgePage() {
  const [file, setFile] = useState<File | null>(null)
  const [subject, setSubject] = useState('general')
  const [skills, setSkills] = useState<any[]>([])
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

  useEffect(() => {
    loadDocs()
    listSkills()
      .then((s) => setSkills(Array.isArray(s) ? s : s?.items || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    document.body.style.overflow = deleteTarget ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [deleteTarget])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setUploadMsg('Select a file first'); return }
    setUploading(true)
    setUploadMsg('')
    setError('')
    try {
      await uploadKnowledgeDocument(file, subject || 'general')
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

            <div className="knowledge-form-group">
              <label className="knowledge-form-label">File (PDF, TXT, or MD)</label>
              <label className="csv-file-drop knowledge-upload-drop">
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={(e) => { setFile(e.target.files?.[0] || null); setUploadMsg('') }}
                />
                <span className="csv-file-drop-icon" aria-hidden="true">↑</span>
                {file ? (
                  <span className="csv-file-drop-name">
                    {file.name}
                    <em>{(file.size / 1024).toFixed(1)} KB</em>
                  </span>
                ) : (
                  <span className="csv-file-drop-hint">
                    <strong>Choose a document</strong>
                    PDF, TXT, or MD — or drop it here
                  </span>
                )}
              </label>
            </div>

            <div className="knowledge-form-group">
              <label className="knowledge-form-label" htmlFor="knowledge-skill-scope">Skill scope</label>
              <select
                id="knowledge-skill-scope"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="general">General — available in every skill session</option>
                {skills.map((s: any) => (
                  <option key={s.id} value={s.name}>{s.name} — only this skill's sessions</option>
                ))}
              </select>
              <p className="knowledge-form-hint">
                Skill-tagged documents ground the tutor only in that skill's chat sessions.
                General documents are used everywhere.
              </p>
            </div>

            {uploadMsg && <p className={`feedback ${uploadOk ? 'success' : 'error'}`}>{uploadMsg}</p>}

            <div className="knowledge-form-footer">
              <button type="submit" className="skills-action primary" disabled={uploading || !file}>
                {uploading ? 'Uploading...' : 'Upload document'}
              </button>
            </div>
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
                  const name = d.source || d.source_name || d.name || d.filename || `Document ${i + 1}`
                  const priv = isPrivatePack(d.subject)
                  return (
                    <div key={i} className="knowledge-doc-card">
                      <div>
                        <strong>{priv ? (d.source?.split(':').slice(3).join(':') || name) : name}</strong>
                        <p>
                          {d.chunk_count != null && `${d.chunk_count} chunks`}
                          {' · '}
                          {priv ? (
                            <span style={{ color: 'var(--warning)' }}>
                              🔒 student self-learn material (private)
                            </span>
                          ) : (
                            <span className="badge neutral" style={{ fontSize: 10 }}>
                              {d.subject === 'general' || !d.subject ? 'general' : `skill: ${d.subject}`}
                            </span>
                          )}
                        </p>
                      </div>
                      {!priv && (
                        <button
                          type="button"
                          className="skills-mini-action danger"
                          onClick={() => setDeleteTarget(name)}
                        >
                          Delete
                        </button>
                      )}
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
            <div className="empty-state knowledge-results-empty">
              <span className="knowledge-results-empty-icon" aria-hidden="true">⌕</span>
              <p><strong>No results yet</strong></p>
              <p className="meta">
                Ask the library a question and the best-matching
                chunks will appear here.
              </p>
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
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <ModalMobileHeader
              title="Delete document?"
              subtitle="This cannot be undone"
              backLabel="Back to knowledge base"
              onBack={() => setDeleteTarget(null)}
            />
            <div className="skills-modal-scroll">
              <p className="meta">
                "<strong>{deleteTarget}</strong>" — all chunks from this document will be removed.
              </p>
              <div className="skills-modal-actions">
                <button type="button" className="skills-modal-button danger" onClick={confirmDelete}>Yes, delete</button>
                <button type="button" className="skills-modal-button" onClick={() => setDeleteTarget(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
