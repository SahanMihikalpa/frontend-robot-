import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSkillsAnalytics, listStudentsAnalytics } from '../../lib/api'

function readScore(row: any) {
  for (const k of ['overall_score', 'score', 'avg_score']) {
    if (typeof row?.[k] === 'number') return row[k]
  }
  return null
}

function scoreColor(score: number | null) {
  if (score == null) return 'var(--muted)'
  if (score >= 0.7) return 'var(--success)'
  if (score >= 0.4) return 'var(--warning)'
  return 'var(--danger)'
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [s, k] = await Promise.all([listStudentsAnalytics(), getSkillsAnalytics()])
        setStudents(Array.isArray(s) ? s : [])
        setSkills(Array.isArray(k) ? k : [])
      } catch {
        setError('Unable to load teacher dashboard data')
      }
    }
    load()
  }, [])

  const avgScore = students.length > 0
    ? students.reduce((acc, s) => acc + (readScore(s) || 0), 0) / students.length
    : null
  const atRisk = students.filter((s) => { const sc = readScore(s); return sc != null && sc < 0.4 }).length

  return (
    <div className="teacher-dashboard student-dash teacher-home-page">
      {error && <p className="feedback error">{error}</p>}

      <div className="teacher-layout">
        <section className="teacher-main">
          <section className="teacher-hero">
            <div>
              <p className="teacher-eyebrow">Class Studio</p>
              <h2 className="editorial-title">Teacher Dashboard</h2>
              <p>
                Monitor class performance, spot learners who need support, and follow
                skill movement across your classroom.
              </p>
            </div>
            <div className="teacher-hero-note">
              <span>Today</span>
              <strong>{students.length}</strong>
              <p>students tracked</p>
            </div>
          </section>

          <div className="teacher-kpi-grid">
            <div className="teacher-kpi-card">
              <p>Students tracked</p>
              <strong>{students.length}</strong>
              <small>in your classroom</small>
            </div>
            <div className="teacher-kpi-card">
              <p>Average score</p>
              <strong>{avgScore != null ? avgScore.toFixed(2) : '-'}</strong>
              <small>across all students</small>
            </div>
            <div className="teacher-kpi-card">
              <p>At-risk</p>
              <strong style={{ color: atRisk > 0 ? 'var(--danger)' : undefined }}>{atRisk}</strong>
              <small>scoring below 40%</small>
            </div>
          </div>

          <section className="teacher-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Roster Snapshot</p>
                <h3 className="editorial-title">Students overview</h3>
              </div>
              <Link href="/teacher/students" className="teacher-text-link">
                View roster
              </Link>
            </div>

            <div className="teacher-table-wrap">
              <table className="teacher-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr><td colSpan={3} className="teacher-empty-cell">No students yet</td></tr>
                  ) : students.slice(0, 10).map((s: any, idx: number) => {
                    const score = readScore(s)
                    return (
                      <tr key={s.user_id || s.id || idx}>
                        <td>{s.name || s.username || s.full_name || `Student ${idx + 1}`}</td>
                        <td>{s.email || '-'}</td>
                        <td style={{ color: scoreColor(score) }}>{score != null ? score.toFixed(2) : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="teacher-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Learning Movement</p>
                <h3 className="editorial-title">Skill trends</h3>
              </div>
              <Link href="/teacher/heatmap" className="teacher-text-link">
                Open heatmap
              </Link>
            </div>

            <div className="teacher-skill-list">
              {skills.slice(0, 6).map((k: any, i: number) => {
                const score = typeof k.avg_score === 'number' ? k.avg_score : typeof k.average === 'number' ? k.average : null
                const pct = score != null ? Math.round(score * 100) : null
                return (
                  <div className="teacher-skill-row" key={k.skill_id || i}>
                    <div className="teacher-skill-topline">
                      <p>{k.skill_name || k.name || `Skill ${i + 1}`}</p>
                      <span style={{ color: scoreColor(score) }}>{pct != null ? `${pct}%` : '-'}</span>
                    </div>
                    {pct != null && <div className="teacher-progress"><span style={{ width: `${pct}%` }} /></div>}
                  </div>
                )
              })}
            </div>
          </section>
        </section>

        <aside className="teacher-actions">
          <p className="teacher-eyebrow">Workspace</p>
          <h3 className="editorial-title">Quick actions</h3>

          <div className="teacher-action-list">
            <Link href="/teacher/students" className="teacher-action primary">
              <span>01</span>
              Student roster
            </Link>
            <Link href="/teacher/heatmap" className="teacher-action primary">
              <span>02</span>
              Skill heatmap
            </Link>
            <Link href="/skills" className="teacher-action">
              <span>03</span>
              Manage skills
            </Link>
            <Link href="/questions" className="teacher-action">
              <span>04</span>
              Manage questions
            </Link>
            <Link href="/knowledge" className="teacher-action">
              <span>05</span>
              Knowledge base
            </Link>
            <Link href="/history" className="teacher-action">
              <span>06</span>
              View history
            </Link>
            <Link href="/analytics" className="teacher-action">
              <span>07</span>
              Full analytics
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
