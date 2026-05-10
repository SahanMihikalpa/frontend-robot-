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
    <div className="stack">
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>History</h2>
            <p className="meta">Practice session and answer history.</p>
          </div>
          <span className="badge">
            {isTeacherOrAdmin
              ? selectedStudent
                ? selectedStudent.name || selectedStudent.username || `Student ${selectedStudentId}`
                : 'All students'
              : me?.full_name || me?.username || 'My history'}
          </span>
        </div>

        {/* Student picker (teacher/admin) */}
        {isTeacherOrAdmin && students.length > 0 && (
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${selectedStudentId === null ? 'active' : ''}`}
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
                  className={`chip ${selectedStudentId === id ? 'active' : ''}`}
                  onClick={() => selectStudent(id)}
                >
                  {s.name || s.username || `Student ${id}`}
                </button>
              )
            })}
          </div>
        )}

        {/* Stats */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <p className="kpi-label">Attempts</p>
            <p className="kpi-value">{filtered.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Correct</p>
            <p className="kpi-value" style={{ color: '#4ade80' }}>{correctCount}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Accuracy</p>
            <p className="kpi-value">{filtered.length ? `${accuracy.toFixed(1)}%` : '—'}</p>
          </div>
        </div>

        {filtered.length > 0 && (
          <div>
            <div className="row" style={{ marginBottom: 6 }}>
              <p className="meta">Session accuracy</p>
              <strong style={{ fontSize: 13 }}>{accuracy.toFixed(1)}%</strong>
            </div>
            <div className="progress"><span style={{ width: `${accuracy}%` }} /></div>
          </div>
        )}

        {/* Skill filter */}
        <div className="chip-row">
          {skills.map((skill) => (
            <button
              key={skill}
              type="button"
              className={`chip ${activeSkill === skill ? 'active' : ''}`}
              onClick={() => setActiveSkill(skill)}
            >
              {skill === 'all' ? 'All skills' : skill}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <div className="section-title">
          <h3>Interactions</h3>
          <span className="badge neutral">{filtered.length} records</span>
        </div>

        {loading ? (
          <div className="empty-state"><p className="meta">Loading…</p></div>
        ) : error ? (
          <p className="feedback error">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>No history yet.</p>
            <p className="meta">Complete some practice questions to see your history here.</p>
          </div>
        ) : (
          <div className="list">
            {filtered.map((item: any, idx: number) => (
              <div key={item.id || idx} className="list-item">
                <div className="row">
                  <strong style={{ flex: 1 }}>
                    {item.question_text || `Question ${item.question_id}`}
                  </strong>
                  <span className={`badge ${item.is_correct ? 'success' : 'danger'}`}>
                    {item.is_correct ? 'Correct' : 'Wrong'}
                  </span>
                </div>
                <p className="meta" style={{ marginTop: 4 }}>
                  Skill: {item.skill_name || item.skill_id || '—'}
                  {item.time_taken != null && ` · ${item.time_taken}s`}
                  {item.timestamp && ` · ${new Date(item.timestamp).toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
