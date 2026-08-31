import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  listSkills, createSkill, updateSkill, deleteSkill,
  getSkillGraph, getBktParameters, setBktParameters, fitBktParameters,
  listQuestions,
  bulkImportSkills, downloadSkillsCsvTemplate,
} from '../lib/api'
import { getStoredUser } from '../lib/session'
import CsvImportModal from '../components/CsvImportModal'
import ModalMobileHeader from '../components/ModalMobileHeader'
import { useToast } from '../components/ToastProvider'

type Skill = {
  id: number
  name: string
  description?: string
  category?: string
  difficulty_level?: number
  created_at: string
}

type BktParams = {
  p_l0: number
  p_t: number
  p_s: number
  p_g: number
}

type GraphNode = {
  id: number
  name: string
  category?: string
  difficulty_level?: number
  prerequisites: number[]
}

const BLANK_FORM = {
  name: '',
  description: '',
  category: '',
  difficulty_level: '1',
}

const BLANK_BKT: BktParams = { p_l0: 0.3, p_t: 0.1, p_s: 0.1, p_g: 0.2 }

const DIFF_LABELS: Record<number, string> = { 1: 'Beginner', 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Expert' }

function DiffBadge({ level }: { level?: number }) {
  if (!level) return <span className="badge neutral">—</span>
  const colors: Record<number, string> = {
    1: 'var(--success)', 2: '#86efac', 3: 'var(--warning)', 4: '#fb923c', 5: 'var(--danger)',
  }
  const c = colors[level]
  // color-mix() works for both the var(--x) and raw-hex entries above —
  // string-concatenating a hex-alpha suffix directly (the old `c + '22'`
  // pattern) is invalid CSS for the var() cases and silently drops the
  // whole declaration, so 1/3/5 badges rendered with no background/border.
  return (
    <span className="badge" style={{
      background: `color-mix(in srgb, ${c} 13%, transparent)`,
      color: c,
      border: `1px solid color-mix(in srgb, ${c} 27%, transparent)`,
    }}>
      {DIFF_LABELS[level] || level}
    </span>
  )
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [questionCounts, setQuestionCounts] = useState<Record<number, number>>({})
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null)
  const [showImport, setShowImport] = useState(false)

  const [bktSkill, setBktSkill] = useState<Skill | null>(null)
  const [bktParams, setBktParams] = useState<BktParams>(BLANK_BKT)
  const [bktLoading, setBktLoading] = useState(false)
  const [bktSaving, setBktSaving] = useState(false)
  const [bktFitting, setBktFitting] = useState(false)
  const [bktError, setBktError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const role = getStoredUser()?.role || ''
  const canEdit = role === 'teacher' || role === 'admin'
  const canDelete = role === 'admin'
  const toast = useToast()

  async function load() {
    setLoading(true)
    setError('')
    try {
      const sd = await listSkills()
      const skillList: Skill[] = Array.isArray(sd) ? sd : sd?.items || []
      setSkills(skillList)

      const [qd, gd] = await Promise.allSettled([listQuestions(), getSkillGraph()])

      if (qd.status === 'fulfilled') {
        const qList: any[] = Array.isArray(qd.value) ? qd.value : qd.value?.items || []
        const counts: Record<number, number> = {}
        for (const q of qList) {
          counts[q.skill_id] = (counts[q.skill_id] || 0) + 1
        }
        setQuestionCounts(counts)
      }

      if (gd.status === 'fulfilled') {
        setGraphNodes(gd.value?.nodes || [])
      }
    } catch {
      setError('Failed to load skills')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const anyModalOpen = showForm || !!bktSkill
    document.body.style.overflow = anyModalOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showForm, bktSkill])

  const categories = useMemo(() => {
    const cats = new Set(skills.map((s) => s.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [skills])

  const filtered = useMemo(() => {
    let list = skills
    if (categoryFilter !== 'all') list = list.filter((s) => s.category === categoryFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q),
      )
    }
    return list
  }, [skills, categoryFilter, searchQuery])

  function openCreate() {
    setForm(BLANK_FORM)
    setEditId(null)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(s: Skill) {
    setForm({
      name: s.name,
      description: s.description || '',
      category: s.category || '',
      difficulty_level: String(s.difficulty_level ?? 1),
    })
    setEditId(s.id)
    setFormError('')
    setShowForm(true)
  }

  async function saveForm() {
    if (!form.name.trim()) { setFormError('Name is required'); return }
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        difficulty_level: form.difficulty_level ? Number(form.difficulty_level) : undefined,
      }
      if (editId != null) {
        await updateSkill(editId, payload)
        toast.success({ title: 'Skill updated', message: payload.name })
      } else {
        await createSkill(payload)
        toast.success({ title: 'Skill created', message: payload.name })
      }
      setShowForm(false)
      await load()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Save failed'
      setFormError(detail)
      toast.error({ title: editId != null ? 'Couldn’t update skill' : 'Couldn’t create skill', message: detail })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const name = deleteTarget.name
    try {
      await deleteSkill(deleteTarget.id)
      setDeleteTarget(null)
      await load()
      toast.success({ title: 'Skill deleted', message: name })
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Delete failed'
      setError(detail)
      setDeleteTarget(null)
      toast.error({ title: 'Couldn’t delete skill', message: detail })
    }
  }

  async function openBkt(s: Skill) {
    setBktSkill(s)
    setBktError('')
    setBktLoading(true)
    try {
      const p = await getBktParameters(s.id)
      setBktParams({
        p_l0: p.p_l0 ?? 0.3,
        p_t: p.p_t ?? 0.1,
        p_s: p.p_s ?? 0.1,
        p_g: p.p_g ?? 0.2,
      })
    } catch {
      setBktParams(BLANK_BKT)
    } finally {
      setBktLoading(false)
    }
  }

  async function saveBkt() {
    if (!bktSkill) return
    setBktSaving(true)
    setBktError('')
    try {
      await setBktParameters(bktSkill.id, bktParams)
      setBktSkill(null)
    } catch (err: any) {
      setBktError(err?.response?.data?.detail || 'Save failed')
    } finally {
      setBktSaving(false)
    }
  }

  async function runFitBkt() {
    setBktFitting(true)
    setBktError('')
    try {
      await fitBktParameters()
      if (bktSkill) {
        const p = await getBktParameters(bktSkill.id)
        setBktParams({ p_l0: p.p_l0, p_t: p.p_t, p_s: p.p_s, p_g: p.p_g })
      }
    } catch (err: any) {
      setBktError(err?.response?.data?.detail || 'Auto-fit failed')
    } finally {
      setBktFitting(false)
    }
  }

  function setF(key: keyof typeof BLANK_FORM, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function setBkt(key: keyof BktParams, val: string) {
    const num = parseFloat(val)
    if (!isNaN(num)) setBktParams((prev) => ({ ...prev, [key]: Math.min(1, Math.max(0, num)) }))
  }

  const nameMap = useMemo(() => {
    const m: Record<number, string> = {}
    skills.forEach((s) => { m[s.id] = s.name })
    return m
  }, [skills])

  const avgDifficulty = useMemo(() => {
    const withLevel = skills.filter((s) => s.difficulty_level != null)
    if (withLevel.length === 0) return null
    return withLevel.reduce((sum, s) => sum + (s.difficulty_level || 0), 0) / withLevel.length
  }, [skills])
  const skillsWithQuestions = useMemo(
    () => skills.filter((s) => (questionCounts[s.id] || 0) > 0).length,
    [skills, questionCounts],
  )

  return (
    <div className="skills-page teacher-roster-page student-dash">
      {/* ── Header ── */}
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">Learning Map</p>
          <h2 className="editorial-title">Skills</h2>
          <p>
            Manage learning skills, BKT parameters, and prerequisite relationships.
            {canEdit ? ' Teachers can create and edit. Admins can also delete.' : ' Read-only view.'}
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Map</span>
          <strong>{skills.length}</strong>
          <p>skills total</p>
        </div>
      </section>

      <div className="teacher-roster-nav">
        <Link href="/questions" className="teacher-action primary">
          <span>01</span>
          Manage Questions
        </Link>
        <Link href="/knowledge" className="teacher-action">
          <span>02</span>
          Knowledge Base
        </Link>
      </div>

      <section className="teacher-kpi-grid teacher-roster-kpis">
        <div className="teacher-kpi-card">
          <p>Total skills</p>
          <strong>{skills.length}</strong>
          <small>in the learning map</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Categories</p>
          <strong>{categories.length}</strong>
          <small>distinct skill categories</small>
        </div>
        <div className="teacher-kpi-card">
          <p>With questions</p>
          <strong>{skillsWithQuestions}</strong>
          <small>of {skills.length} skills</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Avg difficulty</p>
          <strong>{avgDifficulty != null ? avgDifficulty.toFixed(1) : '-'}</strong>
          <small>on a 1-5 scale</small>
        </div>
      </section>

      <section className="teacher-panel">
        <div className="teacher-panel-header">
          <div>
            <p className="teacher-eyebrow">Filters</p>
            <h3 className="editorial-title">Search & category</h3>
          </div>
          <div className="questions-hero-actions">
            <Link href="/skills/graph" className="skills-action secondary">
              Dependency graph
            </Link>
            {canEdit && (
              <button type="button" className="skills-action secondary" onClick={() => setShowImport(true)}>
                Import CSV
              </button>
            )}
            {canEdit && (
              <button type="button" className="skills-action primary" onClick={openCreate}>New skill</button>
            )}
          </div>
        </div>

        {/* Search + category filter */}
        <div className="skills-search-row">
          <input
            type="search"
            placeholder="Search skills…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="skills-search-input"
          />
        </div>
        <div className="skills-chip-row">
          <button
            type="button"
            className={`skills-chip ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            All categories
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`skills-chip ${categoryFilter === c ? 'active' : ''}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {error && <p className="feedback error">{error}</p>}
      </section>

      {/* ── Skills table ── */}
      <section className="teacher-panel">
        <div className="teacher-panel-header">
          <div>
            <p className="teacher-eyebrow">Catalogue</p>
            <h3 className="editorial-title">Skill list</h3>
          </div>
          <span className="skills-count-pill subtle">
            {filtered.length} {filtered.length === 1 ? 'Skill' : 'Skills'}
          </span>
        </div>

        {loading ? (
          <div className="empty-state"><p className="meta">Loading…</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No skills found.</p></div>
        ) : (
          <>
            {/* Desktop / tablet table (lg and above) */}
            <div className="skills-table-wrap">
              <table className="skills-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Difficulty</th>
                    <th>Questions</th>
                    <th>Prerequisites</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const node = graphNodes.find((n) => n.id === s.id)
                    const prereqs = node?.prerequisites || []
                    return (
                      <tr key={s.id}>
                        <td>
                          <strong className="skills-name">{s.name}</strong>
                          {s.description && (
                            <p className="meta" style={{ fontSize: 14, margin: '2px 0 0' }}>{s.description}</p>
                          )}
                        </td>
                        <td>{s.category ? <span className="badge neutral">{s.category}</span> : '—'}</td>
                        <td><DiffBadge level={s.difficulty_level} /></td>
                        <td>
                          <span className="skills-question-pill">
                            {questionCounts[s.id] ?? 0}
                          </span>
                        </td>
                        <td>
                          {prereqs.length === 0
                            ? <span className="meta" style={{ fontSize: 14 }}>None</span>
                            : (
                              <span className="meta" style={{ fontSize: 14 }}>
                                {prereqs.map((pid) => nameMap[pid] || `#${pid}`).join(', ')}
                              </span>
                            )}
                        </td>
                        <td>
                          <div className="skills-row-actions">
                            <button
                              type="button"
                              className="skills-mini-action"
                              title="BKT parameters"
                              onClick={() => openBkt(s)}
                            >
                              BKT
                            </button>
                            {canEdit && (
                              <button type="button" className="skills-mini-action" onClick={() => openEdit(s)}>
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button type="button" className="skills-mini-action danger" onClick={() => setDeleteTarget(s)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list (below lg) */}
            <div className="skills-card-list">
              {filtered.map((s) => {
                const node = graphNodes.find((n) => n.id === s.id)
                const prereqs = node?.prerequisites || []
                return (
                  <div className="skills-card" key={s.id}>
                    <div className="skills-card-top">
                      <strong className="skills-name">{s.name}</strong>
                      <DiffBadge level={s.difficulty_level} />
                    </div>

                    {s.description && (
                      <p className="meta" style={{ fontSize: 14, margin: '2px 0 0' }}>{s.description}</p>
                    )}

                    <div className="skills-card-meta">
                      {s.category && (
                        <div className="skills-card-meta-row">
                          <span className="skills-card-meta-label">Category</span>
                          <span className="badge neutral">{s.category}</span>
                        </div>
                      )}
                      <div className="skills-card-meta-row">
                        <span className="skills-card-meta-label">Questions</span>
                        <span className="skills-question-pill">{questionCounts[s.id] ?? 0}</span>
                      </div>
                      <div className="skills-card-meta-row">
                        <span className="skills-card-meta-label">Prerequisites</span>
                        <span className="meta" style={{ fontSize: 14, textAlign: 'right' }}>
                          {prereqs.length === 0 ? 'None' : prereqs.map((pid) => nameMap[pid] || `#${pid}`).join(', ')}
                        </span>
                      </div>
                    </div>

                    <div className="skills-card-actions">
                      <button
                        type="button"
                        className="skills-mini-action"
                        title="BKT parameters"
                        onClick={() => openBkt(s)}
                      >
                        BKT
                      </button>
                      {canEdit && (
                        <button type="button" className="skills-mini-action" onClick={() => openEdit(s)}>
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className="skills-mini-action danger" onClick={() => setDeleteTarget(s)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Create / Edit modal ── */}
      {showForm && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()}>
            <ModalMobileHeader
              title={editId != null ? 'Edit skill' : 'New skill'}
              subtitle={editId != null ? 'Skill Editor' : 'Skill Builder'}
              backLabel="Back to skill list"
              onBack={() => setShowForm(false)}
            />

            <div className="skills-modal-scroll">
              <div className="modal-desktop-title">
                <p className="skills-modal-kicker">{editId != null ? 'Skill Editor' : 'Skill Builder'}</p>
                <h3>{editId != null ? 'Edit skill' : 'New skill'}</h3>
              </div>
              <p className="skills-modal-subtitle">Define the skill details used across questions, mastery tracking, and prerequisite mapping.</p>

              <div className="field">
                <label>Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Fractions, Variables, Ohm's Law"
                  value={form.name}
                  onChange={(e) => setF('name', e.target.value)}
                />
              </div>

              <div className="field">
                <label>Description</label>
                <textarea
                  rows={2}
                  placeholder="Short description of what this skill covers"
                  value={form.description}
                  onChange={(e) => setF('description', e.target.value)}
                />
              </div>

              <div className="field">
                <label>Category</label>
                <input
                  type="text"
                  placeholder="e.g. Mathematics, Physics, Programming"
                  value={form.category}
                  onChange={(e) => setF('category', e.target.value)}
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div className="field">
                <label>Difficulty level</label>
                <select value={form.difficulty_level} onChange={(e) => setF('difficulty_level', e.target.value)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} — {DIFF_LABELS[n]}</option>
                  ))}
                </select>
              </div>

              {formError && <p className="feedback error">{formError}</p>}

              <div className="skills-modal-actions">
                <button type="button" className="skills-modal-button primary" onClick={saveForm} disabled={saving}>
                  {saving ? 'Saving…' : editId != null ? 'Update' : 'Create'}
                </button>
                <button type="button" className="skills-modal-button" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BKT parameters modal ── */}
      {bktSkill && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setBktSkill(null)}>
          <div className="modal skills-modal skills-modal-bkt" onClick={(e) => e.stopPropagation()}>
            <ModalMobileHeader
              title="BKT Parameters"
              subtitle={bktSkill.name}
              backLabel="Back to skill list"
              onBack={() => setBktSkill(null)}
            />

            <div className="skills-modal-scroll">
              <div className="modal-desktop-title">
                <h3>BKT Parameters — {bktSkill.name}</h3>
              </div>
              <p className="meta" style={{ marginBottom: 12 }}>
                Bayesian Knowledge Tracing parameters control how the model estimates student knowledge.
              </p>

              {bktLoading ? (
                <p className="meta">Loading…</p>
              ) : (
                <>
                  {(
                    [
                      ['p_l0', 'Initial knowledge (P(L₀))', 'Probability student already knows this skill'],
                      ['p_t', 'Learning rate (P(T))', 'Probability of learning the skill after each attempt'],
                      ['p_s', 'Slip rate (P(S))', 'Probability of answering incorrectly despite knowing'],
                      ['p_g', 'Guess rate (P(G))', 'Probability of answering correctly without knowing'],
                    ] as [keyof BktParams, string, string][]
                  ).map(([key, label, hint]) => (
                    <div className="field" key={key}>
                      <label>{label}</label>
                      <p className="meta" style={{ fontSize: 14, marginBottom: 4 }}>{hint}</p>
                      <div className="row" style={{ gap: 8 }}>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={bktParams[key]}
                          onChange={(e) => setBkt(key, e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={bktParams[key].toFixed(2)}
                          onChange={(e) => setBkt(key, e.target.value)}
                          style={{ width: 70 }}
                        />
                      </div>
                    </div>
                  ))}

                  {bktError && <p className="feedback error">{bktError}</p>}

                  <div className="skills-modal-actions">
                    <button type="button" className="skills-modal-button primary" onClick={saveBkt} disabled={bktSaving}>
                      {bktSaving ? 'Saving…' : 'Save parameters'}
                    </button>
                    <button
                      type="button"
                      className="skills-modal-button"
                      onClick={runFitBkt}
                      disabled={bktFitting}
                      title="Auto-fit BKT parameters from interaction history"
                    >
                      {bktFitting ? 'Fitting…' : 'Auto-fit from data'}
                    </button>
                    <button type="button" className="skills-modal-button" onClick={() => setBktSkill(null)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CSV bulk import ── */}
      {showImport && (
        <CsvImportModal
          title="Import skills from CSV"
          subtitle="Create many skills at once. Download the template, fill one skill per row, then upload it. Existing skill names are skipped automatically."
          columnsHint="name (required), description, category, difficulty_level (1–5)"
          onDownloadTemplate={downloadSkillsCsvTemplate}
          onImport={bulkImportSkills}
          onImported={load}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <ModalMobileHeader
              title="Delete skill?"
              subtitle="This cannot be undone"
              backLabel="Back to skill list"
              onBack={() => setDeleteTarget(null)}
            />
            <div className="skills-modal-scroll">
              <p className="meta">
                "<strong>{deleteTarget.name}</strong>" and all associated questions and interactions will be removed.
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
