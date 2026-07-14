import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  listQuestions, listSkills, createQuestion, updateQuestion, deleteQuestion,
  bulkImportQuestions, downloadQuestionsCsvTemplate,
} from '../lib/api'
import { getStoredUser } from '../lib/session'
import CsvImportModal from '../components/CsvImportModal'
import ModalMobileHeader from '../components/ModalMobileHeader'
import { useToast } from '../components/ToastProvider'

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
  if (f.question_type === 'true_false') {
    return { A: 'True', B: 'False' }
  }
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
  const toast = useToast()

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

  useEffect(() => {
    const anyModalOpen = showForm || !!deleteTarget
    document.body.style.overflow = anyModalOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showForm, deleteTarget])

  const filtered = useMemo(() => {
    if (selectedSkill === 'all') return questions
    return questions.filter((q) => Number(q.skill_id) === selectedSkill)
  }, [questions, selectedSkill])

  const skillsCovered = useMemo(
    () => new Set(questions.map((q) => q.skill_id)).size,
    [questions],
  )
  const avgDifficulty = useMemo(() => {
    const withDifficulty = questions.filter((q) => q.difficulty != null)
    if (withDifficulty.length === 0) return null
    return withDifficulty.reduce((sum, q) => sum + (q.difficulty || 0), 0) / withDifficulty.length
  }, [questions])
  const mcCount = useMemo(
    () => questions.filter((q) => q.question_type === 'multiple_choice').length,
    [questions],
  )

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
    if (form.question_type === 'multiple_choice') {
      const opts = buildOptions(form)
      if (Object.keys(opts).length < 2) {
        setError('Add at least 2 options')
        return
      }
      if (!opts[form.correct_answer]) {
        setError('The correct answer must be one of the filled options')
        return
      }
    }
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
        toast.success('Question updated')
      } else {
        await createQuestion(payload)
        toast.success('Question created')
      }
      setShowForm(false)
      await load()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Save failed'
      setError(detail)
      toast.error({ title: editId != null ? 'Couldn’t update question' : 'Couldn’t create question', message: detail })
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
      toast.success('Question deleted')
    } catch {
      setError('Delete failed')
      setDeleteTarget(null)
      toast.error('Couldn’t delete question')
    }
  }

  function setF(key: keyof typeof BLANK_FORM, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleTypeChange(type: string) {
    setForm((prev) => ({
      ...prev,
      question_type: type,
      // True/False only has answers A (True) and B (False)
      correct_answer:
        type === 'true_false' && !['A', 'B'].includes(prev.correct_answer)
          ? 'A'
          : prev.correct_answer,
    }))
    setError('')
  }

  return (
    <div className="questions-page teacher-roster-page student-dash">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">Question Bank</p>
          <h2 className="editorial-title">Questions</h2>
          <p>
            Build and maintain the assessment items that drive practice,
            mastery tracking, and teacher insight.
            {canEdit ? ' Create, edit, and delete questions.' : ' Read-only view.'}
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Bank</span>
          <strong>{questions.length}</strong>
          <p>questions total</p>
        </div>
      </section>

      

      <section className="teacher-kpi-grid teacher-roster-kpis">
        <div className="teacher-kpi-card">
          <p>Total questions</p>
          <strong>{questions.length}</strong>
          <small>in the question bank</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Skills covered</p>
          <strong>{skillsCovered}</strong>
          <small>distinct skills with questions</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Multiple choice</p>
          <strong>{mcCount}</strong>
          <small>of {questions.length} questions</small>
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

      <section className="teacher-panel">
        <div className="teacher-panel-header">
          <div>
            <p className="teacher-eyebrow">Catalogue</p>
            <h3 className="editorial-title">Question list</h3>
          </div>
          <div className="questions-hero-actions">
            <span className="skills-count-pill subtle">{filtered.length} shown</span>
            {canEdit && (
              <button type="button" className="skills-action secondary" onClick={() => setShowImport(true)}>
                Import CSV
              </button>
            )}
            {canEdit && (
              <button type="button" className="skills-action primary" onClick={openCreate}>New question</button>
            )}
          </div>
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
            <ModalMobileHeader
              title={editId != null ? 'Edit question' : 'New question'}
              subtitle={editId != null ? 'Question Editor' : 'Question Builder'}
              backLabel="Back to question list"
              onBack={() => setShowForm(false)}
            />

            <div className="skills-modal-scroll">
              <p className="skills-modal-subtitle">Write a question, connect it to a skill, and define the answer set used during practice.</p>

              <p className="modal-section-label">Question details</p>
              <div className="questions-modal-grid questions-modal-grid-three">
                <div className="field">
                  <label>Skill *</label>
                  <select value={form.skill_id} onChange={(e) => setF('skill_id', e.target.value)}>
                    <option value="">Select a skill</option>
                    {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="field">
                  <label>Question type</label>
                  <select value={form.question_type} onChange={(e) => handleTypeChange(e.target.value)}>
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="true_false">True / False</option>
                    {/* <option value="open">Open</option> */}
                  </select>
                </div>

                <div className="field">
                  <label>Difficulty (1-5)</label>
                  <input type="number" min={1} max={5} value={form.difficulty} onChange={(e) => setF('difficulty', e.target.value)} />
                </div>
              </div>

              <p className="modal-section-label">Question</p>
              <div className="field">
                <label>Question text *</label>
                <textarea rows={3} value={form.question_text} onChange={(e) => setF('question_text', e.target.value)} />
              </div>

              {form.question_type === 'multiple_choice' && (
                <>
                  <p className="modal-section-label">Answer options</p>
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
                </>
              )}

              <p className="modal-section-label">Correct answer</p>
              <div className="field">
                <label>Correct answer</label>
                {form.question_type === 'true_false' ? (
                  <select value={form.correct_answer} onChange={(e) => setF('correct_answer', e.target.value)}>
                    <option value="A">True</option>
                    <option value="B">False</option>
                  </select>
                ) : (
                  <select value={form.correct_answer} onChange={(e) => setF('correct_answer', e.target.value)}>
                    {['A', 'B', 'C', 'D'].map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                )}
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
        </div>
      )}

      {showImport && (
        <CsvImportModal
          title="Import questions from CSV"
          subtitle="Create many questions at once. Download the template, fill one question per row, then upload it. Rows that duplicate an existing question (same skill + text) are skipped."
          columnsHint="skill_name, question_text, question_type (multiple_choice | true_false ), option_a–option_d, correct_answer, difficulty (1–5)"
          onDownloadTemplate={downloadQuestionsCsvTemplate}
          onImport={bulkImportQuestions}
          onImported={load}
          onClose={() => setShowImport(false)}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <ModalMobileHeader
              title="Delete question?"
              subtitle="This cannot be undone"
              backLabel="Back to question list"
              onBack={() => setDeleteTarget(null)}
            />
            <div className="skills-modal-scroll">
              <p className="meta">"{deleteTarget.question_text}"</p>
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
