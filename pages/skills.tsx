import { useEffect, useMemo, useState } from 'react'
import {
  listSkills, createSkill, updateSkill, deleteSkill,
  getSkillGraph, getBktParameters, setBktParameters, fitBktParameters,
  listQuestions,
} from '../lib/api'
import { getStoredUser } from '../lib/session'

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
    1: '#4ade80', 2: '#86efac', 3: '#fbbf24', 4: '#fb923c', 5: '#f87171',
  }
  return (
    <span className="badge" style={{ background: colors[level] + '22', color: colors[level], border: `1px solid ${colors[level]}44` }}>
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

  const [bktSkill, setBktSkill] = useState<Skill | null>(null)
  const [bktParams, setBktParams] = useState<BktParams>(BLANK_BKT)
  const [bktLoading, setBktLoading] = useState(false)
  const [bktSaving, setBktSaving] = useState(false)
  const [bktFitting, setBktFitting] = useState(false)
  const [bktError, setBktError] = useState('')

  const [showGraph, setShowGraph] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const role = getStoredUser()?.role || ''
  const canEdit = role === 'teacher' || role === 'admin'
  const canDelete = role === 'admin'

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
      } else {
        await createSkill(payload)
      }
      setShowForm(false)
      await load()
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteSkill(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Delete failed')
      setDeleteTarget(null)
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

  return (
    <div className="skills-page">
      {/* ── Header ── */}
      <section className="skills-hero">
        <div className="skills-hero-top">
          <div>
            <p className="teacher-eyebrow">Learning Map</p>
            <h2 className="editorial-title">Skills</h2>
            <p>
              Manage learning skills, BKT parameters, and prerequisite relationships.
              {canEdit ? ' Teachers can create and edit. Admins can also delete.' : ' Read-only view.'}
            </p>
          </div>
          <div className="skills-hero-actions">
            <span className="skills-count-pill">{skills.length} skills</span>
            <button
              type="button"
              className="skills-action secondary"
              onClick={() => setShowGraph((v) => !v)}
            >
              {showGraph ? 'Hide graph' : 'Dependency graph'}
            </button>
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

      {/* ── Dependency Graph ── */}
      {showGraph && (
        <section className="skills-panel">
          <div className="skills-panel-header">
            <div>
              <p className="teacher-eyebrow">Dependencies</p>
              <h3 className="editorial-title">Prerequisite graph</h3>
            </div>
            <span className="skills-count-pill subtle">{graphNodes.length} nodes</span>
          </div>
          {graphNodes.length === 0 ? (
            <div className="empty-state"><p className="meta">No prerequisites defined yet.</p></div>
          ) : (
            <div className="skills-graph-list">
              {graphNodes.map((node) => (
                <div key={node.id} className="skills-graph-item">
                  <div className="skills-graph-topline">
                    <strong>{node.name}</strong>
                    <DiffBadge level={node.difficulty_level} />
                    {node.category && <span className="badge neutral" style={{ fontSize: 11 }}>{node.category}</span>}
                  </div>
                  {node.prerequisites.length > 0 ? (
                    <p className="meta" style={{ marginTop: 4 }}>
                      Prerequisites:{' '}
                      {node.prerequisites.map((pid, i) => (
                        <span key={pid}>
                          {i > 0 && ', '}
                          <strong>{nameMap[pid] || `#${pid}`}</strong>
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="meta" style={{ marginTop: 4 }}>No prerequisites — entry-level skill</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Skills table ── */}
      <section className="skills-panel">
        <div className="skills-panel-header">
          <div>
            <p className="teacher-eyebrow">Catalogue</p>
            <h3 className="editorial-title">Skill list</h3>
          </div>
          <span className="skills-count-pill subtle">{filtered.length} shown</span>
        </div>

        {loading ? (
          <div className="empty-state"><p className="meta">Loading…</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No skills found.</p></div>
        ) : (
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
                          <p className="meta" style={{ fontSize: 11, margin: '2px 0 0' }}>{s.description}</p>
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
                          ? <span className="meta" style={{ fontSize: 11 }}>None</span>
                          : (
                            <span className="meta" style={{ fontSize: 11 }}>
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
        )}
      </section>

      {/* ── Create / Edit modal ── */}
      {showForm && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()}>
            <p className="skills-modal-kicker">{editId != null ? 'Skill Editor' : 'Skill Builder'}</p>
            <h3>{editId != null ? 'Edit skill' : 'New skill'}</h3>
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
      )}

      {/* ── BKT parameters modal ── */}
      {bktSkill && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setBktSkill(null)}>
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>BKT Parameters — {bktSkill.name}</h3>
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
                    <p className="meta" style={{ fontSize: 11, marginBottom: 4 }}>{hint}</p>
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
      )}

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3>Delete skill?</h3>
            <p className="meta">
              "<strong>{deleteTarget.name}</strong>" and all associated questions and interactions will be removed.
            </p>
            <p className="meta">This cannot be undone.</p>
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
