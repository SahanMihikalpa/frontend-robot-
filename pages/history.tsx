import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getMyInteractions, getStudentInteractions, listStudentsAnalytics, listSkills } from '../lib/api'
import { getStoredUser } from '../lib/session'

export default function HistoryPage() {
  const me = getStoredUser()
  const isTeacherOrAdmin = me?.role === 'teacher' || me?.role === 'admin'

  const [history, setHistory] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [skillNames, setSkillNames] = useState<Record<string, string>>({})
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [activeSkill, setActiveSkill] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Interactions only carry skill_id — resolve names from the skills list
  function skillLabel(item: any): string {
    if (item.skill_name) return String(item.skill_name)
    if (item.skill_id != null) return skillNames[String(item.skill_id)] || `Skill ${item.skill_id}`
    return '-'
  }

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
      try {
        const sk = await listSkills()
        const list: any[] = Array.isArray(sk) ? sk : sk?.items || []
        const map: Record<string, string> = {}
        list.forEach((s: any) => { if (s?.id != null && s?.name) map[String(s.id)] = s.name })
        setSkillNames(map)
      } catch { /* names fall back to "Skill <id>" */ }
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
      const label = skillLabel(item)
      if (label !== '-') set.add(label)
    })
    return ['all', ...Array.from(set)]
  }, [history, skillNames])

  const filtered = activeSkill === 'all'
    ? history
    : history.filter((item) => skillLabel(item) === activeSkill)

  const correctCount = filtered.filter((item) => item.is_correct).length
  const accuracy = filtered.length ? (correctCount / filtered.length) * 100 : 0

  const selectedStudent = students.find((s) => (s.user_id || s.id) === selectedStudentId)

  return (
    <div className="teacher-dashboard student-dash history-page">
      <div className="teacher-layout">
        <section className="teacher-main">
          <section className="teacher-hero">
            <div>
              <p className="teacher-eyebrow">Practice Record</p>
              <h2 className="editorial-title">History</h2>
              <p>Review practice sessions, answer outcomes, skill coverage, and timing across recent learning activity.</p>
            </div>
            <div className="teacher-hero-note history-hero-note">
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

          

          <section className="teacher-panel history-scope-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Filters</p>
                <h3 className="editorial-title">Session scope</h3>
              </div>
            </div>

            {isTeacherOrAdmin && students.length > 0 && (
              <div className="history-filter-group">
                <p className="history-filter-label">Student</p>
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
              </div>
            )}

            <div className="history-filter-group">
              <p className="history-filter-label">Skill</p>
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
          </section>

          <section className="teacher-panel history-timeline-panel">
            <div className="teacher-panel-header">
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
                      Skill: {skillLabel(item)}
                      {item.time_taken != null && ` | ${item.time_taken}s`}
                      {item.timestamp && ` | ${new Date(item.timestamp).toLocaleString()}`}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="teacher-actions">
          <p className="teacher-eyebrow">Metrics</p>
          <h3 className="editorial-title">Key stats</h3>

          <div className="history-kpi-stack">
            <div className="teacher-kpi-card">
              <p>Attempts</p>
              <strong>{filtered.length}</strong>
              <small>questions answered</small>
            </div>
            <div className="teacher-kpi-card">
              <p>Correct</p>
              <strong style={{ color: 'var(--success)' }}>{correctCount}</strong>
              <small>right answers</small>
            </div>
            <div className="teacher-kpi-card">
              <p>Accuracy</p>
              <strong>{filtered.length ? `${accuracy.toFixed(1)}%` : '-'}</strong>
              <small>of filtered attempts</small>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
