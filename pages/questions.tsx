import { useEffect, useMemo, useState } from 'react'
import {
  listQuestions, listSkills, createQuestion, updateQuestion, deleteQuestion,
} from '../lib/api'
import { getStoredUser } from '../lib/session'

type Question = {
  id: number
  question_text: string
  question_type: string
  skill_id: number
  skill_name?: string
  options?: Record<string, string>
  correct_answer?: string
  difficulty?: number
}

const BLANK_FORM = {
  skill_id: '',
  question_text: '',
  question_type: 'multiple_choice',
  optA: '', optB: '', optC: '', optD: '',
  correct_answer: 'A',
  difficulty: '1',
}

function buildOptions(f: typeof BLANK_FORM) {
  const opts: Record<string, string> = {}
  if (f.optA) opts.A = f.optA
  if (f.optB) opts.B = f.optB
  if (f.optC) opts.C = f.optC
  if (f.optD) opts.D = f.optD
  return opts
}

export default function QuestionsPage() {
  const [skills, setSkills] = useState<any[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedSkill, setSelectedSkill] = useState<number | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null)

  const role = getStoredUser()?.role || ''
  const canEdit = role === 'teacher' || role === 'admin'

  async function load() {
    setLoading(true)
    try {
      const [sd, qd] = await Promise.all([listSkills(), listQuestions()])
      setSkills(Array.isArray(sd) ? sd : sd?.items || [])
      setQuestions(Array.isArray(qd) ? qd : qd?.items || [])
    } catch {
      setError('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (selectedSkill === 'all') return questions
    return questions.filter((q) => Number(q.skill_id) === selectedSkill)
  }, [questions, selectedSkill])

  function openCreate() {
    setForm(BLANK_FORM)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(q: Question) {
    const opts = q.options || {}
    setForm({
      skill_id: String(q.skill_id),
      question_text: q.question_text,
      question_type: q.question_type,
      optA: opts.A || '',
      optB: opts.B || '',
      optC: opts.C || '',
      optD: opts.D || '',
      correct_answer: q.correct_answer || 'A',
      difficulty: String(q.difficulty ?? 1),
    })
    setEditId(q.id)
    setShowForm(true)
  }

  async function saveForm() {
    if (!form.skill_id || !form.question_text) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        skill_id: Number(form.skill_id),
        question_text: form.question_text,
        question_type: form.question_type,
        options: buildOptions(form),
        correct_answer: form.correct_answer,
        difficulty: Number(form.difficulty),
      }
      if (editId != null) {
        await updateQuestion(editId, payload)
      } else {
        await createQuestion(payload)
      }
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteQuestion(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch {
      setError('Delete failed')
      setDeleteTarget(null)
    }
  }

  function setF(key: keyof typeof BLANK_FORM, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Questions</h2>
            <p className="meta">Question bank. {canEdit ? 'Create, edit, and delete questions.' : 'Read-only view.'}</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge">{questions.length} total</span>
            {canEdit && (
              <button type="button" className="btn small" onClick={openCreate}>+ New question</button>
            )}
          </div>
        </div>

        <div className="chip-row">
          <button type="button" className={`chip ${selectedSkill === 'all' ? 'active' : ''}`} onClick={() => setSelectedSkill('all')}>
            All skills
          </button>
          {skills.map((s) => (
            <button key={s.id} type="button" className={`chip ${selectedSkill === s.id ? 'active' : ''}`} onClick={() => setSelectedSkill(s.id)}>
              {s.name}
            </button>
          ))}
        </div>

        {error && <p className="feedback error">{error}</p>}
      </section>

      <section className="card stack">
        <div className="section-title">
          <h3>Question list</h3>
          <span className="badge neutral">{filtered.length} shown</span>
        </div>

        {loading ? (
          <div className="empty-state"><p className="meta">Loading…</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No questions found.</p></div>
        ) : (
          <div className="list">
            {filtered.map((q) => (
              <div key={q.id} className="list-item">
                <div className="row">
                  <strong style={{ flex: 1 }}>{q.question_text}</strong>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="badge neutral">{q.question_type}</span>
                    {canEdit && (
                      <>
                        <button type="button" className="btn small secondary" onClick={() => openEdit(q)}>Edit</button>
                        <button type="button" className="btn small danger" onClick={() => setDeleteTarget(q)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
                <p className="meta" style={{ marginTop: 4 }}>
                  Skill: {q.skill_name || q.skill_id}
                  {q.difficulty != null && ` · Difficulty ${q.difficulty}`}
                  {q.correct_answer && ` · Answer: ${q.correct_answer}`}
                </p>
                {q.options && Object.keys(q.options).length > 0 && (
                  <div className="chip-row" style={{ marginTop: 6 }}>
                    {Object.entries(q.options).map(([k, v]) => (
                      <span key={k} className={`chip ${k === q.correct_answer ? 'active' : ''}`} style={{ fontSize: 12 }}>
                        {k}. {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create / Edit modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId != null ? 'Edit question' : 'New question'}</h3>

            <div className="field">
              <label>Skill *</label>
              <select value={form.skill_id} onChange={(e) => setF('skill_id', e.target.value)}>
                <option value="">Select a skill</option>
                {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Question text *</label>
              <textarea rows={3} value={form.question_text} onChange={(e) => setF('question_text', e.target.value)} />
            </div>

            <div className="field">
              <label>Question type</label>
              <select value={form.question_type} onChange={(e) => setF('question_type', e.target.value)}>
                <option value="multiple_choice">Multiple choice</option>
                <option value="true_false">True / False</option>
                <option value="open">Open</option>
              </select>
            </div>

            {(['A', 'B', 'C', 'D'] as const).map((letter) => (
              <div className="field" key={letter}>
                <label>Option {letter}</label>
                <input
                  type="text"
                  value={form[`opt${letter}` as keyof typeof form]}
                  onChange={(e) => setF(`opt${letter}` as keyof typeof BLANK_FORM, e.target.value)}
                />
              </div>
            ))}

            <div className="field">
              <label>Correct answer</label>
              <select value={form.correct_answer} onChange={(e) => setF('correct_answer', e.target.value)}>
                {['A', 'B', 'C', 'D'].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Difficulty (1–5)</label>
              <input type="number" min={1} max={5} value={form.difficulty} onChange={(e) => setF('difficulty', e.target.value)} />
            </div>

            {error && <p className="feedback error">{error}</p>}

            <div className="row">
              <button type="button" className="btn" onClick={saveForm} disabled={saving}>
                {saving ? 'Saving…' : editId != null ? 'Update' : 'Create'}
              </button>
              <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3>Delete question?</h3>
            <p className="meta">"{deleteTarget.question_text}"</p>
            <p className="meta">This cannot be undone.</p>
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
