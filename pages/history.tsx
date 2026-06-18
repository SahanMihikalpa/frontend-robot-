import { useEffect, useMemo, useState } from 'react'
import { getMyInteractions, getStudentInteractions, listStudentsAnalytics } from '../lib/api'
import { getStoredUser } from '../lib/session'

export default function HistoryPage() {
  const me = getStoredUser()
  const isTeacherOrAdmin = me?.role === 'teacher' || me?.role === 'admin'

  const [history, setHistory] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [activeSkill, setActiveSkill] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadInteractions(studentId?: number) {
    setLoading(true)
    setError('')
    try {
      let data: any[]
      if (studentId) {
        const res = await getStudentInteractions(studentId)
        data = Array.isArray(res) ? res : res?.items || []
      } else {
        const res = await getMyInteractions()
        data = Array.isArray(res) ? res : res?.items || []
      }
      setHistory(data)
    } catch {
      setError('Failed to load interaction history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function init() {
      if (isTeacherOrAdmin) {
        try {
          const s = await listStudentsAnalytics()
          setStudents(Array.isArray(s) ? s : [])
        } catch { /* ignore */ }
      }
      await loadInteractions()
    }
    init()
  }, [])

  function selectStudent(id: number | null) {
    setSelectedStudentId(id)
    setActiveSkill('all')
    loadInteractions(id || undefined)
  }

  const skills = useMemo(() => {
    const set = new Set<string>()
    history.forEach((item) => {
      if (item.skill_name) set.add(String(item.skill_name))
      else if (item.skill_id) set.add(String(item.skill_id))
    })
    return ['all', ...Array.from(set)]
  }, [history])

  const filtered = activeSkill === 'all'
    ? history
    : history.filter((item) => String(item.skill_name || item.skill_id) === activeSkill)

  const correctCount = filtered.filter((item) => item.is_correct).length
  const accuracy = filtered.length ? (correctCount / filtered.length) * 100 : 0

  const selectedStudent = students.find((s) => (s.user_id || s.id) === selectedStudentId)

  return (
    <div className="history-page">
      <section className="history-hero">
        <div>
          <p className="teacher-eyebrow">Practice Record</p>
          <h2 className="editorial-title">History</h2>
          <p>Review practice sessions, answer outcomes, skill coverage, and timing across recent learning activity.</p>
        </div>
        <div className="history-subject-card">
          <span>Viewing</span>
          <strong>
            {isTeacherOrAdmin
              ? selectedStudent
                ? selectedStudent.name || selectedStudent.username || `Student ${selectedStudentId}`
                : 'All students'
              : me?.full_name || me?.username || 'My history'}
          </strong>
        </div>
      </section>

      <section className="history-panel">
        <div className="skills-panel-header">
          <div>
            <p className="teacher-eyebrow">Filters</p>
            <h3 className="editorial-title">Session scope</h3>
          </div>
        </div>

        {isTeacherOrAdmin && students.length > 0 && (
          <div className="history-chip-row">
            <button
              type="button"
              className={`skills-chip ${selectedStudentId === null ? 'active' : ''}`}
              onClick={() => selectStudent(null)}
            >
              My own
            </button>
            {students.map((s: any) => {
              const id = s.user_id || s.id
              return (
                <button
                  key={id}
                  type="button"
                  className={`skills-chip ${selectedStudentId === id ? 'active' : ''}`}
                  onClick={() => selectStudent(id)}
                >
                  {s.name || s.username || `Student ${id}`}
                </button>
              )
            })}
          </div>
        )}

        <div className="teacher-kpi-grid history-kpis">
          <div className="teacher-kpi-card">
            <p>Attempts</p>
            <strong>{filtered.length}</strong>
          </div>
          <div className="teacher-kpi-card">
            <p>Correct</p>
            <strong style={{ color: '#1F4D3A' }}>{correctCount}</strong>
          </div>
          <div className="teacher-kpi-card">
            <p>Accuracy</p>
            <strong>{filtered.length ? `${accuracy.toFixed(1)}%` : '-'}</strong>
          </div>
        </div>

        {filtered.length > 0 && (
          <div className="history-accuracy-block">
            <div>
              <p>Session accuracy</p>
              <strong>{accuracy.toFixed(1)}%</strong>
            </div>
            <div className="teacher-progress"><span style={{ width: `${accuracy}%` }} /></div>
          </div>
        )}

        <div className="history-chip-row">
          {skills.map((skill) => (
            <button
              key={skill}
              type="button"
              className={`skills-chip ${activeSkill === skill ? 'active' : ''}`}
              onClick={() => setActiveSkill(skill)}
            >
              {skill === 'all' ? 'All skills' : skill}
            </button>
          ))}
        </div>
      </section>

      <section className="history-panel">
        <div className="skills-panel-header">
          <div>
            <p className="teacher-eyebrow">Timeline</p>
            <h3 className="editorial-title">Interactions</h3>
          </div>
          <span className="skills-count-pill subtle">{filtered.length} records</span>
        </div>

        {loading ? (
          <div className="empty-state"><p className="meta">Loading...</p></div>
        ) : error ? (
          <p className="feedback error">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>No history yet.</p>
            <p className="meta">Complete some practice questions to see your history here.</p>
          </div>
        ) : (
          <div className="history-list">
            {filtered.map((item: any, idx: number) => (
              <article key={item.id || idx} className="history-card">
                <div className="history-card-main">
                  <h4>{item.question_text || `Question ${item.question_id}`}</h4>
                  <span className={`history-result-pill ${item.is_correct ? 'success' : 'danger'}`}>
                    {item.is_correct ? 'Correct' : 'Wrong'}
                  </span>
                </div>
                <p>
                  Skill: {item.skill_name || item.skill_id || '-'}
                  {item.time_taken != null && ` | ${item.time_taken}s`}
                  {item.timestamp && ` | ${new Date(item.timestamp).toLocaleString()}`}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
