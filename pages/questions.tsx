import { useEffect, useMemo, useState } from 'react'
import {
  listQuestions, listSkills, createQuestion, updateQuestion, deleteQuestion,
  bulkImportQuestions, downloadQuestionsCsvTemplate,
} from '../lib/api'
import { getStoredUser } from '../lib/session'
import CsvImportModal from '../components/CsvImportModal'

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
  const [showImport, setShowImport] = useState(false)

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
    <div className="questions-page">
      <section className="questions-hero">
        <div>
          <p className="teacher-eyebrow">Question Bank</p>
          <h2 className="editorial-title">Questions</h2>
          <p>
            Build and maintain the assessment items that drive practice,
            mastery tracking, and teacher insight.
            {canEdit ? ' Create, edit, and delete questions.' : ' Read-only view.'}
          </p>
        </div>
        <div className="questions-hero-actions">
          <span className="skills-count-pill">{questions.length} total</span>
          {canEdit && (
            <button type="button" className="skills-action secondary" onClick={() => setShowImport(true)}>
              Import CSV
            </button>
          )}
          {canEdit && (
            <button type="button" className="skills-action primary" onClick={openCreate}>New question</button>
          )}
        </div>
      </section>

      <section className="questions-filter-panel">
        <div className="skills-panel-header">
          <div>
            <p className="teacher-eyebrow">Filter</p>
            <h3 className="editorial-title">Skill focus</h3>
          </div>
          <span className="skills-count-pill subtle">{filtered.length} shown</span>
        </div>

        <div className="questions-chip-row">
          <button type="button" className={`skills-chip ${selectedSkill === 'all' ? 'active' : ''}`} onClick={() => setSelectedSkill('all')}>
            All skills
          </button>
          {skills.map((s) => (
            <button key={s.id} type="button" className={`skills-chip ${selectedSkill === s.id ? 'active' : ''}`} onClick={() => setSelectedSkill(s.id)}>
              {s.name}
            </button>
          ))}
        </div>

        {error && <p className="feedback error">{error}</p>}
      </section>

      <section className="questions-panel">
        <div className="skills-panel-header">
          <div>
            <p className="teacher-eyebrow">Catalogue</p>
            <h3 className="editorial-title">Question list</h3>
          </div>
          <span className="skills-count-pill subtle">{filtered.length} shown</span>
        </div>

        {loading ? (
          <div className="empty-state"><p className="meta">Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No questions found.</p></div>
        ) : (
          <div className="questions-list">
            {filtered.map((q) => (
              <article key={q.id} className="question-card">
                <div className="question-card-main">
                  <div>
                    <p className="question-type-pill">{q.question_type}</p>
                    <h4>{q.question_text}</h4>
                  </div>
                  {canEdit && (
                    <div className="skills-row-actions">
                      <button type="button" className="skills-mini-action" onClick={() => openEdit(q)}>Edit</button>
                      <button type="button" className="skills-mini-action danger" onClick={() => setDeleteTarget(q)}>Delete</button>
                    </div>
                  )}
                </div>

                <p className="question-meta">
                  Skill: {q.skill_name || q.skill_id}
                  {q.difficulty != null && ` | Difficulty ${q.difficulty}`}
                  {q.correct_answer && ` | Answer: ${q.correct_answer}`}
                </p>

                {q.options && Object.keys(q.options).length > 0 && (
                  <div className="question-options">
                    {Object.entries(q.options).map(([k, v]) => (
                      <span key={k} className={`question-option ${k === q.correct_answer ? 'active' : ''}`}>
                        <strong>{k}</strong>
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal skills-modal questions-modal" onClick={(e) => e.stopPropagation()}>
            <p className="skills-modal-kicker">{editId != null ? 'Question Editor' : 'Question Builder'}</p>
            <h3>{editId != null ? 'Edit question' : 'New question'}</h3>
            <p className="skills-modal-subtitle">Write a question, connect it to a skill, and define the answer set used during practice.</p>

            <div className="questions-modal-grid">
              <div className="field">
                <label>Skill *</label>
                <select value={form.skill_id} onChange={(e) => setF('skill_id', e.target.value)}>
                  <option value="">Select a skill</option>
                  {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Question type</label>
                <select value={form.question_type} onChange={(e) => setF('question_type', e.target.value)}>
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="true_false">True / False</option>
                  <option value="open">Open</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Question text *</label>
              <textarea rows={3} value={form.question_text} onChange={(e) => setF('question_text', e.target.value)} />
            </div>

            <div className="questions-options-grid">
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
            </div>

            <div className="questions-modal-grid">
              <div className="field">
                <label>Correct answer</label>
                <select value={form.correct_answer} onChange={(e) => setF('correct_answer', e.target.value)}>
                  {['A', 'B', 'C', 'D'].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Difficulty (1-5)</label>
                <input type="number" min={1} max={5} value={form.difficulty} onChange={(e) => setF('difficulty', e.target.value)} />
              </div>
            </div>

            {error && <p className="feedback error">{error}</p>}

            <div className="skills-modal-actions">
              <button type="button" className="skills-modal-button primary" onClick={saveForm} disabled={saving}>
                {saving ? 'Saving...' : editId != null ? 'Update' : 'Create'}
              </button>
              <button type="button" className="skills-modal-button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <CsvImportModal
          title="Import questions from CSV"
          subtitle="Create many questions at once. Download the template, fill one question per row, then upload it. Rows that duplicate an existing question (same skill + text) are skipped."
          columnsHint="skill_name, question_text, question_type (multiple_choice | true_false | open), option_a–option_d, correct_answer, difficulty (1–5)"
          onDownloadTemplate={downloadQuestionsCsvTemplate}
          onImport={bulkImportQuestions}
          onImported={load}
          onClose={() => setShowImport(false)}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <p className="skills-modal-kicker">Delete Question</p>
            <h3>Delete question?</h3>
            <p className="meta">"{deleteTarget.question_text}"</p>
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
